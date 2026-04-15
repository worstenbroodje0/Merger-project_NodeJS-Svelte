const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const catchAsync = require('../utils/catchAsync');
const {
    getAllUsers,
    getUserById,
    getUserByEmail,
    insertUser,
    updateUserById,
    deleteUserById,
} = require('../db');

// Get all users
router.get('/users', catchAsync(async (req, res) => {
    const users = await getAllUsers();
    res.json({ status: 'success', data: users });
}));

// Get single user
router.get('/users/:id', catchAsync(async (req, res) => {
    const user = await getUserById(parseInt(req.params.id, 10));
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ status: 'success', data: user });
}));

// Create new user
router.post('/users', catchAsync(async (req, res) => {
    const { name, email, role_id } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash the temp password instead of storing it plain
    const hashedPassword = await bcrypt.hash('temp123', 10);

    const newUser = await insertUser({
        name,
        email,
        role_id: role_id || 2,
        password: hashedPassword,
    });

    res.status(201).json({ status: 'success', data: newUser });
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