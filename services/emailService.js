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

// ROLE-BASED WORKFLOW: Send workflow notification to all users with a specific role
const sendWorkflowNotificationToRole = async (workflowData, jobRoleId, orgId = 'ORG001') => {
    try {
        const db = require('../config/db');
        
        console.log('Sending workflow notification to role:', jobRoleId);
        
        // Get all users with this job role
        const usersQuery = `
            SELECT u.user_id, u.emp_int_id, u.full_name, u.email, jr.text as job_role_name
            FROM "tblUserJobRoles" ujr
            INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
            INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
            WHERE ujr.job_role_id = $1 AND u.int_status = 1 AND u.email IS NOT NULL
        `;
        
        const usersResult = await db.query(usersQuery, [jobRoleId]);
        const users = usersResult.rows;
        
        if (users.length === 0) {
            console.log('No users found with role:', jobRoleId);
            return { success: false, message: 'No users found with specified role' };
        }
        
        console.log(`Found ${users.length} users with role ${jobRoleId}`);
        
        // Send email to each user
        const emailPromises = users.map(async (user) => {
            try {
                const mailOptions = {
                    from: `"Asset Management System" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: `🔔 Workflow Approval Required - ${workflowData.assetTypeName || 'Asset Maintenance'}`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <style>
                                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                                .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                                .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
                                .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-left: 3px solid #4CAF50; }
                                .label { font-weight: bold; color: #555; }
                                .value { color: #333; }
                                .urgent { color: #f44336; font-weight: bold; }
                                .button { display: inline-block; padding: 12px 24px; margin: 20px 0; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
                                .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h2>🔔 Workflow Approval Required</h2>
                                </div>
                                <div class="content">
                                    <p>Hello <strong>${user.full_name}</strong>,</p>
                                    <p>A workflow requires approval from your role: <strong>${user.job_role_name}</strong></p>
                                    <p>${workflowData.isUrgent ? '<span class="urgent">⚠️ URGENT: This maintenance is past the cutoff date!</span>' : ''}</p>
                                    
                                    <div class="detail-row">
                                        <span class="label">Asset Type:</span>
                                        <span class="value">${workflowData.assetTypeName || 'N/A'}</span>
                                    </div>
                                    
                                    <div class="detail-row">
                                        <span class="label">Maintenance Type:</span>
                                        <span class="value">${workflowData.maintenanceType || 'Regular Maintenance'}</span>
                                    </div>
                                    
                                    <div class="detail-row">
                                        <span class="label">Due Date:</span>
                                        <span class="value">${workflowData.dueDate ? new Date(workflowData.dueDate).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    
                                    <div class="detail-row">
                                        <span class="label">Days Until Due:</span>
                                        <span class="value">${workflowData.daysUntilDue || 0} days</span>
                                    </div>
                                    
                                    <p><strong>Note:</strong> Any ${user.job_role_name} can approve this workflow. The first person to approve will move the workflow forward.</p>
                                    
                                    <div style="text-align: center;">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/maintenance-approval" class="button">View & Approve</a>
                                    </div>
                                    
                                    <div class="footer">
                                        <p>This is an automated notification from Asset Management System.</p>
                                        <p>If you believe you received this email in error, please contact your system administrator.</p>
                                    </div>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                };
                
                await transporter.sendMail(mailOptions);
                console.log(`Workflow notification sent to ${user.email} (${user.full_name})`);
                return { success: true, email: user.email };
            } catch (error) {
                console.error(`Failed to send email to ${user.email}:`, error);
                return { success: false, email: user.email, error: error.message };
            }
        });
        
        const results = await Promise.all(emailPromises);
        const successCount = results.filter(r => r.success).length;
        
        console.log(`Workflow notifications sent: ${successCount}/${users.length} successful`);
        
        return {
            success: true,
            totalUsers: users.length,
            successCount: successCount,
            failCount: users.length - successCount,
            results: results
        };
        
    } catch (error) {
        console.error('Error in sendWorkflowNotificationToRole:', error);
        throw error;
    }
};

module.exports = {
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole
};
