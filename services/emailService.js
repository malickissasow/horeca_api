const nodemailer = require('nodemailer');

// Configure SMTP transport (using environment variables with fallback)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || 'contact@horecafrica.org',
    pass: process.env.SMTP_PASS || 'Horeca2026!'
  }
});

/**
 * Generate HTML Email Invoice Template
 */
function generateInvoiceHtml(order) {
  const formattedDate = new Date(order.created_at || Date.now()).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedAmount = Number(order.amount).toLocaleString('fr-FR') + ' FCFA';

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
      .badge-paid { display: inline-block; background: #22c55e; color: #ffffff; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 12px; text-transform: uppercase; margin-top: 15px; }
      .content { padding: 30px; }
      .info-grid { display: flex; justify-content: space-between; margin-bottom: 25px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
      .info-block h4 { margin: 0 0 6px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-block p { margin: 0; font-weight: 600; font-size: 14px; color: #1e293b; }
      .table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
      .table th { background: #f8fafc; color: #475569; text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
      .table td { padding: 14px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
      .total-row td { font-weight: bold; font-size: 16px; color: #033498; border-top: 2px solid #e2e8f0; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      .footer strong { color: #0f172a; }
    </style>
  </head>
  <body>
    <div class="invoice-card">
      <div class="header">
        <h1>HORECA AFRICA 2026</h1>
        <p>Salon International de l'Hôtellerie, Restauration & Alimentation</p>
        <span class="badge-paid">✓ REÇU DE PAIEMENT & FACTURE ACQUITTÉE</span>
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
                <span style="font-size: 12px; color: #64748b;">Accès officiel HORECA AFRICA 2026 Dakar</span>
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

        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0; font-size: 13px; color: #1e40af;">
            🎉 <strong>Félicitations !</strong> Votre paiement a été vérifié et validé avec succès par l'organisation HORECA AFRICA. Votre badge et vos accès sont activés.
          </p>
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
 * Send Invoice Email to Customer
 */
async function sendInvoiceEmail(order) {
  try {
    const htmlContent = generateInvoiceHtml(order);
    const invoiceNum = order.invoice_number || `INV-2026-${order.id}`;

    const mailOptions = {
      from: '"HORECA AFRICA 2026" <contact@horecafrica.org>',
      to: order.customer_email,
      subject: `[Facture Acquittée ${invoiceNum}] Votre Réservation HORECA AFRICA 2026 est Validée !`,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Invoice Email sent to ${order.customer_email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending invoice email:', error.message);
    // Return graceful status even if SMTP port is restricted on runner
    return { success: false, error: error.message };
  }
}

module.exports = {
  generateInvoiceHtml,
  sendInvoiceEmail
};
