const fcmService = require('./fcmService');
const emailService = require('./emailService');
const {
    logFcmAssetEventIntegration,
    logFcmMaintenanceEventIntegration,
    logFcmWorkflowEventIntegration
} = require('../eventLoggers/fcmEventLogger');

class NotificationIntegrationService {
    /**
     * Send notification when asset is created
     */
    async notifyAssetCreated(assetData, userId) {
        const startTime = Date.now();
        
        try {
            // Send FCM notification to asset owner/assigned user
            if (assetData.assignedTo) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: assetData.assignedTo,
                    title: 'New Asset Assigned',
                    body: `Asset "${assetData.assetName}" has been assigned to you`,
                    data: {
                        assetId: assetData.assetId,
                        assetName: assetData.assetName,
                        type: 'asset_assigned'
                    },
                    notificationType: 'asset_assigned'
                });

                const duration = Date.now() - startTime;
                await logFcmAssetEventIntegration({
                    assetId: assetData.assetId,
                    eventType: 'asset_created',
                    notificationSent: fcmResult.success,
                    duration
                });
            }

            // Send email notification to relevant roles (if configured)
            // This can be extended based on your business logic
            
        } catch (error) {
            console.error('Error sending asset created notification:', error);
        }
    }

    /**
     * Send notification when asset is updated
     */
    async notifyAssetUpdated(assetData, userId, changes) {
        const startTime = Date.now();
        
        try {
            // Send FCM notification to asset owner/assigned user
            if (assetData.assignedTo) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: assetData.assignedTo,
                    title: 'Asset Updated',
                    body: `Asset "${assetData.assetName}" has been updated`,
                    data: {
                        assetId: assetData.assetId,
                        assetName: assetData.assetName,
                        changes: changes,
                        type: 'asset_updated'
                    },
                    notificationType: 'asset_updated'
                });

                const duration = Date.now() - startTime;
                await logFcmAssetEventIntegration({
                    assetId: assetData.assetId,
                    eventType: 'asset_updated',
                    notificationSent: fcmResult.success,
                    duration
                });
            }
            
        } catch (error) {
            console.error('Error sending asset updated notification:', error);
        }
    }

    /**
     * Send notification when maintenance is due
     */
    async notifyMaintenanceDue(maintenanceData, assignedUsers) {
        const startTime = Date.now();
        
        try {
            // Send FCM notifications to all assigned users
            for (const user of assignedUsers) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: user.user_id,
                    title: 'Maintenance Due',
                    body: `Maintenance for "${maintenanceData.assetName}" is due on ${new Date(maintenanceData.dueDate).toLocaleDateString()}`,
                    data: {
                        maintenanceId: maintenanceData.maintenanceId,
                        assetName: maintenanceData.assetName,
                        dueDate: maintenanceData.dueDate,
                        type: 'maintenance_due'
                    },
                    notificationType: 'maintenance_due'
                });
            }

            const duration = Date.now() - startTime;
            await logFcmMaintenanceEventIntegration({
                maintenanceId: maintenanceData.maintenanceId,
                eventType: 'maintenance_due',
                notificationSent: true,
                duration
            });
            
        } catch (error) {
            console.error('Error sending maintenance due notification:', error);
        }
    }

    /**
     * Send notification when maintenance is completed
     */
    async notifyMaintenanceCompleted(maintenanceData, assetOwnerId) {
        const startTime = Date.now();
        
        try {
            if (assetOwnerId) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: assetOwnerId,
                    title: 'Maintenance Completed',
                    body: `Maintenance for "${maintenanceData.assetName}" has been completed`,
                    data: {
                        maintenanceId: maintenanceData.maintenanceId,
                        assetName: maintenanceData.assetName,
                        completedDate: maintenanceData.completedDate,
                        type: 'maintenance_completed'
                    },
                    notificationType: 'maintenance_completed'
                });

                const duration = Date.now() - startTime;
                await logFcmMaintenanceEventIntegration({
                    maintenanceId: maintenanceData.maintenanceId,
                    eventType: 'maintenance_completed',
                    notificationSent: fcmResult.success,
                    duration
                });
            }
            
        } catch (error) {
            console.error('Error sending maintenance completed notification:', error);
        }
    }

    /**
     * Send notification when workflow approval is required
     */
    async notifyWorkflowApprovalRequired(workflowData, jobRoleId) {
        const startTime = Date.now();
        
        try {
            // Send FCM notification to users with the required role
            const fcmResult = await fcmService.sendNotificationToRole({
                jobRoleId,
                title: 'Workflow Approval Required',
                body: `Workflow approval required for "${workflowData.assetTypeName || 'Asset Maintenance'}"`,
                data: {
                    workflowId: workflowData.workflowId,
                    assetTypeName: workflowData.assetTypeName,
                    maintenanceType: workflowData.maintenanceType,
                    dueDate: workflowData.dueDate,
                    isUrgent: workflowData.isUrgent,
                    type: 'workflow_approval'
                },
                notificationType: 'workflow_approval'
            });

            // Also send email notification (existing functionality)
            await emailService.sendWorkflowNotificationToRole(workflowData, jobRoleId);

            const duration = Date.now() - startTime;
            await logFcmWorkflowEventIntegration({
                workflowId: workflowData.workflowId,
                eventType: 'workflow_approval_required',
                notificationSent: fcmResult.success,
                duration
            });
            
        } catch (error) {
            console.error('Error sending workflow approval notification:', error);
        }
    }

    /**
     * Send notification when workflow is escalated
     */
    async notifyWorkflowEscalated(workflowData, escalatedToRoleId) {
        const startTime = Date.now();
        
        try {
            // Send FCM notification to escalated role
            const fcmResult = await fcmService.sendNotificationToRole({
                jobRoleId: escalatedToRoleId,
                title: 'Workflow Escalated',
                body: `Workflow for "${workflowData.assetTypeName || 'Asset Maintenance'}" has been escalated`,
                data: {
                    workflowId: workflowData.workflowId,
                    assetTypeName: workflowData.assetTypeName,
                    escalatedDate: new Date().toISOString(),
                    type: 'workflow_escalated'
                },
                notificationType: 'workflow_escalated'
            });

            const duration = Date.now() - startTime;
            await logFcmWorkflowEventIntegration({
                workflowId: workflowData.workflowId,
                eventType: 'workflow_escalated',
                notificationSent: fcmResult.success,
                duration
            });
            
        } catch (error) {
            console.error('Error sending workflow escalated notification:', error);
        }
    }

    /**
     * Send notification when breakdown is reported
     */
    async notifyBreakdownReported(breakdownData, assignedUsers) {
        const startTime = Date.now();
        
        try {
            // Send FCM notifications to assigned maintenance users
            for (const user of assignedUsers) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: user.user_id,
                    title: 'Asset Breakdown Reported',
                    body: `Breakdown reported for "${breakdownData.assetName}"`,
                    data: {
                        breakdownId: breakdownData.breakdownId,
                        assetName: breakdownData.assetName,
                        reportedDate: breakdownData.reportedDate,
                        priority: breakdownData.priority,
                        type: 'breakdown_reported'
                    },
                    notificationType: 'breakdown_reported'
                });
            }

            const duration = Date.now() - startTime;
            await logFcmAssetEventIntegration({
                assetId: breakdownData.assetId,
                eventType: 'breakdown_reported',
                notificationSent: true,
                duration
            });
            
        } catch (error) {
            console.error('Error sending breakdown reported notification:', error);
        }
    }

    /**
     * Send notification when user is assigned to asset
     */
    async notifyUserAssignedToAsset(assignmentData, userId) {
        const startTime = Date.now();
        
        try {
            const fcmResult = await fcmService.sendNotificationToUser({
                userId,
                title: 'Asset Assignment',
                body: `You have been assigned to asset "${assignmentData.assetName}"`,
                data: {
                    assetId: assignmentData.assetId,
                    assetName: assignmentData.assetName,
                    assignedDate: assignmentData.assignedDate,
                    type: 'user_assigned'
                },
                notificationType: 'user_assigned'
            });

            const duration = Date.now() - startTime;
            await logFcmAssetEventIntegration({
                assetId: assignmentData.assetId,
                eventType: 'user_assigned',
                notificationSent: fcmResult.success,
                duration
            });
            
        } catch (error) {
            console.error('Error sending user assignment notification:', error);
        }
    }

    /**
     * Send notification when asset is due for depreciation
     */
    async notifyAssetDepreciation(assetData, assignedUsers) {
        const startTime = Date.now();
        
        try {
            // Send FCM notifications to assigned users
            for (const user of assignedUsers) {
                const fcmResult = await fcmService.sendNotificationToUser({
                    userId: user.user_id,
                    title: 'Asset Depreciation Due',
                    body: `Asset "${assetData.assetName}" is due for depreciation calculation`,
                    data: {
                        assetId: assetData.assetId,
                        assetName: assetData.assetName,
                        currentValue: assetData.currentValue,
                        depreciationDate: assetData.depreciationDate,
                        type: 'asset_depreciation'
                    },
                    notificationType: 'asset_depreciation'
                });
            }

            const duration = Date.now() - startTime;
            await logFcmAssetEventIntegration({
                assetId: assetData.assetId,
                eventType: 'asset_depreciation',
                notificationSent: true,
                duration
            });
            
        } catch (error) {
            console.error('Error sending asset depreciation notification:', error);
        }
    }
}

module.exports = new NotificationIntegrationService();
