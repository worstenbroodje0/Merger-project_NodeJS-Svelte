const catchAsync = require("../utils/catchAsync");
const { getUsersData, getUserById, getUserByEmail, insertUser, updateUserById, deleteUserById } = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.getAllUsers = catchAsync(async (req, res) => {
    const allUsers = await getUsersData();
    res.json({ status: 'success', results: allUsers.length, data: allUsers });
});

exports.getUserById = catchAsync(async (req, res) => {
    const user = await getUserById(req.params.id);
    if (!user) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
    }
    res.json({ status: 'success', data: user });
});

exports.createUser = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return res.status(400).json({ status: 'error', message: 'User with this email already exists' });
    }

    // Validate required fields
    if (!name || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await insertUser({ name, email, password: hashedPassword });
    res.status(201).json({ status: 'success', data: newUser });
});

exports.updateUser = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;
    const userId = req.params.id;

    // Check if user exists
    const existingUser = await getUserById(userId);
    if (!existingUser) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== existingUser.email) {
        const emailExists = await getUserByEmail(email);
        if (emailExists) {
            return res.status(400).json({ status: 'error', message: 'Email already in use' });
        }
    }

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (password !== undefined) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.password = hashedPassword;
    }

    const updatedUser = await updateUserById(userId, updateFields);
    res.json({ status: 'success', data: updatedUser });
});

exports.deleteUser = catchAsync(async (req, res) => {
    const userId = req.params.id;

    // Check if user exists
    const existingUser = await getUserById(userId);
    if (!existingUser) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    await deleteUserById(userId);
    res.json({ status: 'success', message: 'User deleted successfully' });
});

// Register function (alias for createUser)
exports.register = catchAsync(async (req, res) => {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        return res.status(400).json({ status: 'error', message: 'User with this email already exists' });
    }

    // Validate required fields
    if (!name || !email || !password) {
        return res.status(400).json({ status: 'error', message: 'Name, email, and password are required' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await insertUser({ name, email, password: hashedPassword, role: 'user' });

    // Create JWT token
    const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );

    res.status(201).json({
        status: 'success',
        data: {
            user: { id: newUser.id, uuid: newUser.uuid, name: newUser.name, email: newUser.email, role: newUser.role },
            token
        }
    });
});

// Login function
exports.login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
        return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    // Find user by email
    const user = await getUserByEmail(email);
    if (!user) {
        return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
    );

    res.json({
        status: 'success',
        data: {
            user: { id: user.id, uuid: user.uuid, name: user.name, email: user.email, role: user.role },
            token
        }
    });
});

// Logout function (client-side token removal)
exports.logout = catchAsync(async (req, res) => {
    // In a stateless JWT implementation, logout is handled client-side
    // The client should remove the token from storage
    res.json({ status: 'success', message: 'Logout successful. Please remove token from client storage.' });
});