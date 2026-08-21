const pool = require('../config/db');
const waveService = require('../services/waveService');
const bcrypt = require('bcryptjs');
const { sendOrderReceiptEmail, sendAdminNewOrderNotification, sendInvoiceEmail } = require('../services/emailService');

/**
 * 1. Créateur de session de paiement Wave Direct Checkout
 */
exports.createWaveCheckout = async (req, res) => {
  try {
    const { amount, packName, userEmail, userName, userPhone, companyName, userId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Montant valide requis' });
    }

    // Reference unique HORECA
    const reference = req.body.reference || `HORECA-PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const frontendUrl = process.env.FRONTEND_URL || 'https://horecafrica.com';

    // 1. Créer la session Checkout via Wave API
    const result = await waveService.createCheckoutSession({
      amount: amount,
      currency: 'XOF',
      reference: reference,
      success_url: `${frontendUrl}/payment-status?status=success&ref=${reference}`,
      error_url: `${frontendUrl}/payment-status?status=error&ref=${reference}`
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Impossible d’initialiser le paiement Wave' });
    }

    // 2. Sauvegarder la commande / transaction en base de données
    try {
      await pool.promise().query(
        `INSERT INTO orders (reference, wave_session_id, user_id, customer_name, customer_email, customer_phone, company_name, pack_name, amount, payment_method, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAVE', 'PENDING_PAYMENT', NOW())`,
        [
          reference,
          result.transaction_id || result.sessionId || null,
          userId || null,
          userName || 'Client',
          userEmail || 'client@horecafrica.org',
          userPhone || '',
          companyName || '',
          packName || 'Offre HORECA 2026',
          amount
        ]
      );
    } catch (dbErr) {
      console.warn('⚠️ Diagnostic enregistrement order Wave DB:', dbErr.message);
    }

    // 3. Renvoyer les URLs et détails au frontend
    res.json({
      success: true,
      reference: reference,
      wave_session_id: result.transaction_id || result.sessionId,
      wave_launch_url: result.wave_launch_url, // Pour ouverture automatique sur Mobile Wave App
      qr_uri: result.uri,                       // Pour affichage du QR Code sur Desktop
      uri: result.uri,
      data: result.data
    });

  } catch (error) {
    console.error('❌ Erreur createWaveCheckout:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la création du paiement Wave' });
  }
};

/**
 * 2. Vérification du statut du paiement Wave (Polling Frontend ou Vérification Directe)
 */
exports.verifyWaveSession = async (req, res) => {
  try {
    const reference = req.params.reference || req.params.sessionId || req.query.ref;

    if (!reference) {
      return res.status(400).json({ error: 'Référence de transaction ou ID de session requis' });
    }

    // 1. Chercher la commande en DB par référence ou sessionId
    const [rows] = await pool.promise().query(
      'SELECT * FROM orders WHERE reference = ? OR wave_session_id = ?',
      [reference, reference]
    );

    if (rows.length === 0) {
      // Si pas encore en DB, essayer d'interroger directement Wave
      const waveCheck = await waveService.getCheckoutSession(reference);
      if (waveCheck.success && waveCheck.is_paid) {
        return res.json({ success: true, isPaid: true, is_paid: true, statut: 'PAYE' });
      }
      return res.json({ success: true, isPaid: false, is_paid: false, statut: 'PENDING_PAYMENT' });
    }

    const order = rows[0];

    // Si déjà marquée comme payée
    if (order.status === 'COMPLETED' || order.status === 'PAYE') {
      return res.json({ success: true, isPaid: true, is_paid: true, statut: 'PAYE' });
    }

    // 2. Si toujours en attente, interroger l'API Wave en temps réel
    const targetSessionId = order.wave_session_id || order.reference;
    const waveCheck = await waveService.getCheckoutSession(targetSessionId);

    if (waveCheck.success && waveCheck.is_paid) {
      const invoiceNumber = `INV-2026-${String(order.id).padStart(4, '0')}`;

      // Mettre à jour la DB
      await pool.promise().query(
        'UPDATE orders SET status = "COMPLETED", invoice_number = ?, invoice_sent = TRUE, updated_at = NOW() WHERE id = ?',
        [invoiceNumber, order.id]
      );

      // Activer le compte client s'il existe
      if (order.customer_email) {
        try {
          const cleanEmail = order.customer_email.trim().toLowerCase();
          await pool.promise().query('UPDATE users SET is_active = TRUE WHERE LOWER(email) = ?', [cleanEmail]);
        } catch (uErr) {
          console.warn('Note user activation on verifyWaveSession:', uErr.message);
        }
      }

      // Envoyer la facture
      order.status = 'COMPLETED';
      order.invoice_number = invoiceNumber;
      sendInvoiceEmail(order).catch(e => console.warn('Verify wave invoice email background error:', e.message));

      return res.json({ success: true, isPaid: true, is_paid: true, statut: 'PAYE' });
    }

    res.json({ success: true, isPaid: false, is_paid: false, statut: order.status });

  } catch (error) {
    console.error('❌ Erreur verifyWaveSession:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification de la transaction' });
  }
};

/**
 * 3. Demande de Paiement Manuel (Wave / Orange Money via Conciergerie)
 */
exports.submitManualPayment = async (req, res) => {
  try {
    const { userId, customerName, customerEmail, customerPhone, companyName, packName, amount, paymentMethod, transactionRef, password } = req.body;

    if (!customerName || !customerEmail || !packName || !amount) {
      return res.status(400).json({ error: 'Informations client et montant obligatoires' });
    }

    const cleanEmail = customerEmail.trim().toLowerCase();

    // Check or create participant user account
    let targetUserId = userId || null;
    const [existingUsers] = await pool.promise().query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);

    if (existingUsers.length > 0) {
      targetUserId = existingUsers[0].id;
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.promise().query('UPDATE users SET password = ?, name = ?, company = ?, phone = ? WHERE id = ?', [hashedPassword, customerName.trim(), companyName || customerName.trim(), customerPhone || '', targetUserId]);
      }
    } else {
      const userPass = password || 'horeca2026';
      const hashedPassword = await bcrypt.hash(userPass, 10);
      const userRole = packName.toLowerCase().includes('stand') || packName.toLowerCase().includes('pack') ? 'Exposant' : 'Professionnel';

      const [newUser] = await pool.promise().query(
        `INSERT INTO users (email, password, name, company, role, sector, phone, is_super_admin, is_active)
         VALUES (?, ?, ?, ?, ?, 'Hôtellerie', ?, FALSE, FALSE)`,
        [cleanEmail, hashedPassword, customerName.trim(), companyName || customerName.trim(), userRole, customerPhone || '']
      );
      targetUserId = newUser.insertId;
    }

    const reference = `HORECA-MANUAL-${Date.now()}`;
    const method = paymentMethod === 'MANUAL_OM' ? 'MANUAL_OM' : 'MANUAL_WAVE';

    const [result] = await pool.promise().query(
      `INSERT INTO orders (reference, user_id, customer_name, customer_email, customer_phone, company_name, pack_name, amount, payment_method, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_MANUAL_VERIFICATION')`,
      [
        reference,
        targetUserId,
        customerName.trim(),
        cleanEmail,
        customerPhone || '',
        companyName || '',
        packName,
        amount,
        method,
        transactionRef || 'En attente de vérification'
      ]
    );

    const orderObj = {
      id: result.insertId,
      reference,
      user_id: targetUserId,
      customer_name: customerName.trim(),
      customer_email: cleanEmail,
      customer_phone: customerPhone,
      company_name: companyName,
      pack_name: packName,
      amount,
      payment_method: method,
      transaction_ref: transactionRef
    };

    sendOrderReceiptEmail(orderObj).catch(e => console.warn('Order receipt email background error:', e.message));
    sendAdminNewOrderNotification(orderObj).catch(e => console.warn('Admin order notification background error:', e.message));

    res.status(201).json({
      success: true,
      message: 'Votre compte participant et demande de réservation ont été créés avec succès. L\'administrateur va valider votre transfert et vos accès seront débloqués.',
      orderId: result.insertId,
      userId: targetUserId,
      reference
    });
  } catch (error) {
    console.error('submitManualPayment error:', error);
    res.status(500).json({ error: 'Erreur lors de l\'enregistrement de la demande de paiement' });
  }
};

/**
 * 4. Get All Orders (SuperAdmin Dashboard)
 */
exports.getAllOrders = async (req, res) => {
  try {
    const [rows] = await pool.promise().query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('getAllOrders error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

/**
 * 5. SuperAdmin Verify Manual Payment & Send Invoice + Activate Access
 */
exports.verifyManualPayment = async (req, res) => {
  try {
    const { orderId, action, adminNotes } = req.body;
    if (!orderId || !action) {
      return res.status(400).json({ error: 'Order ID et action (APPROVE/REJECT) requis' });
    }

    const [orders] = await pool.promise().query('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Commande introuvable' });
    }

    const order = orders[0];

    if (action === 'APPROVE') {
      const invoiceNumber = `INV-2026-${String(orderId).padStart(4, '0')}`;
      
      await pool.promise().query(
        `UPDATE orders SET status = 'COMPLETED', invoice_number = ?, invoice_sent = TRUE, admin_notes = ? WHERE id = ?`,
        [invoiceNumber, adminNotes || 'Paiement manuel validé par SuperAdmin', orderId]
      );

      try {
        const cleanEmail = (order.customer_email || '').trim().toLowerCase();
        if (cleanEmail) {
          const [existingUsers] = await pool.promise().query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);

          if (existingUsers.length > 0) {
            await pool.promise().query(`UPDATE users SET is_active = TRUE WHERE id = ?`, [existingUsers[0].id]);
          } else {
            const defaultPass = await bcrypt.hash('horeca2026', 10);
            const userRole = (order.pack_name || '').toLowerCase().includes('stand') || (order.pack_name || '').toLowerCase().includes('pack') ? 'Exposant' : 'Professionnel';
            const [newUser] = await pool.promise().query(
              `INSERT INTO users (email, password, name, company, role, sector, phone, is_super_admin, is_active)
               VALUES (?, ?, ?, ?, ?, 'Hôtellerie', ?, FALSE, TRUE)`,
              [cleanEmail, defaultPass, order.customer_name || 'Participant', order.company_name || order.customer_name || 'Participant', userRole, order.customer_phone || '']
            );
            await pool.promise().query(`UPDATE orders SET user_id = ? WHERE id = ?`, [newUser.insertId, orderId]);
          }
        }
      } catch (userErr) {
        console.warn('Note activating user account on payment approval:', userErr.message);
      }

      order.status = 'COMPLETED';
      order.invoice_number = invoiceNumber;
      await sendInvoiceEmail(order);

      return res.json({
        success: true,
        message: `Paiement N° ${order.reference} validé avec succès ! La facture ${invoiceNumber} et l'activation des accès ont été envoyées par email à ${order.customer_email}.`,
        invoiceNumber
      });
    } else {
      await pool.promise().query(
        `UPDATE orders SET status = 'REJECTED', admin_notes = ? WHERE id = ?`,
        [adminNotes || 'Paiement rejeté par l\'administrateur', orderId]
      );

      return res.json({
        success: true,
        message: `La commande N° ${order.reference} a été rejetée.`
      });
    }
  } catch (error) {
    console.error('verifyManualPayment error:', error);
    res.status(500).json({ error: 'Erreur lors de la vérification du paiement' });
  }
};

/**
 * 6. Resend Email for Order (SuperAdmin or Direct trigger)
 */
exports.resendEmail = async (req, res) => {
  try {
    const orderId = req.query.orderId || req.body.orderId;
    const email = req.query.email || req.body.email;

    let query = 'SELECT * FROM orders ';
    let params = [];
    if (orderId) {
      query += 'WHERE id = ?';
      params.push(orderId);
    } else if (email) {
      query += 'WHERE LOWER(customer_email) = LOWER(?) ORDER BY created_at DESC LIMIT 1';
      params.push(email.trim());
    } else {
      return res.status(400).json({ error: 'Order ID ou Email requis' });
    }

    const [orders] = await pool.promise().query(query, params);
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const order = orders[0];
    const result = await sendInvoiceEmail(order);
    res.json({ success: true, message: `Email d'accès et facture renvoyés à ${order.customer_email}`, result });
  } catch (error) {
    console.error('resendEmail error:', error);
    res.status(500).json({ error: "Erreur renvoi d'email" });
  }
};
