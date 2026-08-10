const pool = require('../config/db');
const waveService = require('../services/waveService');
const bcrypt = require('bcryptjs');
const { sendOrderReceiptEmail, sendAdminNewOrderNotification, sendInvoiceEmail } = require('../services/emailService');

// 1. Create Wave Direct Checkout Session
exports.createWaveCheckout = async (req, res) => {
  try {
    const { amount, packName, userEmail, userName, userPhone, companyName } = req.body;

    if (!amount || !packName) {
      return res.status(400).json({ error: 'Montant et nom du pack requis' });
    }

    const reference = `HORECA-WAVE-${Date.now()}`;

    // Record order in pending state
    try {
      await pool.promise().query(
        `INSERT INTO orders (reference, user_id, customer_name, customer_email, customer_phone, company_name, pack_name, amount, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WAVE_DIRECT', 'PENDING_PAYMENT')`,
        [reference, null, userName || 'Client', userEmail || 'client@horecafrica.org', userPhone || '', companyName || '', packName || 'Offre HORECA', amount]
      );
    } catch (dbErr) {
      console.warn('Note storing Wave order in DB:', dbErr.message);
    }

    const result = await waveService.createCheckoutSession({
      amount,
      currency: 'XOF',
      reference,
      success_url: 'https://app.horecafrica.org/?payment=success',
      error_url: 'https://app.horecafrica.org/?payment=error'
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || "Échec d'initialisation de la session Wave" });
    }

    res.json({
      success: true,
      wave_launch_url: result.wave_launch_url,
      sessionId: result.sessionId,
      reference
    });
  } catch (error) {
    console.error('createWaveCheckout error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session Wave' });
  }
};

// 2. Submit Manual Payment Request (Wave / Orange Money via +221 77 542 82 35)
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

    // Trigger automatic order receipt email to customer & alert to SuperAdmin
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

// 3. Get All Orders (SuperAdmin Dashboard)
exports.getAllOrders = async (req, res) => {
  try {
    const [rows] = await pool.promise().query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('getAllOrders error:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
};

// 4. SuperAdmin Verify Manual Payment & Send Invoice + Activate Access
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
      
      // Update order status in DB
      await pool.promise().query(
        `UPDATE orders SET status = 'COMPLETED', invoice_number = ?, invoice_sent = TRUE, admin_notes = ? WHERE id = ?`,
        [invoiceNumber, adminNotes || 'Paiement manuel validé par SuperAdmin', orderId]
      );

      // Automatically activate or create corresponding user account in DB
      try {
        const cleanEmail = (order.customer_email || '').trim().toLowerCase();
        if (cleanEmail) {
          const [existingUsers] = await pool.promise().query('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);

          if (existingUsers.length > 0) {
            await pool.promise().query(`UPDATE users SET is_active = TRUE WHERE id = ?`, [existingUsers[0].id]);
          } else {
            // Create and activate account if missing
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

      // Trigger automatic invoice & access activation email
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

// 5. Resend Email for Order (SuperAdmin or Direct trigger)
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
