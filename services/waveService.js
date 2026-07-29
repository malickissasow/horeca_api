const axios = require('axios');
const https = require('https');

class WaveService {
  constructor() {
    this.baseURL = process.env.WAVE_API_URL || 'https://api.wave.com/v1';
    this.token = process.env.WAVE_API_TOKEN;

    if (!this.token) {
      console.warn('⚠️ WAVE_API_TOKEN manquant - Service Wave non disponible');
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

  async createCheckoutSession({ amount, currency = 'XOF', reference, error_url, success_url }) {
    if (!this.enabled) {
      return { success: false, error: 'Token Wave non configuré sur le serveur' };
    }

    try {
      const payload = {
        amount: amount.toString(),
        currency: currency,
        client_reference: reference || `HORECA-${Date.now()}`,
        success_url: success_url || 'https://horecafrica.com/payment-success',
        error_url: error_url || 'https://horecafrica.com/payment-error'
      };

      // Wave requires valid HTTPS format for URLs
      if (payload.success_url.includes('localhost')) {
        payload.success_url = 'https://horecafrica.com/payment-success';
      }
      if (payload.error_url.includes('localhost')) {
        payload.error_url = 'https://horecafrica.com/payment-error';
      }

      console.log('🌊 Wave Checkout Request Payload:', payload);

      const response = await this.client.post('/checkout/sessions', payload);
      console.log('🌊 Wave Checkout Response Code:', response.status);

      return {
        success: true,
        sessionId: response.data.id,
        wave_launch_url: response.data.wave_launch_url,
        data: response.data
      };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message;
      console.error('❌ Wave Checkout Error:', error.response?.data || error.message);
      return {
        success: false,
        error: errorMsg,
        details: error.response?.data
      };
    }
  }

  async getCheckoutSession(sessionId) {
    if (!this.enabled) return { success: false, error: 'Service Wave non configuré' };
    try {
      const response = await this.client.get(`/checkout/sessions/${sessionId}`);
      return {
        success: true,
        status: response.data.payment_status,
        isPaid: response.data.payment_status === 'succeeded',
        data: response.data
      };
    } catch (error) {
      console.error('❌ Wave Session Check Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WaveService();
