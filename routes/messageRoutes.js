const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');

router.get('/:user1/:user2', messageController.getMessages);
router.post('/', messageController.sendMessage);

module.exports = router;
