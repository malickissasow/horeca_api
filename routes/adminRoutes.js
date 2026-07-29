const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

router.get('/stats', adminController.getAdminStats);
router.get('/meetings', adminController.getAllMeetingsMaster);
router.get('/contacts', adminController.getContacts);
router.post('/contact', adminController.submitContact);

module.exports = router;
