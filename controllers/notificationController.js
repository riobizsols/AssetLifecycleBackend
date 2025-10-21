const { 
  getMaintenanceNotifications, 
  getMaintenanceNotificationsByUser, 
  getNotificationStats 
} = require('../models/notificationModel');

// Get all maintenance notifications for an organization
const getAllNotifications = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    const notifications = await getMaintenanceNotifications(orgId);
    
    // Format the response for frontend
    const formattedNotifications = notifications.map(notification => ({
      id: notification.wfamsd_id,
      wfamshId: notification.wfamsh_id,
      userId: notification.user_id,
      sequence: notification.sequence,
      status: notification.detail_status,
      dueDate: notification.pl_sch_date,
      assetId: notification.asset_id,
      assetTypeName: notification.asset_type_name,
      userName: notification.user_name,
      userEmail: notification.user_email,
      cutoffDate: notification.cutoff_date,
      daysUntilDue: Math.floor(notification.days_until_due || 0),
      daysUntilCutoff: Math.floor(notification.days_until_cutoff || 0),
      isUrgent: notification.days_until_cutoff <= 0,
      isOverdue: notification.days_until_due <= 0,
      maintenanceType: notification.maint_type_name || 'Regular Maintenance' // Use actual maintenance type name from database
    }));

    res.json({
      success: true,
      message: 'Maintenance notifications retrieved successfully',
      data: formattedNotifications,
      count: formattedNotifications.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getAllNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve maintenance notifications',
      error: error.message
    });
  }
};

// Get maintenance notifications for a specific user
const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params; // This is now emp_int_id
    const orgId = req.query.orgId || 'ORG001';
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    console.log(`Fetching notifications for user: ${userId}, orgId: ${orgId}`);
    
    const notifications = await getMaintenanceNotificationsByUser(userId, orgId);
    
    console.log(`Found ${notifications.length} notifications for user ${userId}`);
    
    // Format the response for frontend
    const formattedNotifications = notifications.map(notification => ({
      id: notification.wfamsh_id, // Use wfamsh_id as unique identifier
      wfamshId: notification.wfamsh_id,
      userId: notification.current_action_role_id, // ROLE-BASED: Use role ID instead of user ID
      status: 'AP', // Current action user always has AP status
      dueDate: notification.pl_sch_date,
      assetId: notification.asset_id,
      assetTypeName: notification.asset_type_name,
      userName: notification.current_action_role_name || 'Unassigned', // ROLE-BASED: Show role name
      userEmail: null, // Roles don't have emails
      cutoffDate: notification.cutoff_date,
      daysUntilDue: Math.floor(notification.days_until_due || 0),
      daysUntilCutoff: Math.floor(notification.days_until_cutoff || 0),
      isUrgent: notification.days_until_cutoff <= 2, // Show urgent when 2 days or less until cutoff
      isOverdue: notification.days_until_due <= 0,
      maintenanceType: notification.maint_type_name || 'Regular Maintenance' // Use actual maintenance type name from database
    }));

    res.json({
      success: true,
      message: 'User maintenance notifications retrieved successfully',
      data: formattedNotifications,
      count: formattedNotifications.length,
      userId: userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getUserNotifications:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      userId: req.params.userId,
      orgId: req.query.orgId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user maintenance notifications',
      error: error.message,
      userId: req.params.userId
    });
  }
};

// Get notification statistics
const getNotificationStatistics = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    const stats = await getNotificationStats(orgId);
    
    res.json({
      success: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        totalNotifications: parseInt(stats.total_notifications) || 0,
        overdueNotifications: parseInt(stats.overdue_notifications) || 0,
        dueNotifications: parseInt(stats.due_notifications) || 0,
        upcomingNotifications: parseInt(stats.upcoming_notifications) || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getNotificationStatistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve notification statistics',
      error: error.message
    });
  }
};

// Get notifications with filters
const getFilteredNotifications = async (req, res) => {
  try {
    const orgId = req.query.orgId;
    const { status, urgency, assetType } = req.query;
    
    let notifications = await getMaintenanceNotifications(orgId);
    
    // Apply filters
    if (status) {
      notifications = notifications.filter(n => n.detail_status === status);
    }
    
    if (urgency === 'urgent') {
      notifications = notifications.filter(n => n.days_until_cutoff <= 0);
    } else if (urgency === 'upcoming') {
      notifications = notifications.filter(n => n.days_until_cutoff > 0);
    }
    
    if (assetType) {
      notifications = notifications.filter(n => n.asset_type_name.toLowerCase().includes(assetType.toLowerCase()));
    }
    
    // Format the response
    const formattedNotifications = notifications.map(notification => ({
      id: notification.wfamsd_id,
      wfamshId: notification.wfamsh_id,
      userId: notification.user_id,
      sequence: notification.sequence,
      status: notification.detail_status,
      dueDate: notification.pl_sch_date,
      assetId: notification.asset_id,
      assetTypeName: notification.asset_type_name,
      userName: notification.user_name,
      userEmail: notification.user_email,
      cutoffDate: notification.cutoff_date,
      daysUntilDue: Math.floor(notification.days_until_due || 0),
      daysUntilCutoff: Math.floor(notification.days_until_cutoff || 0),
      isUrgent: notification.days_until_cutoff <= 0,
      isOverdue: notification.days_until_due <= 0,
      maintenanceType: notification.maint_type_name || 'Regular Maintenance'
    }));

    res.json({
      success: true,
      message: 'Filtered maintenance notifications retrieved successfully',
      data: formattedNotifications,
      count: formattedNotifications.length,
      filters: { status, urgency, assetType },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in getFilteredNotifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve filtered notifications',
      error: error.message
    });
  }
};

module.exports = {
  getAllNotifications,
  getUserNotifications,
  getNotificationStatistics,
  getFilteredNotifications
}; 