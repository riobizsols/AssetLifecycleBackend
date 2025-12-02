const CronService = require('./cronService');

class CronController {
    constructor() {
        this.cronService = new CronService();
    }

    // Manual trigger for maintenance generation (for testing)
    async triggerMaintenanceGeneration(req, res) {
        try {
            const result = await this.cronService.triggerMaintenanceGeneration();
            res.status(200).json({
                message: "Maintenance generation triggered successfully",
                result: result
            });
        } catch (error) {
            console.error('Error triggering maintenance generation:', error);
            res.status(500).json({
                error: "Failed to trigger maintenance generation",
                details: error.message
            });
        }
    }

    // Manual trigger for vendor contract renewal (for testing)
    async triggerVendorContractRenewal(req, res) {
        try {
            const result = await this.cronService.triggerVendorContractRenewal();
            res.status(200).json({
                message: "Vendor contract renewal triggered successfully",
                result: result
            });
        } catch (error) {
            console.error('Error triggering vendor contract renewal:', error);
            res.status(500).json({
                error: "Failed to trigger vendor contract renewal",
                details: error.message
            });
        }
    }

    // Get cron job status
    getCronStatus(req, res) {
        try {
            res.status(200).json({
                message: "Cron job status",
                status: this.cronService.getCronStatus()
            });
        } catch (error) {
            console.error('Error getting cron status:', error);
            res.status(500).json({
                error: "Failed to get cron status",
                details: error.message
            });
        }
    }
}

module.exports = CronController; 