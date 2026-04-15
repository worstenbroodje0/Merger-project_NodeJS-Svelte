// mailController.js
const bcrypt = require('bcrypt');
const mailService = require('../services/mailService');
const db = require('../db');
const { getUserByEmail, getUsersData, updateUserById } = require('../db');
const crypto = require('crypto');

exports.sendMail = async (req, res) => {

    const { name, email } = req.body;

    // Validate required fields
    if (!name || !email) {
        return res.status(400).json({ error: "Missing required fields: name, email" });
    }

    try {
        await mailService.send(name, email);
        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Mail error:', err);
        res.status(500).json({ error: "Mail failed" });
    }
};

// Forgot password function
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    // Validate required fields
    if (!email) {
        return res.status(400).json({ status: 'error', message: 'Email is required' });
    }

    // Find user by email
    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration attacks
    if (!user) {
        return res.status(200).json({ status: 'success', message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Update user with reset token
    await updateUserById(user.id, {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires
    });

    // Create reset link
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // Send reset email
    try {
        await mailService.sendResetLink(email, resetLink);
        res.status(200).json({ status: 'success', message: 'Password reset link sent to your email.' });
    } catch (emailError) {
        console.error('Reset email failed:', emailError);
        res.status(500).json({ status: 'error', message: 'Failed to send reset email. Please try again later.' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        console.log('[resetPassword] Missing fields:', { token: !!token, password: !!password });
        return res.status(400).json({ error: 'Token and password are required' });
    }

    try {
        // Find user by reset token using Drizzle ORM
        const allUsers = await getUsersData();
        console.log('[resetPassword] All users:', allUsers);
        console.log('[resetPassword] Looking for token:', token);
        const user = allUsers.find(u => {
            console.log('[resetPassword] Checking user:', u.email, 'has reset_token:', !!u.reset_token, 'token matches:', u.reset_token === token);
            return u.reset_token === token &&
                u.reset_token_expires &&
                new Date(u.reset_token_expires) > new Date()
        });

        console.log('[resetPassword] Found user:', !!user);
        if (!user) {
            console.log('[resetPassword] Token validation failed');
            return res.status(400).json({ error: 'Token is invalid or has expired' });
        }

        const hashed = await bcrypt.hash(password, 12);

        // Update user password and clear reset token using Drizzle ORM
        await updateUserById(user.id, {
            password: hashed,
            reset_token: null,
            reset_token_expires: null
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
};