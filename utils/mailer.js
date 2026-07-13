const nodemailer = require('nodemailer');
const { FRONTEND_URL } = require('../config/environment');

function getEmailCredentials() {
    const user = (process.env.EMAIL_USER || '').trim();
    // Gmail App Passwords are often pasted with spaces — strip them
    const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    return { user, pass };
}

function createMailTransporter() {
    const { user, pass } = getEmailCredentials();

    return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
    });
}

function buildResetLink(token, subdomain = null, orgId = null) {
    let baseUrl = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;

    if (subdomain) {
        try {
            const url = new URL(baseUrl);
            const domain = url.hostname.replace(/^www\./, '');
            if (domain === 'localhost' || domain.includes('localhost')) {
                const port = url.port ? `:${url.port}` : '';
                baseUrl = `${url.protocol}//${subdomain}.${domain}${port}`;
            } else {
                baseUrl = `${url.protocol}//${subdomain}.${domain}${url.port ? `:${url.port}` : ''}`;
            }
        } catch (urlError) {
            const match = baseUrl.match(/^(https?:\/\/)([^/]+)/);
            if (match) {
                const protocol = match[1];
                const domain = match[2].replace(/^www\./, '');
                baseUrl = `${protocol}${subdomain}.${domain}`;
            } else {
                console.warn(`[Mailer] Could not construct subdomain URL: ${urlError.message}`);
            }
        }
    }

    const orgQuery = orgId ? `&org_id=${encodeURIComponent(orgId)}` : '';
    return `${baseUrl}/reset-password?token=${token}${orgQuery}`;
}

const sendResetEmail = async (to, token, subdomain = null) => {
    const { user, pass } = getEmailCredentials();
    if (!user || !pass) {
        const errorMsg = 'Email configuration missing: EMAIL_USER or EMAIL_PASS not set';
        console.error(`[Mailer] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const resetLink = buildResetLink(token, subdomain);
    // Always create a fresh transporter so .env changes apply without stale auth
    const transporter = createMailTransporter();

    try {
        const info = await transporter.sendMail({
            from: `"Asset Management" <${user}>`,
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
        console.log('[Mailer] Password reset link:', resetLink);

        return { resetLink, messageId: info.messageId };
    } catch (err) {
        // Always log the link so local/testing can proceed when Gmail auth fails
        console.error('[Mailer] Error sending reset email:', err);
        console.error('[Mailer] Password reset link (email failed — use manually if needed):', resetLink);

        if (err.code === 'EAUTH' || err.responseCode === 534 || err.responseCode === 535) {
            const authError = new Error(
                'Gmail rejected EMAIL_USER/EMAIL_PASS. Sign in to the Gmail account in a browser, then create a new App Password (Google Account → Security → 2-Step Verification → App passwords) and update EMAIL_PASS in .env.'
            );
            authError.code = 'EAUTH';
            authError.resetLink = resetLink;
            throw authError;
        }
        if (err.code === 'ECONNECTION') {
            const connectionError = new Error('Could not connect to email server. Please check your internet connection.');
            connectionError.resetLink = resetLink;
            throw connectionError;
        }
        const genericError = new Error(`Failed to send reset email: ${err.message}`);
        genericError.resetLink = resetLink;
        throw genericError;
    }
};

const { sendWelcomeEmail, sendRoleAssignmentEmail, sendWorkflowNotificationToRole } = require('../services/emailService');

module.exports = {
    sendResetEmail,
    buildResetLink,
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole,
};
