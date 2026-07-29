const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');

router.get('/user/:userId', meetingController.getMeetingsForUser);
router.post('/', meetingController.createMeeting);
router.patch('/:id/status', meetingController.updateMeetingStatus);
router.put('/:id/note', meetingController.savePrivateNote);

module.exports = router;
