const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g. yourname@gmail.com
        pass: process.env.EMAIL_PASS, // App password (not your Gmail login)
    },
});

// ⛳ Tip: You can extract FRONTEND_URL into an env variable for reusability
const sendResetEmail = async (to, token) => {
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    try {
        const info = await transporter.sendMail({
            from: `"Asset Management" <${process.env.EMAIL_USER}>`,
            to,
            subject: '🔐 Password Reset Request',
            html: `
        <p>Hello,</p>
        <p>You recently requested to reset your password for your Asset Management account.</p>
        <p>Click the button below to reset it:</p>
        <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <br>
        <p>— Asset Management Team</p>
      `,
        });

        console.log('Reset email sent: %s', info.messageId);
    } catch (err) {
        console.error('Error sending reset email:', err);
        throw new Error('Failed to send reset email');
    }
};

module.exports = { sendResetEmail };



