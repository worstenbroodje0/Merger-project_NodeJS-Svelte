const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');
// Temporarily disabled rate limiting for testing
const { generalLimiter, requireFields, requireRole, authLimiter } = require('../middleware/security');

router.get('/', controller.getAllUsers);
router.get('/:id', controller.getUserById);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.delete('/:id', requireRole('admin'), controller.deleteUser);

// Authentication routes (rate limiting temporarily disabled for testing)
router.post('/login', authLimiter,requireFields('email', 'password'), controller.login);
router.post('/register', authLimiter, requireFields('name', 'email', 'password'), controller.register);
router.post('/logout', controller.logout);

module.exports = router;
