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

const sendOrganizationDeletionOtpEmail = async ({ to, organizationName, subdomain, otp }) => {
    const { user, pass } = getEmailCredentials();
    if (!user || !pass) {
        const errorMsg = 'Email configuration missing: EMAIL_USER or EMAIL_PASS not set';
        console.error(`[Mailer] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const transporter = createMailTransporter();
    const orgLabel = organizationName || subdomain || 'Your organization';

    try {
        const info = await transporter.sendMail({
            from: `"ALM Account Security" <${user}>`,
            to,
            subject: 'Organization Deletion Verification',
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <div style="background:#0E2F4B; color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
            <h2 style="margin:0; font-size:18px;">Organization Deletion Verification</h2>
          </div>
          <div style="border:1px solid #e5e7eb; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
            <p>We received a request to <strong>permanently delete</strong> your organization.</p>
            <p style="margin:16px 0;">
              <strong>Organization:</strong> ${orgLabel}<br/>
              ${subdomain ? `<strong>Subdomain:</strong> ${subdomain}<br/>` : ''}
            </p>
            <p style="color:#b45309; background:#fffbeb; border:1px solid #fcd34d; padding:12px; border-radius:6px;">
              Deleting the organization permanently removes all company data — users, assets, documents, and settings. This cannot be undone.
            </p>
            <p>Your verification code:</p>
            <p style="font-size:32px; letter-spacing:8px; font-weight:700; text-align:center; color:#0E2F4B; margin:24px 0;">
              ${otp}
            </p>
            <p style="color:#6b7280; font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color:#6b7280; font-size:14px;">If you did not request this, ignore this email. Your organization will remain unchanged.</p>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
            <p style="font-size:12px; color:#9ca3af; margin:0;">— ALM Security Team</p>
          </div>
        </div>
      `,
            text: `Organization Deletion Verification

We received a request to permanently delete your organization: ${orgLabel}${subdomain ? ` (${subdomain})` : ''}.

Your verification code: ${otp}
This code expires in 10 minutes.

Deleting the organization permanently removes all data.

If you did not request this, ignore this email.`,
        });

        console.log('[Mailer] Organization deletion OTP email sent:', info.messageId);
        return { messageId: info.messageId };
    } catch (err) {
        console.error('[Mailer] Error sending organization deletion OTP:', err);
        // Still log OTP in non-production for local testing when SMTP fails
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[Mailer] DEV OTP (email failed):', otp);
        }
        throw new Error(`Failed to send verification email: ${err.message}`);
    }
};

const sendOrganizationDeletedEmail = async ({ to, organizationName, subdomain }) => {
    const { user, pass } = getEmailCredentials();
    if (!user || !pass) {
        const errorMsg = 'Email configuration missing: EMAIL_USER or EMAIL_PASS not set';
        console.error(`[Mailer] ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const transporter = createMailTransporter();
    const orgLabel = organizationName || subdomain || 'Your organization';
    const subdomainLine = subdomain ? `<strong>Subdomain:</strong> ${subdomain}<br/>` : '';
    const subdomainText = subdomain ? ` (${subdomain})` : '';

    try {
        const info = await transporter.sendMail({
            from: `"ALM Account Security" <${user}>`,
            to,
            subject: 'Organization Account Deleted',
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
          <div style="background:#0E2F4B; color:#fff; padding:20px 24px; border-radius:8px 8px 0 0;">
            <h2 style="margin:0; font-size:18px;">Organization Account Deleted</h2>
          </div>
          <div style="border:1px solid #e5e7eb; border-top:none; padding:24px; border-radius:0 0 8px 8px;">
            <p>This email confirms that your organization account has been <strong>permanently deleted</strong>.</p>
            <p style="margin:16px 0;">
              <strong>Organization:</strong> ${orgLabel}<br/>
              ${subdomainLine}
            </p>
            <p style="color:#991b1b; background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:6px;">
              All associated data — including users, assets, documents, and settings — has been permanently removed and cannot be restored.
            </p>
            <p>If you did not authorize this deletion, contact ALM support immediately.</p>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
            <p style="font-size:12px; color:#9ca3af; margin:0;">— ALM Security Team</p>
          </div>
        </div>
      `,
            text: `Organization Account Deleted

This email confirms that your organization account has been permanently deleted.

Organization: ${orgLabel}${subdomainText}

All associated data — including users, assets, documents, and settings — has been permanently removed and cannot be restored.

If you did not authorize this deletion, contact ALM support immediately.

— ALM Security Team`,
        });

        console.log('[Mailer] Organization deleted confirmation email sent:', info.messageId);
        return { messageId: info.messageId };
    } catch (err) {
        console.error('[Mailer] Error sending organization deleted confirmation:', err);
        throw new Error(`Failed to send deletion confirmation email: ${err.message}`);
    }
};

const { sendWelcomeEmail, sendRoleAssignmentEmail, sendWorkflowNotificationToRole } = require('../services/emailService');

module.exports = {
    sendResetEmail,
    buildResetLink,
    sendOrganizationDeletionOtpEmail,
    sendOrganizationDeletedEmail,
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole,
};
