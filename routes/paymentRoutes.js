const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Direct Automated Wave API Checkout
router.post('/wave/checkout', paymentController.createWaveCheckout);

// Manual Transfer (Wave / Orange Money via +221 77 542 82 35)
router.post('/manual/submit', paymentController.submitManualPayment);

// SuperAdmin Get All Orders / Payments
router.get('/orders', paymentController.getAllOrders);

// SuperAdmin Manual Payment Approval & Invoice Email Trigger
router.post('/manual/verify', paymentController.verifyManualPayment);

// Verify Wave Session
router.get('/wave/session/:sessionId', paymentController.verifyWaveSession);

module.exports = router;
