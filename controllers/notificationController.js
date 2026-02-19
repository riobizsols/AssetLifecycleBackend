const { 
  getMaintenanceNotifications, 
  getMaintenanceNotificationsByUser, 
  getNotificationStats 
} = require('../models/notificationModel');

// Get all maintenance notifications for an organization
const getAllNotifications = async (req, res) => {
  try {
    const orgId = req.query.orgId || req.user?.org_id;
    const branchId = req.user?.branch_id;
    const notifications = await getMaintenanceNotifications(orgId, branchId, req.user?.hasSuperAccess || false);
    
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
      maintenanceType: notification.maint_type_name || 'Regular Maintenance', // Use actual maintenance type name from database
      // Group asset maintenance information
      groupId: notification.group_id || null,
      groupName: notification.group_name || null,
      groupAssetCount: notification.group_asset_count ? parseInt(notification.group_asset_count) : null,
      isGroupMaintenance: !!notification.group_id
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
    const orgId = req.query.orgId || req.user?.org_id || 'ORG001';
    const branchId = req.user?.branch_id;
    
    console.log('🐛 [getUserNotifications] Starting...');
    console.log('🐛 [getUserNotifications] userId:', userId);
    console.log('🐛 [getUserNotifications] orgId:', orgId);
    console.log('🐛 [getUserNotifications] branchId:', branchId);
    console.log('🐛 [getUserNotifications] req.user:', req.user);
    
    if (!userId) {
      console.log('🐛 [getUserNotifications] ERROR: No userId provided');
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    console.log(`🐛 [getUserNotifications] Fetching notifications for user: ${userId}, orgId: ${orgId}, branchId: ${branchId}`);
    
    const notifications = await getMaintenanceNotificationsByUser(userId, orgId, branchId, req.user?.hasSuperAccess || false);
    
    console.log(`🐛 [getUserNotifications] Found ${notifications.length} notifications for user ${userId}`);
    console.log('🐛 [getUserNotifications] First 3 notifications:', notifications.slice(0, 3));
    
    // Format the response for frontend
    const formattedNotifications = notifications.map(notification => ({
      // Common fields
      id: notification.wfamsh_id, // Unique workflow identifier
      wfamshId: notification.wfamsh_id,
      workflowId: notification.wfamsh_id,
      workflowType: 
        notification.maint_type_id === 'SCRAP' ? 'SCRAP' : 
        notification.maint_type_id === 'INSPECTION' ? 'INSPECTION' : 
        'MAINTENANCE',
      route:
        notification.maint_type_id === 'SCRAP'
          ? `/scrap-approval-detail/${notification.wfamsh_id}?context=SCRAPMAINTENANCEAPPROVAL`
          : notification.maint_type_id === 'INSPECTION'
          ? `/inspection-approval-detail/${notification.wfamsh_id}`
          : `/approval-detail/${notification.wfamsh_id}`,

      // ROLE-BASED: Use role ID/name instead of a specific user
      userId: notification.current_action_role_id,
      userName: notification.current_action_role_name || 'Unassigned',
      userEmail: null,
      status: 'AP',

      // Dates / urgency
      dueDate: notification.pl_sch_date,
      cutoffDate: notification.cutoff_date,
      daysUntilDue: Math.floor(notification.days_until_due || 0),
      daysUntilCutoff: Math.floor(notification.days_until_cutoff || 0),
      isUrgent: Math.floor(notification.days_until_cutoff || 0) <= 2,
      isOverdue: Math.floor(notification.days_until_due || 0) <= 0,

      // Display labels
      maintenanceType: notification.maint_type_name || 'Regular Maintenance',
      assetId: notification.asset_id,
      assetTypeName: notification.asset_type_name,

      // Group info (also used for scrap group requests)
      groupId: notification.group_id || null,
      groupName: notification.group_name || null,
      groupAssetCount: notification.group_asset_count ? parseInt(notification.group_asset_count) : null,
      isGroupMaintenance: !!notification.group_id
    }));

    console.log('🐛 [getUserNotifications] Formatted notifications count:', formattedNotifications.length);
    console.log('🐛 [getUserNotifications] First 3 formatted notifications:', formattedNotifications.slice(0, 3));

    res.json({
      success: true,
      message: 'User maintenance notifications retrieved successfully',
      data: formattedNotifications,
      count: formattedNotifications.length,
      userId: userId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('🐛 [getUserNotifications] ERROR in getUserNotifications:', error);
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
    const orgId = req.query.orgId || req.user?.org_id;
    const branchId = req.user?.branch_id;
    const stats = await getNotificationStats(orgId, branchId);
    
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
    const orgId = req.query.orgId || req.user?.org_id;
    const branchId = req.user?.branch_id;
    const { status, urgency, assetType } = req.query;
    
    let notifications = await getMaintenanceNotifications(orgId, branchId, req.user?.hasSuperAccess || false);
    
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
      maintenanceType: notification.maint_type_name || 'Regular Maintenance',
      // Group asset maintenance information
      groupId: notification.group_id || null,
      groupName: notification.group_name || null,
      groupAssetCount: notification.group_asset_count ? parseInt(notification.group_asset_count) : null,
      isGroupMaintenance: !!notification.group_id
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