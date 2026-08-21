const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');

// Direct Automated Wave API Checkout
router.post('/wave/checkout', paymentController.createWaveCheckout);

// Verify Wave Session (Polling & Direct Verification)
router.get('/wave/verify/:reference', paymentController.verifyWaveSession);
router.get('/wave/session/:sessionId', paymentController.verifyWaveSession);

// Webhook for Wave API Server Notifications
router.post('/webhook/wave', webhookController.handleWaveWebhook);

// Manual Transfer (Wave / Orange Money via +221 76 420 52 16)
router.post('/manual/submit', paymentController.submitManualPayment);

// SuperAdmin Get All Orders / Payments
router.get('/orders', paymentController.getAllOrders);

// SuperAdmin Manual Payment Approval & Invoice Email Trigger
router.post('/manual/verify', paymentController.verifyManualPayment);

// Resend Invoice & Access Email
router.get('/resend-email', paymentController.resendEmail);
router.post('/resend-email', paymentController.resendEmail);

module.exports = router;
