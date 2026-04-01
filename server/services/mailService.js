const nodemailer = require('nodemailer');



const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    },
    // Add debug for testing
    debug: true,
    logger: true
});

exports.send = async (name, email) => {
    await transporter.sendMail({
        from: process.env.MAIL_USER,
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
        from: process.env.MAIL_USER,
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
