const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateProfile);
router.delete('/:id', userController.deleteUser);
router.post('/contact', userController.submitContact);

module.exports = router;
