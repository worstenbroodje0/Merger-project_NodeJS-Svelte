const nodemailer = require('nodemailer');

// Toggle for Mailtrap (development) vs Gmail (production)
const USE_MAILTRAP = true; // Set to false to use Gmail again

// Mailtrap configuration (for development/testing)
const mailtrapTransporter = nodemailer.createTransport({
    host: 'sandbox.smtp.mailtrap.io',
    port: 2525,
    auth: {
        user: process.env.MAILTRAP_USER,
        pass: process.env.MAILTRAP_PASS
    },
    debug: true,
    logger: true
});

// Gmail configuration (for production)
const gmailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    debug: true,
    logger: true
});

// Choose transporter based on USE_MAILTRAP flag
const transporter = USE_MAILTRAP ? mailtrapTransporter : gmailTransporter;

exports.send = async (name, email) => {
    await transporter.sendMail({
        from: USE_MAILTRAP ? 'test@demo.com' : process.env.MAIL_USER,
        to: email,
        subject: 'Welcome!',
        html: `
            <p>Welcome ${name}!</p>
            <p>Thank you for registering.</p>
        `
    });
};

exports.sendResetLink = async (email, resetLink) => {
    await transporter.sendMail({
        from: USE_MAILTRAP ? 'test@demo.com' : process.env.MAIL_USER,
        to: email,
        subject: 'Password Reset Request',
        html: `
            <p>You requested a password reset.</p>
            <p>Click the link below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>If you didn't request this, you can ignore this email.</p>
        `
    });
};
