const nodemailer = require('nodemailer');
const { FRONTEND_URL } = require('../config/environment');

// Use existing mailer configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // e.g. yourname@gmail.com
        pass: process.env.EMAIL_PASS, // App password (not your Gmail login)
    },
});

// Send welcome email for new user with multiple roles
const sendWelcomeEmail = async (userData, roles, organizationName) => {
  try {
    const roleList = roles.map(role => `• ${role.job_role_name}`).join('\n');
    
    const mailOptions = {
      from: `"${organizationName}" <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🎉 Welcome to ${organizationName} - Your Account Details`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h1>Welcome to ${organizationName}!</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <h2>Hello ${userData.full_name},</h2>
            
            <p>Your account has been successfully created. Here are your login credentials:</p>
            
            <div style="background-color: white; padding: 15px; border-left: 4px solid #003366; margin: 20px 0;">
              <h3>Login Details:</h3>
              <p><strong>Email:</strong> ${userData.email}</p>
              <p><strong>Password:</strong> ${userData.generatedPassword}</p>
            </div>
            
            <div style="background-color: white; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
              <h3>Assigned Roles:</h3>
              <pre style="font-family: Arial, sans-serif; margin: 0;">${roleList}</pre>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border: 1px solid #ffeaa7; border-radius: 4px; margin: 20px 0;">
              <h4>🔒 Security Note:</h4>
              <p>Please change your password after your first login for security purposes.</p>
            </div>
            
            <p>You can now access the system using the credentials provided above.</p>
            
            <p>If you have any questions, please contact your system administrator.</p>
            
            <p>Best regards,<br>
            — ${organizationName} Team</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; color: #666;">
            This is an automated message. Please do not reply to this email.
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent: %s', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error: error.message };
  }
};

// Send role assignment email for existing user
const sendRoleAssignmentEmail = async (userData, newRoles, organizationName) => {
  try {
    const roleList = newRoles.map(role => `• ${role.job_role_name}`).join('\n');
    
    const mailOptions = {
      from: `"${organizationName}" <${process.env.EMAIL_USER}>`,
      to: userData.email,
      subject: `🔑 New Role Assignment - ${organizationName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
            <h1>New Role Assignment</h1>
          </div>
          
          <div style="padding: 20px; background-color: #f8f9fa;">
            <h2>Hello ${userData.full_name},</h2>
            
            <p>You have been assigned new role(s) in the ${organizationName} system:</p>
            
            <div style="background-color: white; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
              <h3>Newly Assigned Roles:</h3>
              <pre style="font-family: Arial, sans-serif; margin: 0;">${roleList}</pre>
            </div>
            
            <p>You can now access additional features and permissions based on your new role(s).</p>
            
            <p>If you have any questions about your new role(s), please contact your system administrator.</p>
            
            <p>Best regards,<br>
            — ${organizationName} Team</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; color: #666;">
            This is an automated message. Please do not reply to this email.
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Role assignment email sent: %s', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending role assignment email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendRoleAssignmentEmail
};
