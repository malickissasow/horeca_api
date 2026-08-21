const waveService = require('../services/waveService');
const pool = require('../config/db');
const { sendInvoiceEmail, sendOrderReceiptEmail } = require('../services/emailService');

/**
 * Endpoint Webhook appelé par Wave
 * Route: POST /api/payment/webhook/wave
 */
exports.handleWaveWebhook = async (req, res) => {
  const event = req.body;

  console.log(`🌊 [Wave Webhook] Événement reçu : ${event?.type}`, { id: event?.id });

  // Répondre immédiatement 200 OK à Wave pour éviter les retentatives
  res.status(200).send('Webhook Received');

  try {
    if (!event || !event.type) return;

    // Événement standard déclenché par Wave lorsque le paiement réussit
    if (event.type === 'checkout.session.completed') {
      const data = event.data || {};
      const { id, amount, client_reference, payment_status } = data;

      console.log(`🌊 [Wave Webhook] Checkout Completed | Ref: ${client_reference} | ID: ${id} | Status: ${payment_status} | Montant: ${amount}`);

      if (payment_status !== 'succeeded') {
        console.warn(`⚠️ [Wave Webhook] Statut non payé pour la session ${id}: ${payment_status}`);
        return;
      }

      // 1. Retrouver la commande en DB
      const [rows] = await pool.promise().query(
        'SELECT * FROM orders WHERE reference = ? OR wave_session_id = ?',
        [client_reference, id]
      );

      if (rows.length === 0) {
        console.error(`❌ [Wave Webhook] Aucune commande trouvée pour la référence : ${client_reference}`);
        return;
      }

      const order = rows[0];

      // 2. Vérifier si elle n'est pas déjà traitée
      if (order.status === 'COMPLETED' || order.status === 'PAYE') {
        console.log(`ℹ️ [Wave Webhook] Commande ${client_reference} déjà traitée.`);
        return;
      }

      // 3. Mettre à jour le statut en base de données
      const invoiceNumber = `INV-2026-${String(order.id).padStart(4, '0')}`;
      await pool.promise().query(
        'UPDATE orders SET status = "COMPLETED", wave_session_id = ?, invoice_number = ?, invoice_sent = TRUE, updated_at = NOW() WHERE id = ?',
        [id, invoiceNumber, order.id]
      );

      console.log(`✅ [Wave Webhook] Commande ${client_reference} marquée comme COMPLETED avec succès !`);

      // 4. Activer le compte participant du client s'il existe
      if (order.customer_email) {
        try {
          const cleanEmail = order.customer_email.trim().toLowerCase();
          await pool.promise().query('UPDATE users SET is_active = TRUE WHERE LOWER(email) = ?', [cleanEmail]);
          console.log(`🎉 [HORECA] Compte client ${cleanEmail} activé suite au paiement Wave !`);
        } catch (userErr) {
          console.warn('Note activating user account on webhook completion:', userErr.message);
        }
      }

      // 5. Envoyer l'email de facture et d'accès
      order.status = 'COMPLETED';
      order.invoice_number = invoiceNumber;
      sendInvoiceEmail(order).catch(e => console.warn('Webhook invoice email background error:', e.message));
    }
  } catch (error) {
    console.error('❌ Erreur lors du traitement du Webhook Wave:', error);
  }
};
