# Email Configuration for Role Assignment Notifications

## Overview
The system now sends automated email notifications when roles are assigned to employees. This includes welcome emails for new users and role assignment emails for existing users.

## Required Environment Variables

The system uses the existing email configuration from `utils/mailer.js`. Ensure these variables are set in your `.env` file:

```env
# Email Configuration (existing variables)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## Email Types

### 1. Welcome Email (New Users)
- **Triggered when:** A new user is created and roles are assigned
- **Contains:** 
  - Login credentials (email + 8-digit random password)
  - List of assigned roles
  - Welcome message with organization name
  - Security note about changing password

### 2. Role Assignment Email (Existing Users)
- **Triggered when:** New roles are assigned to existing users
- **Contains:**
  - List of newly assigned roles
  - Notification about new permissions
  - Organization branding

## Features

- ✅ **Random 8-digit passwords** instead of "welcome"
- ✅ **Organization branding** in emails
- ✅ **Multiple role support** - single email for multiple roles
- ✅ **Smart email logic** - welcome vs role assignment
- ✅ **Error handling** - email failures don't break role assignment
- ✅ **Professional HTML templates** with styling

## Setup Instructions

1. **Configure email settings** in your `.env` file (uses existing `EMAIL_USER` and `EMAIL_PASS`)
2. **For Gmail:** Use App Passwords (not your regular password)
3. **Test email sending** by assigning roles to employees
4. **Customize templates** in `services/emailService.js` if needed

## Email Templates

The system uses professional HTML email templates with:
- Organization branding
- Clear role listings
- Security notes
- Responsive design
- Professional styling

## Troubleshooting

- **Email not sending:** Check email credentials and network connectivity
- **Authentication errors:** Verify EMAIL_USER and EMAIL_PASS
- **Template issues:** Check HTML syntax in emailService.js
- **Uses existing mailer:** The service integrates with your existing `utils/mailer.js` configuration
