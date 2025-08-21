const CronJobService = require('../services/cronJobService');

class CronJobController {
    /**
     * Trigger depreciation calculation cron job manually
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async triggerDepreciationCronJob(req, res) {
        try {
            const { org_id } = req.body;
            const user_id = req.user?.user_id || 'SYSTEM';

            if (!org_id) {
                return res.status(400).json({
                    error: 'Organization ID required',
                    message: 'org_id is required to trigger the cron job'
                });
            }

            console.log(`Manual trigger of depreciation cron job requested by user: ${user_id} for org: ${org_id}`);

            // Trigger the cron job
            const result = await CronJobService.triggerDepreciationCronJob(org_id, user_id);

            res.status(200).json({
                message: 'Cron job triggered successfully',
                jobId: result.jobId,
                result: result
            });

        } catch (error) {
            console.error('Error triggering depreciation cron job:', error);
            res.status(500).json({
                error: 'Failed to trigger cron job',
                message: error.message
            });
        }
    }

    /**
     * Get cron job status and history
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    static async getCronJobStatus(req, res) {
        try {
            const { org_id } = req.params;

            if (!org_id) {
                return res.status(400).json({
                    error: 'Organization ID required',
                    message: 'org_id is required to get cron job status'
                });
            }

            // For now, return basic status
            // In a real implementation, you'd store job history in database
            res.status(200).json({
                message: 'Cron job status retrieved successfully',
                org_id: org_id,
                lastRun: null,
                nextRun: null,
                status: 'idle'
            });

        } catch (error) {
            console.error('Error getting cron job status:', error);
            res.status(500).json({
                error: 'Failed to get cron job status',
                message: error.message
            });
        }
    }
}

module.exports = CronJobController;
