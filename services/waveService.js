const axios = require('axios');
const https = require('https');

class WaveService {
  constructor() {
    this.baseURL = process.env.WAVE_API_URL || 'https://api.wave.com/v1';
    this.token = process.env.WAVE_API_TOKEN;

    if (!this.token) {
      console.warn('⚠️ WAVE_API_TOKEN manquant dans .env - Service Wave désactivé');
      this.enabled = false;
      return;
    }

    this.enabled = true;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000,
      httpsAgent: new https.Agent({
        keepAlive: true,
        rejectUnauthorized: true
      }),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.token}`
      }
    });
  }

  /**
   * Créer une session de paiement Wave (Checkout Session)
   */
  async createCheckoutSession({ amount, currency = 'XOF', reference, description, success_url, error_url }) {
    if (!this.enabled) {
      return { success: false, error: 'Token Wave non configuré sur le serveur backend' };
    }

    try {
      const payload = {
        amount: amount.toString(), // Wave exige une chaîne de caractères (ex: "5000")
        currency: currency,
        client_reference: reference || `HORECA-PAY-${Date.now()}`,
        success_url: success_url || `${process.env.FRONTEND_URL || 'https://horecafrica.com'}/payment-status?status=success&ref=${reference}`,
        error_url: error_url || `${process.env.FRONTEND_URL || 'https://horecafrica.com'}/payment-status?status=error&ref=${reference}`
      };

      // Règle Wave : En environnement de dev (localhost), Wave exige une URL avec TLD/HTTPS valide.
      if (payload.success_url.includes('localhost')) {
        payload.success_url = 'https://horecafrica.com/payment-success-placeholder';
      }
      if (payload.error_url.includes('localhost')) {
        payload.error_url = 'https://horecafrica.com/payment-error-placeholder';
      }

      console.log('🌊 [WaveService] Envoi requête Checkout:', payload);

      const response = await this.client.post('/checkout/sessions', payload);
      console.log('🌊 [WaveService] Réponse Checkout HTTP Status:', response.status);

      return {
        success: true,
        transaction_id: response.data.id,
        sessionId: response.data.id,
        wave_launch_url: response.data.wave_launch_url, // URL profonde pour ouvrir l'application Wave mobile
        uri: response.data.uri,                         // URI pour génération QR code
        data: response.data
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('❌ [WaveService] Erreur Création Session:', error.response?.data || error.message);
      return {
        success: false,
        error: errorMsg,
        details: error.response?.data
      };
    }
  }

  /**
   * Interroger le statut d'une session Checkout Wave (Méthode de vérification directe / Polling)
   */
  async getCheckoutSession(sessionId) {
    if (!this.enabled) return { success: false, error: 'Service Wave non configuré' };

    try {
      const response = await this.client.get(`/checkout/sessions/${sessionId}`);
      const status = response.data.payment_status; // Ex: 'succeeded', 'processing', 'cancelled'

      return {
        success: true,
        status: status,
        is_paid: status === 'succeeded',
        isPaid: status === 'succeeded',
        data: response.data
      };
    } catch (error) {
      console.error('❌ [WaveService] Erreur vérification session:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Récupérer le solde du compte Wave Merchant HORECA
   */
  async getWaveAccountBalance() {
    if (!this.enabled) return { amount: 0, currency: 'XOF', error: 'Service disabled' };

    try {
      const response = await this.client.get('/balance');
      return {
        success: true,
        amount: response.data.amount,
        currency: response.data.currency
      };
    } catch (error) {
      console.error('❌ [WaveService] Erreur récupération solde:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WaveService();
