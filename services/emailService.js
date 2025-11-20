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

// Send setup completion email with credentials and database details
const sendSetupCompletionEmail = async (setupData) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('[SetupWizard] Email not configured (EMAIL_USER or EMAIL_PASS not set), skipping setup completion email');
      return { success: false, error: 'Email service not configured' };
    }

    const {
      adminEmail,
      adminName,
      adminUsername,
      adminPassword,
      organizationName,
      orgId,
      dbConfig,
      summary,
      frontendUrl
    } = setupData;

    if (!adminEmail) {
      throw new Error('Admin email is required to send setup completion email');
    }

    // Build DATABASE_URL
    const databaseUrl = `postgresql://${dbConfig.user}:${encodeURIComponent(dbConfig.password)}@${dbConfig.host}:${dbConfig.port || 5432}/${dbConfig.database}`;

    // Build .env file content
    const envContent = `# Database Configuration
DATABASE_URL=${databaseUrl}

# Server Configuration
PORT=${process.env.PORT || 5000}
NODE_ENV=production

# JWT Secret (update this with your own secret)
JWT_SECRET=${process.env.JWT_SECRET || 'your-secret-key-change-this'}

# Email Configuration (if needed)
EMAIL_USER=${process.env.EMAIL_USER || ''}
EMAIL_PASS=${process.env.EMAIL_PASS || ''}

# Frontend URL
FRONTEND_URL=${frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000'}
`;

    const mailOptions = {
      from: `"Asset Lifecycle Management" <${process.env.EMAIL_USER || 'noreply@alm.com'}>`,
      to: adminEmail,
      subject: `✅ Setup Complete - ${organizationName} ALM System Ready`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { padding: 30px 20px; background-color: #f8f9fa; }
            .section { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .section h2 { color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
            .credential-box { background-color: #f0f4ff; padding: 15px; border-left: 4px solid #667eea; margin: 15px 0; border-radius: 4px; }
            .credential-item { margin: 10px 0; }
            .credential-label { font-weight: bold; color: #555; display: inline-block; width: 120px; }
            .credential-value { color: #333; font-family: 'Courier New', monospace; background-color: white; padding: 5px 10px; border-radius: 4px; }
            .warning-box { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .info-box { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .code-block { background-color: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; margin: 10px 0; }
            .summary-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .summary-item:last-child { border-bottom: none; }
            .summary-label { color: #666; }
            .summary-value { font-weight: bold; color: #333; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; }
            .button { display: inline-block; padding: 12px 24px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Setup Complete!</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px;">Your Asset Lifecycle Management System is Ready</p>
            </div>
            
            <div class="content">
              <div class="section">
                <h2>Hello ${adminName || adminUsername}!</h2>
                <p>Congratulations! Your <strong>${organizationName}</strong> Asset Lifecycle Management (ALM) system has been successfully set up and configured.</p>
                <p>Your organization ID: <strong>${orgId}</strong></p>
              </div>

              <div class="section">
                <h2>🔐 Admin Login Credentials</h2>
                <div class="credential-box">
                  <div class="credential-item">
                    <span class="credential-label">Username:</span>
                    <span class="credential-value">${adminUsername}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Email:</span>
                    <span class="credential-value">${adminEmail}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Password:</span>
                    <span class="credential-value">${adminPassword}</span>
                  </div>
                </div>
                <div class="warning-box">
                  <strong>⚠️ Important:</strong> Please save these credentials securely. Change your password after your first login for security purposes.
                </div>
              </div>

              <div class="section">
                <h2>📊 Setup Summary</h2>
                <div class="summary-item">
                  <span class="summary-label">Asset Types Created:</span>
                  <span class="summary-value">${summary.assetTypes || 0}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Products/Services Created:</span>
                  <span class="summary-value">${summary.prodServices || 0}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Audit Rules Configured:</span>
                  <span class="summary-value">${summary.auditRules || 0}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Branches Created:</span>
                  <span class="summary-value">${summary.branches || 0}</span>
                </div>
                <div class="summary-item">
                  <span class="summary-label">Departments Created:</span>
                  <span class="summary-value">${summary.departments || 0}</span>
                </div>
              </div>

              <div class="section">
                <h2>🗄️ Database Connection Details</h2>
                <div class="info-box">
                  <p><strong>Your database has been created and configured with all tables and initial data.</strong></p>
                  <p>To connect your backend to this database, update the <code>DATABASE_URL</code> in your backend <code>.env</code> file:</p>
                </div>
                <div class="credential-box">
                  <div class="credential-item">
                    <span class="credential-label">Host:</span>
                    <span class="credential-value">${dbConfig.host}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Port:</span>
                    <span class="credential-value">${dbConfig.port || 5432}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Database:</span>
                    <span class="credential-value">${dbConfig.database}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Username:</span>
                    <span class="credential-value">${dbConfig.user}</span>
                  </div>
                </div>
                <p><strong>DATABASE_URL:</strong></p>
                <div class="code-block">${databaseUrl}</div>
              </div>

              <div class="section">
                <h2>⚙️ Next Steps</h2>
                <ol style="line-height: 2;">
                  <li><strong>Configure Backend:</strong>
                    <ul>
                      <li>Copy the <code>DATABASE_URL</code> above</li>
                      <li>Update <code>AssetLifecycleBackend/.env</code> file with this connection string</li>
                      <li>Or use the .env file content provided below</li>
                    </ul>
                  </li>
                  <li><strong>Start Backend Server:</strong>
                    <div class="code-block">cd AssetLifecycleBackend<br>npm install<br>npm run dev</div>
                  </li>
                  <li><strong>Start Frontend Server:</strong>
                    <div class="code-block">cd AssetLifecycleWebFrontend<br>npm install<br>npm start</div>
                  </li>
                  <li><strong>Access the System:</strong>
                    <ul>
                      <li>Open your browser and navigate to: <strong>${frontendUrl || 'http://localhost:3000'}</strong></li>
                      <li>Log in using the credentials provided above</li>
                    </ul>
                  </li>
                </ol>
              </div>

              <div class="section">
                <h2>📄 Backend .env File Content</h2>
                <p>Copy and paste this into <code>AssetLifecycleBackend/.env</code>:</p>
                <div class="code-block">${envContent.replace(/\n/g, '<br>')}</div>
              </div>

              <div class="section">
                <h2>🔗 Quick Access</h2>
                <p style="text-align: center;">
                  <a href="${frontendUrl || 'http://localhost:3000'}" class="button">Go to Login Page</a>
                </p>
              </div>
            </div>

            <div class="footer">
              <p>This is an automated email from the Asset Lifecycle Management Setup Wizard.</p>
              <p>If you did not initiate this setup, please contact your system administrator immediately.</p>
              <p style="margin-top: 15px;">© ${new Date().getFullYear()} Asset Lifecycle Management System</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`[SetupWizard] Setup completion email sent to ${adminEmail}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('[SetupWizard] Error sending setup completion email:', error);
    // Don't throw - email failure shouldn't break the setup
    return { success: false, error: error.message };
  }
};

module.exports = {
    sendWelcomeEmail,
    sendRoleAssignmentEmail,
    sendWorkflowNotificationToRole,
    sendSetupCompletionEmail
};
