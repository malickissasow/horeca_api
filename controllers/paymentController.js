const pool = require('../config/db');
const waveService = require('../services/waveService');
const { sendInvoiceEmail } = require('../services/emailService');

// Ensure orders table exists in DB
async function ensureOrdersTable() {
  try {
    await pool.promise().query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reference VARCHAR(100) NOT NULL UNIQUE,
        user_id INT DEFAULT NULL,
        customer_name VARCHAR(191) NOT NULL,
        customer_email VARCHAR(191) NOT NULL,
        customer_phone VARCHAR(50) DEFAULT NULL,
        company_name VARCHAR(191) DEFAULT NULL,
        pack_name VARCHAR(191) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method ENUM('WAVE_API', 'MANUAL_WAVE', 'MANUAL_OM') NOT NULL DEFAULT 'MANUAL_WAVE',
        transaction_ref VARCHAR(191) DEFAULT NULL,
        status ENUM('PENDING_PAYMENT', 'PENDING_MANUAL_VERIFICATION', 'COMPLETED', 'REJECTED') NOT NULL DEFAULT 'PENDING_MANUAL_VERIFICATION',
        invoice_number VARCHAR(100) DEFAULT NULL,
        invoice_sent BOOLEAN DEFAULT FALSE,
        admin_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  } catch (e) {
    console.error('ensureOrdersTable error:', e);
  }
}
ensureOrdersTable();

// 1. Direct Automated Wave API Checkout
exports.createWaveCheckout = async (req, res) => {
  try {
    const { amount, packName, userEmail, userName, userPhone, companyName, userId } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Montant requis pour le paiement Wave' });
    }

    const reference = `HORECA-WAVE-${Date.now()}`;

    // Store initial order in DB
    try {
      await pool.promise().query(
        `INSERT INTO orders (reference, user_id, customer_name, customer_email, customer_phone, company_name, pack_name, amount, payment_method, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'WAVE_API', 'PENDING_PAYMENT')`,
        [reference, userId || null, userName || 'Client', userEmail || 'client@horecafrica.org', userPhone || '', companyName || '', packName || 'Offre HORECA', amount]
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
      return res.status(400).json({ error: result.error || 'Échec d’initialisation de la session Wave' });
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
    const { userId, customerName, customerEmail, customerPhone, companyName, packName, amount, paymentMethod, transactionRef } = req.body;

    if (!customerName || !customerEmail || !packName || !amount) {
      return res.status(400).json({ error: 'Informations client et montant obligatoires' });
    }

    const reference = `HORECA-MANUAL-${Date.now()}`;
    const method = paymentMethod === 'MANUAL_OM' ? 'MANUAL_OM' : 'MANUAL_WAVE';

    const [result] = await pool.promise().query(
      `INSERT INTO orders (reference, user_id, customer_name, customer_email, customer_phone, company_name, pack_name, amount, payment_method, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_MANUAL_VERIFICATION')`,
      [
        reference,
        userId || null,
        customerName.trim(),
        customerEmail.trim(),
        customerPhone || '',
        companyName || '',
        packName,
        amount,
        method,
        transactionRef || 'En attente de vérification'
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Votre demande de paiement manuel a été soumise avec succès. L\'administrateur va valider le transfert et vous envoyer votre facture par email.',
      orderId: result.insertId,
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

// 4. SuperAdmin Verify Manual Payment & Send Invoice
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

      // Trigger automatic invoice email
      order.status = 'COMPLETED';
      order.invoice_number = invoiceNumber;
      await sendInvoiceEmail(order);

      return res.json({
        success: true,
        message: `Paiement N° ${order.reference} validé avec succès ! La facture ${invoiceNumber} a été envoyée par email à ${order.customer_email}.`,
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

// Verify Wave Session
exports.verifyWaveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await waveService.getCheckoutSession(sessionId);
    res.json(result);
  } catch (error) {
    console.error('verifyWaveSession error:', error);
    res.status(500).json({ error: 'Erreur vérification session Wave' });
  }
};
