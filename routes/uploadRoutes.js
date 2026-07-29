const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');

router.post('/cv', uploadController.upload.single('cvFile'), uploadController.handleCvUpload);

module.exports = router;
