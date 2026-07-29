const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/wave/checkout', paymentController.createWaveCheckout);
router.get('/wave/session/:sessionId', paymentController.verifyWaveSession);

module.exports = router;
