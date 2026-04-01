const crypto = require('crypto');
const mailService = require('../services/mailService');
const db = require('../db');

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    try {
        const [rows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (!rows.length) return res.status(200).json({ success: true });

        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 1000 * 60 * 60);

        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE email = ?',
            [token, expires, email]
        );

        const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
        await mailService.sendResetLink(email, resetLink);

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ error: 'Something went wrong' });
    }
};