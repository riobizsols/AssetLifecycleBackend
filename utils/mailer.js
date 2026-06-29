const nodemailer = require('nodemailer');
const { FRONTEND_URL } = require('../config/environment');

function createMailTransporter() {
    const user = (process.env.EMAIL_USER || '').trim();
    const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
    });
}

const transporter = createMailTransporter();

function buildResetLink(token, orgId = null) {
    const baseUrl = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;
    const orgQuery = orgId ? `&org_id=${encodeURIComponent(orgId)}` : '';
    return `${baseUrl}/reset-password?token=${token}${orgQuery}`;
}

const sendResetEmail = async (to, token, orgId = null) => {
    const resetLink = buildResetLink(token, orgId);
    const fromUser = (process.env.EMAIL_USER || '').trim();

    try {
        const info = await transporter.sendMail({
            from: `"Asset Management" <${fromUser}>`,
            to,
            subject: 'Password Reset Request',
            html: `
        <p>Hello,</p>
        <p>You recently requested to reset your password for your Asset Management account.</p>
        <p>Click the button below to reset it:</p>
        <p><a href="${resetLink}" style="padding: 10px 15px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>Or copy this link: ${resetLink}</p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <br>
        <p>— Asset Management Team</p>
      `,
        });

        console.log('Reset email sent: %s', info.messageId);
        if (process.env.NODE_ENV !== 'production') {
            console.log('[Dev] Password reset link:', resetLink);
        }

        return { resetLink, messageId: info.messageId };
    } catch (err) {
        console.error('Error sending reset email:', err);
        throw new Error('Failed to send reset email');
    }
};
// Import email service functions
const { sendWelcomeEmail, sendRoleAssignmentEmail, sendWorkflowNotificationToRole } = require('../services/emailService');

module.exports = { 
    sendResetEmail,
    buildResetLink,
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole
};


