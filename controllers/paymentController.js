const waveService = require('../services/waveService');

exports.createWaveCheckout = async (req, res) => {
  try {
    const { amount, packName, userEmail } = req.body;
    if (!amount) {
      return res.status(400).json({ error: 'Montant requis pour le paiement Wave' });
    }

    const reference = `HORECA-PACK-${Date.now()}`;
    const result = await waveService.createCheckoutSession({
      amount,
      currency: 'XOF',
      reference,
      success_url: 'http://localhost:5173/?payment=success',
      error_url: 'http://localhost:5173/?payment=error'
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
