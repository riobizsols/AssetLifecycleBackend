const { 
  getMaintenanceNotifications, 
  getMaintenanceNotificationsByUser, 
  getNotificationStats 
} = require('../models/notificationModel');
const {
  getWarrantyNotificationsByUser,
  markWarrantyNotificationOpen,
  discardWarrantyNotification,
  snoozeWarrantyNotification,
  mapStatus,
} = require('../models/assetWarrantyNotifyModel');
const {
  getExpiryNotificationsByUser,
  markExpiryNotificationOpen,
  discardExpiryNotification,
  snoozeExpiryNotification,
  mapStatus: mapExpiryStatus,
} = require('../models/assetExpiryNotifyModel');
const scrapMaintenanceModel = require('../models/scrapMaintenanceModel');

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
    
    const notifications = await getMaintenanceNotificationsByUser(
      userId,
      orgId,
      branchId,
      req.user?.hasSuperAccess || false,
      req.user?.job_role_id || null
    );
    const warrantyNotifications = await getWarrantyNotificationsByUser({
      empIntId: userId,
      orgId,
      branchId,
      hasSuperAccess: req.user?.hasSuperAccess || false,
    });
    const expiryNotifications = await getExpiryNotificationsByUser({
      empIntId: userId,
      orgId,
      branchId,
      hasSuperAccess: req.user?.hasSuperAccess || false,
    });
    
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
    const formatExpiryNotification = (notification, workflowType, maintenanceType, userLabel, dateField) => {
      const status = mapStatus(notification.status);
      const isVendorMaintained = !!notification.service_vendor_id;
      const targetDate = notification[dateField];
      const daysUntilExpiry = Math.floor(
        (new Date(targetDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      const isExpired =
        workflowType === "WARRANTY" &&
        (daysUntilExpiry < 0 || String(notification.title || "").toLowerCase() === "warranty expired");

      return {
        id: notification.notify_id,
        wfamshId: null,
        workflowId: notification.notify_id,
        workflowType,
        route: `/asset-detail/${notification.asset_id}`,
        userId: userId,
        userName: userLabel,
        userEmail: null,
        status,
        dueDate: targetDate,
        cutoffDate: targetDate,
        daysUntilDue: daysUntilExpiry,
        daysUntilCutoff: daysUntilExpiry,
        isUrgent: isExpired || daysUntilExpiry <= 2,
        isOverdue: workflowType === "WARRANTY" ? isExpired : daysUntilExpiry <= 0,
        maintenanceType: isExpired ? "Warranty Expired" : maintenanceType,
        assetId: notification.asset_id,
        assetTypeName: notification.asset_type_name || "Asset",
        isGroupMaintenance: false,
        groupId: null,
        groupName: null,
        groupAssetCount: null,
        notifyId: notification.notify_id,
        notificationStatus: status,
        title: notification.title || (isExpired ? "Warranty Expired" : maintenanceType),
        body: notification.body || "",
        canChangeVendor: isVendorMaintained,
      };
    };

    const formattedWarrantyNotifications = warrantyNotifications.map((notification) =>
      formatExpiryNotification(
        notification,
        "WARRANTY",
        "Warranty Expiry",
        "Warranty Alert",
        "warranty_period"
      )
    );

    const formattedExpiryNotifications = expiryNotifications.map((notification) => {
      const status = mapExpiryStatus(notification.status);
      const daysUntilExpiry = Math.floor(
        (new Date(notification.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      const isExpired =
        daysUntilExpiry < 0 || String(notification.title || "").toLowerCase() === "asset expired";

      return {
        id: notification.notify_id,
        wfamshId: null,
        workflowId: notification.notify_id,
        workflowType: "ASSET_EXPIRY",
        route: `/asset-detail/${notification.asset_id}`,
        userId: userId,
        userName: "Asset Expiry Alert",
        userEmail: null,
        status,
        dueDate: notification.expiry_date,
        cutoffDate: notification.expiry_date,
        daysUntilDue: daysUntilExpiry,
        daysUntilCutoff: daysUntilExpiry,
        isUrgent: isExpired || daysUntilExpiry <= 2,
        isOverdue: isExpired,
        maintenanceType: isExpired ? "Asset Expired" : "Asset Expiry",
        assetId: notification.asset_id,
        assetTypeName: notification.asset_type_name || "Asset",
        isGroupMaintenance: false,
        groupId: null,
        groupName: null,
        groupAssetCount: null,
        notifyId: notification.notify_id,
        notificationStatus: status,
        title: notification.title || (isExpired ? "Asset Expired" : "Asset Expiry"),
        body: notification.body || "",
        canExtendExpiry: true,
        canScrap: true,
      };
    });

    console.log('🐛 [getUserNotifications] Formatted notifications count:', formattedNotifications.length);
    console.log('🐛 [getUserNotifications] First 3 formatted notifications:', formattedNotifications.slice(0, 3));

    res.json({
      success: true,
      message: 'User maintenance notifications retrieved successfully',
      data: [
        ...formattedNotifications,
        ...formattedWarrantyNotifications,
        ...formattedExpiryNotifications,
      ],
      count:
        formattedNotifications.length +
        formattedWarrantyNotifications.length +
        formattedExpiryNotifications.length,
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

const openWarrantyNotification = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const updated = await markWarrantyNotificationOpen({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification opened", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const discardWarrantyNotificationAction = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const updated = await discardWarrantyNotification({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification resolved", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const snoozeWarrantyNotificationAction = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const snoozeDays = Number(req.body?.snooze_days);
    if (!Number.isFinite(snoozeDays) || snoozeDays < 0) {
      return res.status(400).json({ success: false, message: "Invalid snooze_days" });
    }
    const updated = await snoozeWarrantyNotification({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
      snoozeDays,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification snoozed", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const openExpiryNotification = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const updated = await markExpiryNotificationOpen({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification opened", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const discardExpiryNotificationAction = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const updated = await discardExpiryNotification({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification resolved", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const snoozeExpiryNotificationAction = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const snoozeDays = Number(req.body?.snooze_days);
    if (!Number.isFinite(snoozeDays) || snoozeDays < 0) {
      return res.status(400).json({ success: false, message: "Invalid snooze_days" });
    }
    const updated = await snoozeExpiryNotification({
      notifyId,
      orgId: req.user?.org_id,
      empIntId: req.user?.emp_int_id,
      snoozeDays,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    return res.json({ success: true, message: "Notification snoozed", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Initiate scrap approval from a warranty notification
// PUT /api/notifications/warranty/:notifyId/scrap
const scrapFromWarrantyNotification = async (req, res) => {
  try {
    const { notifyId } = req.params;
    const orgId = req.user?.org_id;
    const userId = req.user?.user_id;

    if (!orgId || !userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { getDb } = require('../utils/dbContext');
    const db = getDb();
    const notifResult = await db.query(
      `SELECT asset_id, org_id, emp_int_id
       FROM "tblAssetWarrantyNotify"
       WHERE notify_id = $1 AND org_id = $2`,
      [notifyId, orgId]
    );

    if (!notifResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const { asset_id } = notifResult.rows[0];

    const scrapResult = await scrapMaintenanceModel.createScrapRequest({
      orgId,
      userId,
      branchId: req.user?.branch_id,
      asset_id,
      assetgroup_id: null,
      is_scrap_sales: 'N',
      request_notes: 'Initiated from asset/warranty expiry notification',
    });

    if (!scrapResult.success) {
      return res.status(400).json(scrapResult);
    }

    await db.query(
      `UPDATE "tblAssetWarrantyNotify"
       SET status = 'RESOLVED', last_seen_on = CURRENT_TIMESTAMP
       WHERE notify_id = $1 AND org_id = $2`,
      [notifyId, orgId]
    );

    return res.status(200).json({
      success: true,
      message: 'Scrap approval initiated and warranty notification resolved',
      data: scrapResult,
    });
  } catch (error) {
    console.error('Error in scrapFromWarrantyNotification:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate scrap approval', error: error.message });
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
  getFilteredNotifications,
  openWarrantyNotification,
  discardWarrantyNotificationAction,
  snoozeWarrantyNotificationAction,
  scrapFromWarrantyNotification,
  openExpiryNotification,
  discardExpiryNotificationAction,
  snoozeExpiryNotificationAction,
}; 