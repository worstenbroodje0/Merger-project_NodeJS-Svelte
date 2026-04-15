const express = require('express');
const router = express.Router();
const catchAsync = require('../utils/catchAsync');
const {
    getAllUsers,
    updateUserById,
    deleteUserById,
} = require('../db');

// Get all users
router.get('/users', catchAsync(async (req, res) => {
    const users = await getAllUsers();
    res.json({ status: 'success', data: users });
}));

// Update user
router.put('/users/:id', catchAsync(async (req, res) => {
    const { name, email, role_id } = req.body;
    const userId = parseInt(req.params.id, 10);

    const updatedUser = await updateUserById(userId, { name, email, role_id });

    if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'success', data: updatedUser });
}));

// Delete user
router.delete('/users/:id', catchAsync(async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    const deleted = await deleteUserById(userId);
    if (!deleted) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ status: 'success', message: 'User deleted successfully' });
}));

module.exports = router;