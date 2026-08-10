let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('⚠️ Nodemailer package not available, email fallback mode');
}

// 1. Primary Native Hostinger Sendmail Transport (No SMTP password lock)
let sendmailTransporter = null;
if (nodemailer) {
  try {
    sendmailTransporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail'
    });
  } catch (e) {
    console.warn('⚠️ Sendmail init note:', e.message);
  }
}

// 2. Secondary Hostinger SMTP Transport
let smtpTransporter = null;
if (nodemailer) {
  try {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER || 'contact@horecafrica.org',
        pass: process.env.SMTP_PASS || 'B5@9ll@c'
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (e) {
    console.warn('⚠️ SMTP init note:', e.message);
  }
}

/**
 * Universal Mail Dispatcher with Dual Transport Fallback
 */
async function sendMailWithFallback(mailOptions) {
  // Ensure default Sender header
  if (!mailOptions.from) {
    mailOptions.from = '"HORECA AFRICA 2026" <contact@horecafrica.org>';
  }

  // 1. Try Native Hostinger Sendmail
  if (sendmailTransporter) {
    try {
      const info = await sendmailTransporter.sendMail(mailOptions);
      console.log(`✉️ Email successfully dispatched via Hostinger Sendmail to ${mailOptions.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, method: 'sendmail' };
    } catch (sendmailErr) {
      console.warn('⚠️ Sendmail transport failed, trying SMTP fallback:', sendmailErr.message);
    }
  }

  // 2. Try Hostinger SMTP
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`✉️ Email successfully dispatched via Hostinger SMTP to ${mailOptions.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, method: 'smtp' };
    } catch (smtpErr) {
      console.error('❌ SMTP transport failed:', smtpErr.message);
      return { success: false, error: smtpErr.message };
    }
  }

  return { success: false, error: 'Aucun transporteur mail disponible' };
}

/**
 * 1. Send Order Confirmation Email to Customer upon placing order (PENDING)
 */
async function sendOrderReceiptEmail(order) {
  const formattedAmount = Number(order.amount).toLocaleString('fr-FR') + ' FCFA';

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 20px; }
      .card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
      .header { background: #033498; color: white; padding: 24px; text-align: center; }
      .content { padding: 24px; line-height: 1.6; }
      .box { background: #fff7ed; border-left: 4px solid #ea580c; padding: 14px; margin: 16px 0; border-radius: 6px; }
      .footer { background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #64748b; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h2 style="margin:0;">HORECA AFRICA 2026</h2>
        <p style="margin:4px 0 0 0; opacity: 0.9; font-size: 13px;">Salon International B2B — Dakar, Sénégal</p>
      </div>
      <div class="content">
        <h3>Bonjour ${order.customer_name},</h3>
        <p>Nous avons bien reçu votre demande de réservation pour l'offre : <strong>${order.pack_name}</strong> (${formattedAmount}).</p>
        
        <div class="box">
          <p style="margin: 0 0 6px 0; font-weight: bold; color: #ea580c;">📌 Récapitulatif de votre Demande :</p>
          <p style="margin: 2px 0;">• <strong>Compte Participant :</strong> ${order.customer_email}</p>
          <p style="margin: 2px 0;">• <strong>Référence Commande :</strong> ${order.reference}</p>
          <p style="margin: 2px 0;">• <strong>Mode de Règlement :</strong> ${order.payment_method === 'MANUAL_OM' ? 'Orange Money (+221 77 542 82 35)' : 'Wave (+221 77 542 82 35)'}</p>
          <p style="margin: 2px 0;">• <strong>Référence Renseignée :</strong> ${order.transaction_ref || 'N/A'}</p>
        </div>

        <p>Si vous n'avez pas encore effectué votre transfert, merci de transférer <strong>${formattedAmount}</strong> au numéro officiel :</p>
        <p style="font-size: 1.2rem; font-weight: bold; color: #033498; text-align: center; background: #e0f2fe; padding: 10px; border-radius: 8px;">
          📞 +221 77 542 82 35 (Wave / Orange Money)
        </p>

        <p style="color: #334155; font-size: 14px;">
          ⏳ <strong>Prochaine étape :</strong> Dès que l'administrateur confirme la réception du paiement, vous recevrez automatiquement un second email d'activation avec votre <strong>Facture Acquittée Officielle (PDF)</strong> et le bouton de connexion directe à votre Espace Participant.
        </p>
      </div>
      <div class="footer">
        <p><strong>Comité d'Organisation HORECA AFRICA 2026</strong></p>
        <p>Support / WhatsApp : +221 77 542 82 35 | Email : contact@horecafrica.org</p>
      </div>
    </div>
  </body>
  </html>
  `;

  return await sendMailWithFallback({
    to: order.customer_email,
    subject: `[HORECA AFRICA 2026] Confirmation de Réception de votre Commande (${order.reference})`,
    html
  });
}

/**
 * 2. Send Alert Email to SuperAdmin when a new order is placed
 */
async function sendAdminNewOrderNotification(order) {
  const formattedAmount = Number(order.amount).toLocaleString('fr-FR') + ' FCFA';

  const html = `
  <h3>🚨 Nouvelle Commande HORECA AFRICA à Valider</h3>
  <p>Un client vient d'effectuer une demande de paiement manuel :</p>
  <ul>
    <li><strong>Client :</strong> ${order.customer_name} (${order.company_name || 'Particulier'})</li>
    <li><strong>Email Participant :</strong> ${order.customer_email}</li>
    <li><strong>Téléphone :</strong> ${order.customer_phone || 'Non renseigné'}</li>
    <li><strong>Pack :</strong> ${order.pack_name}</li>
    <li><strong>Montant :</strong> ${formattedAmount}</li>
    <li><strong>Mode :</strong> ${order.payment_method}</li>
    <li><strong>Réf Transfert Client :</strong> ${order.transaction_ref}</li>
  </ul>
  <p>Connectez-vous sur le Dashboard Admin pour valider le dépôt et envoyer la facture : <a href="https://app.horecafrica.org/">https://app.horecafrica.org/</a></p>
  `;

  return await sendMailWithFallback({
    to: 'contact@horecafrica.org',
    subject: `[🚨 NOUVELLE COMMANDE] ${order.customer_name} - ${order.pack_name} (${formattedAmount})`,
    html
  });
}

/**
 * 3. Generate HTML Invoice & Access Credentials Template (APPROVED)
 */
function generateInvoiceHtml(order) {
  const formattedDate = new Date(order.created_at || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedAmount = Number(order.amount).toLocaleString('fr-FR') + ' FCFA';
  const loginUrl = `https://app.horecafrica.org/?login=1&email=${encodeURIComponent(order.customer_email)}`;

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; color: #0f172a; margin: 0; padding: 20px; }
      .invoice-card { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
      .header { background: linear-gradient(135deg, #1e1b4b 0%, #033498 50%, #ea580c 100%); color: #ffffff; padding: 30px; text-align: center; }
      .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; }
      .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
      .badge-paid { display: inline-block; background: #22c55e; color: #ffffff; padding: 8px 18px; border-radius: 20px; font-weight: bold; font-size: 13px; text-transform: uppercase; margin-top: 15px; }
      .content { padding: 30px; }
      .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
      .info-block h4 { margin: 0 0 6px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-block p { margin: 0; font-weight: 600; font-size: 14px; color: #1e293b; }
      .table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
      .table th { background: #f8fafc; color: #475569; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
      .table td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
      .total-row td { font-weight: bold; font-size: 16px; color: #033498; border-top: 2px solid #e2e8f0; }
      .access-box { background: #ecfdf5; border: 2px solid #10b981; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="invoice-card">
      <div class="header">
        <h1>HORECA AFRICA 2026</h1>
        <p>Salon International de l'Hôtellerie, Restauration & Alimentation</p>
        <span class="badge-paid">✓ PAIEMENT VALIDÉ & ACCÈS ACTIVÉS</span>
      </div>
      <div class="content">
        <div class="info-grid">
          <div class="info-block">
            <h4>Facturé à</h4>
            <p>${order.customer_name}</p>
            <p style="font-weight: normal; color: #64748b;">${order.company_name || 'Particulier'}</p>
            <p style="font-weight: normal; color: #64748b;">${order.customer_email}</p>
            <p style="font-weight: normal; color: #64748b;">${order.customer_phone || ''}</p>
          </div>
          <div class="info-block" style="text-align: right;">
            <h4>Détails Facture</h4>
            <p><strong>N° Facture :</strong> ${order.invoice_number || ('INV-2026-' + order.id)}</p>
            <p style="font-weight: normal; color: #64748b;"><strong>Réf :</strong> ${order.reference}</p>
            <p style="font-weight: normal; color: #64748b;"><strong>Date :</strong> ${formattedDate}</p>
            <p style="font-weight: normal; color: #64748b;"><strong>Mode :</strong> ${order.payment_method === 'MANUAL_OM' ? 'Orange Money (+221 77 542 82 35)' : 'Wave (+221 77 542 82 35)'}</p>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description / Offre</th>
              <th>Qté</th>
              <th style="text-align: right;">Montant Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${order.pack_name}</strong><br>
                <span style="font-size: 12px; color: #64748b;">Accès officiel HORECA AFRICA 2026 Dakar (Novotel)</span>
              </td>
              <td>1</td>
              <td style="text-align: right; font-weight: 600;">${formattedAmount}</td>
            </tr>
            <tr class="total-row">
              <td colspan="2">TOTAL REÇU ACQUITTÉ</td>
              <td style="text-align: right;">${formattedAmount}</td>
            </tr>
          </tbody>
        </table>

        <!-- ACCESS ACTIVATED BOX -->
        <div class="access-box">
          <h3 style="margin: 0 0 8px 0; color: #047857; font-size: 16px;">
            🔑 VOS ACCÈS & BADGES PARTICIPANTS SONT ACTIVÉS !
          </h3>
          <p style="margin: 0 0 10px 0; font-size: 13.5px; color: #065f46; line-height: 1.5;">
            Félicitations ! L'administration HORECA AFRICA a validé votre règlement.<br>
            • <strong>Identifiant de Connexion :</strong> <code>${order.customer_email}</code><br>
            Vos droits d'accès au salon, à votre badge QR officiel et à la plateforme de Matchmaking B2B sont ouverts.
          </p>
          <div style="text-align: center; margin-top: 16px;">
            <a href="${loginUrl}" style="background: #033498; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 4px 12px rgba(3,52,152,0.25);">
              🌐 Me Connecter à Mon Compte Participant (${order.customer_email})
            </a>
          </div>
        </div>
      </div>

      <div class="footer">
        <p><strong>HORECA AFRICA 2026 ORGANISATION</strong></p>
        <p>Téléphone / Support Direct : <strong>+221 77 542 82 35</strong> | Email : contact@horecafrica.org</p>
        <p>Dakar, Sénégal - Hôtellerie, Restauration & Tourisme en Afrique</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

/**
 * 4. Send Invoice & Activated Access Email to Customer upon SuperAdmin Approval
 */
async function sendInvoiceEmail(order) {
  const htmlContent = generateInvoiceHtml(order);
  const invoiceNum = order.invoice_number || `INV-2026-${order.id}`;

  return await sendMailWithFallback({
    to: order.customer_email,
    subject: `[✓ ACCÈS VALIDÉS & Facture ${invoiceNum}] Votre Compte Participant HORECA AFRICA 2026 est Confirmé !`,
    html: htmlContent
  });
}

module.exports = {
  sendMailWithFallback,
  sendOrderReceiptEmail,
  sendAdminNewOrderNotification,
  generateInvoiceHtml,
  sendInvoiceEmail
};
