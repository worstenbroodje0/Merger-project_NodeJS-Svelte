const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
// Temporarily disabled rate limiting for testing
const { authLimiter } = require('../middleware/security');

router.get('/', controller.getAllUsers);
router.get('/:id', controller.getUserById);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.delete('/:id', controller.deleteUser);

// Authentication routes (rate limiting temporarily disabled for testing)
router.post('/register', authLimiter, controller.register);
router.post('/login', authLimiter, controller.login);
router.post('/logout', controller.logout);

module.exports = router;
