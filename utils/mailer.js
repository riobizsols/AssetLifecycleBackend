const nodemailer = require('nodemailer');
const { FRONTEND_URL } = require('../config/environment');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g. yourname@gmail.com
        pass: process.env.EMAIL_PASS, // App password (not your Gmail login)
    },
});

const sendResetEmail = async (to, token, subdomain = null) => {
    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        const errorMsg = 'Email configuration missing: EMAIL_USER or EMAIL_PASS not set';
        console.error(`[Mailer] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }
    
    console.log(`[Mailer] 📧 Preparing to send password reset email to: ${to}${subdomain ? ` (tenant: ${subdomain})` : ''}`);
    
    // Build reset link with subdomain if provided (for multi-tenant support)
    let baseUrl = FRONTEND_URL.endsWith('/') ? FRONTEND_URL.slice(0, -1) : FRONTEND_URL;
    
    // If subdomain exists, include it in the reset link
    // This ensures users reset password in their tenant database
    if (subdomain) {
        // Extract domain from FRONTEND_URL (e.g., https://riowebworks.net -> riowebworks.net)
        try {
            const url = new URL(baseUrl);
            const domain = url.hostname.replace(/^www\./, ''); // Remove www. if present
            
            // For localhost, keep as is
            if (domain === 'localhost' || domain.includes('localhost')) {
                // For localhost, subdomain format is subdomain.localhost:port
                const port = url.port ? `:${url.port}` : '';
                baseUrl = `${url.protocol}//${subdomain}.${domain}${port}`;
            } else {
                // For production, use subdomain.domain format
                baseUrl = `${url.protocol}//${subdomain}.${domain}${url.port ? `:${url.port}` : ''}`;
            }
            console.log(`[Mailer] ✅ Built subdomain URL: ${baseUrl}`);
        } catch (urlError) {
            // If FRONTEND_URL is not a valid URL, try to construct subdomain URL manually
            console.warn(`[Mailer] ⚠️ Could not parse FRONTEND_URL, using subdomain directly: ${urlError.message}`);
            // Assume format like https://riowebworks.net
            const match = baseUrl.match(/^(https?:\/\/)([^\/]+)/);
            if (match) {
                const protocol = match[1];
                const domain = match[2].replace(/^www\./, '');
                baseUrl = `${protocol}${subdomain}.${domain}`;
                console.log(`[Mailer] ✅ Built subdomain URL (fallback): ${baseUrl}`);
            } else {
                console.error(`[Mailer] ❌ Could not construct subdomain URL from: ${baseUrl}`);
            }
        }
    } else {
        console.log(`[Mailer] No subdomain provided, using base URL: ${baseUrl}`);
    }
    
    const resetLink = `${baseUrl}/reset-password?token=${token}`;
    console.log(`[Mailer] 🔗 Reset link: ${resetLink}`);

    try {
        // Verify transporter is configured
        if (!transporter) {
            throw new Error('Email transporter not configured');
        }
        
        // Verify email credentials
        await transporter.verify();
        console.log(`[Mailer] ✅ Email transporter verified successfully`);
        
        const mailOptions = {
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
        };
        
        console.log(`[Mailer] 📤 Sending email to: ${to}`);
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[Mailer] ✅ Reset email sent successfully!`);
        console.log(`[Mailer] 📧 Message ID: ${info.messageId}`);
        console.log(`[Mailer] 📧 Response: ${info.response}`);
        
        return info;
    } catch (err) {
        console.error(`[Mailer] ❌ Error sending reset email:`, err);
        console.error(`[Mailer] ❌ Error code:`, err.code);
        console.error(`[Mailer] ❌ Error message:`, err.message);
        console.error(`[Mailer] ❌ Error stack:`, err.stack);
        
        // Provide more specific error messages
        if (err.code === 'EAUTH') {
            throw new Error('Email authentication failed. Please check EMAIL_USER and EMAIL_PASS in .env file.');
        } else if (err.code === 'ECONNECTION') {
            throw new Error('Could not connect to email server. Please check your internet connection.');
        } else if (err.responseCode) {
            throw new Error(`Email server error: ${err.responseCode} - ${err.response}`);
        } else {
            throw new Error(`Failed to send reset email: ${err.message}`);
        }
    }
};

// Import email service functions
const { sendWelcomeEmail, sendRoleAssignmentEmail, sendWorkflowNotificationToRole } = require('../services/emailService');

module.exports = { 
    sendResetEmail,
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole
};



