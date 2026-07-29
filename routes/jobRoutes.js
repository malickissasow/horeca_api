const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

router.get('/', jobController.getAllJobs);
router.post('/', jobController.createJob);
router.post('/apply', jobController.applyToJob);
router.get('/applications', jobController.getJobApplications);

module.exports = router;
