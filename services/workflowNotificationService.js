const fcmService = require('./fcmService');
const db = require('../config/db');

class WorkflowNotificationService {
    /**
     * Send push notification when new workflow maintenance schedule detail is created
     * @param {Object} detailData - The workflow detail data
     * @param {string} detailData.wfamsd_id - Workflow detail ID
     * @param {string} detailData.wfamsh_id - Workflow header ID
     * @param {string} detailData.job_role_id - Job role ID
     * @param {string} detailData.status - Status (AP, IN, etc.)
     * @param {string} detailData.sequence - Sequence number
     * @param {string} detailData.org_id - Organization ID
     */
    async notifyNewWorkflowDetail(detailData) {
        try {
            const { wfamsd_id, wfamsh_id, job_role_id, status, sequence, org_id } = detailData;

            // Only send notifications for approval pending status
            if (status !== 'AP') {
                console.log(`Skipping notification for wfamsd_id ${wfamsd_id} - status is ${status}, not AP`);
                return { success: true, reason: 'Status not AP' };
            }

            // Get workflow header information for context
            const workflowInfo = await this.getWorkflowInfo(wfamsh_id, org_id);
            if (!workflowInfo) {
                console.log(`No workflow info found for wfamsh_id ${wfamsh_id}`);
                return { success: false, reason: 'Workflow info not found' };
            }

            // Get job role information
            const jobRoleInfo = await this.getJobRoleInfo(job_role_id);
            if (!jobRoleInfo) {
                console.log(`No job role info found for job_role_id ${job_role_id}`);
                return { success: false, reason: 'Job role info not found' };
            }

            // Prepare notification data
            const notificationData = {
                jobRoleId: job_role_id,
                title: 'New Maintenance Approval Required',
                body: `Asset "${workflowInfo.asset_name}" requires maintenance approval. Please review and approve.`,
                data: {
                    wfamsd_id: wfamsd_id || '',
                    wfamsh_id: wfamsh_id || '',
                    asset_id: workflowInfo.asset_id || '',
                    asset_name: workflowInfo.asset_name || '',
                    planned_date: workflowInfo.pl_sch_date ? new Date(workflowInfo.pl_sch_date).toISOString() : '',
                    job_role: jobRoleInfo?.text || '',
                    sequence: sequence ? sequence.toString() : '',
                    notification_type: 'workflow_approval'
                },
                notificationType: 'workflow_approval'
            };

            // Send notification to all users with this job role
            const result = await fcmService.sendNotificationToRole(notificationData);

            console.log(`Workflow notification sent for wfamsd_id ${wfamsd_id}:`, {
                jobRoleId: job_role_id,
                jobRoleName: jobRoleInfo.text,
                assetName: workflowInfo.asset_name,
                totalUsers: result.totalUsers,
                successCount: result.successCount,
                failureCount: result.failureCount
            });

            return result;

        } catch (error) {
            console.error('Error sending workflow notification:', error);
            throw error;
        }
    }

    /**
     * Get workflow header information
     * @param {string} wfamsh_id - Workflow header ID
     * @param {string} org_id - Organization ID
     */
    async getWorkflowInfo(wfamsh_id, org_id) {
        try {
            const query = `
                SELECT 
                    wfh.wfamsh_id,
                    wfh.asset_id,
                    wfh.pl_sch_date,
                    wfh.status,
                    a.text as asset_name,
                    a.asset_type_id,
                    at.text as asset_type_name
                FROM "tblWFAssetMaintSch_H" wfh
                INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
                LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
                WHERE wfh.wfamsh_id = $1 AND wfh.org_id = $2
            `;
            
            const result = await db.query(query, [wfamsh_id, org_id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting workflow info:', error);
            throw error;
        }
    }

    /**
     * Get job role information
     * @param {string} job_role_id - Job role ID
     */
    async getJobRoleInfo(job_role_id) {
        try {
            const query = `
                SELECT job_role_id, text, job_function
                FROM "tblJobRoles"
                WHERE job_role_id = $1 AND int_status = 1
            `;
            
            const result = await db.query(query, [job_role_id]);
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting job role info:', error);
            throw error;
        }
    }

    /**
     * Send notification for breakdown workflow details
     * @param {Object} detailData - The workflow detail data
     * @param {string} breakdownInfo - Breakdown information
     */
    async notifyBreakdownWorkflowDetail(detailData, breakdownInfo) {
        try {
            const { wfamsd_id, wfamsh_id, job_role_id, status, sequence, org_id } = detailData;

            // Only send notifications for approval pending status
            if (status !== 'AP') {
                console.log(`Skipping breakdown notification for wfamsd_id ${wfamsd_id} - status is ${status}, not AP`);
                return { success: true, reason: 'Status not AP' };
            }

            // Get workflow header information for context
            const workflowInfo = await this.getWorkflowInfo(wfamsh_id, org_id);
            if (!workflowInfo) {
                console.log(`No workflow info found for wfamsh_id ${wfamsh_id}`);
                return { success: false, reason: 'Workflow info not found' };
            }

            // Get job role information
            const jobRoleInfo = await this.getJobRoleInfo(job_role_id);
            if (!jobRoleInfo) {
                console.log(`No job role info found for job_role_id ${job_role_id}`);
                return { success: false, reason: 'Job role info not found' };
            }

            // Prepare notification data for breakdown
            const notificationData = {
                jobRoleId: job_role_id,
                title: 'Urgent: Asset Breakdown Approval Required',
                body: `Asset "${workflowInfo.asset_name}" has reported a breakdown and requires urgent maintenance approval.`,
                data: {
                    wfamsd_id: wfamsd_id || '',
                    wfamsh_id: wfamsh_id || '',
                    asset_id: workflowInfo.asset_id || '',
                    asset_name: workflowInfo.asset_name || '',
                    planned_date: workflowInfo.pl_sch_date ? new Date(workflowInfo.pl_sch_date).toISOString() : '',
                    job_role: jobRoleInfo?.text || '',
                    sequence: sequence ? sequence.toString() : '',
                    breakdown_info: breakdownInfo || '',
                    notification_type: 'breakdown_approval'
                },
                notificationType: 'breakdown_approval'
            };

            // Send notification to all users with this job role
            const result = await fcmService.sendNotificationToRole(notificationData);

            console.log(`Breakdown workflow notification sent for wfamsd_id ${wfamsd_id}:`, {
                jobRoleId: job_role_id,
                jobRoleName: jobRoleInfo.text,
                assetName: workflowInfo.asset_name,
                totalUsers: result.totalUsers,
                successCount: result.successCount,
                failureCount: result.failureCount
            });

            return result;

        } catch (error) {
            console.error('Error sending breakdown workflow notification:', error);
            throw error;
        }
    }

    /**
     * Initialize default notification preferences for workflow notifications
     * @param {string} userId - User ID
     */
    async initializeWorkflowNotificationPreferences(userId) {
        try {
            const notificationTypes = [
                'workflow_approval',
                'breakdown_approval'
            ];

            for (const notificationType of notificationTypes) {
                // Check if preference already exists
                const checkQuery = `
                    SELECT preference_id FROM "tblNotificationPreferences"
                    WHERE user_id = $1 AND notification_type = $2
                `;
                const existing = await db.query(checkQuery, [userId, notificationType]);

                if (existing.rows.length === 0) {
                    // Insert default preference
                    const preferenceId = 'PREF' + Math.random().toString(36).substr(2, 15).toUpperCase();
                    const insertQuery = `
                        INSERT INTO "tblNotificationPreferences" (
                            preference_id, user_id, notification_type, 
                            is_enabled, email_enabled, push_enabled
                        ) VALUES ($1, $2, $3, true, true, true)
                    `;
                    await db.query(insertQuery, [preferenceId, userId, notificationType]);
                    console.log(`Initialized notification preference for user ${userId}, type ${notificationType}`);
                }
            }
        } catch (error) {
            console.error('Error initializing workflow notification preferences:', error);
            throw error;
        }
    }
}

// Create singleton instance
const workflowNotificationService = new WorkflowNotificationService();

module.exports = workflowNotificationService;
