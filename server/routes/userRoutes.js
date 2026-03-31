const express = require('express');
const router = express.Router();
const controller = require('../controllers/userController');

router.get('/', controller.getAllUsers);
router.get('/:id', controller.getUserById);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.delete('/:id', controller.deleteUser);

// Authentication routes
router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);

module.exports = router;
