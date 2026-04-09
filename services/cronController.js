const CronService = require('./cronService');

class CronController {
    constructor() {
        this.cronService = new CronService();
    }

    // Manual trigger for maintenance generation (for testing)
    async triggerMaintenanceGeneration(req, res) {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 [CRON CONTROLLER] Manual maintenance generation triggered');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        try {
            const result = await this.cronService.triggerMaintenanceGeneration();
            
            console.log('\n✅ [CRON CONTROLLER] Maintenance generation completed successfully');
            console.log('═══════════════════════════════════════════════════════════\n');
            
            res.status(200).json({
                message: "Maintenance generation triggered successfully",
                result: result
            });
        } catch (error) {
            console.error('\n❌ [CRON CONTROLLER] ============================================');
            console.error('❌ [CRON CONTROLLER] ERROR TRIGGERING MAINTENANCE GENERATION');
            console.error('❌ [CRON CONTROLLER] ============================================');
            console.error('❌ Error Message:', error.message);
            console.error('❌ Error Name:', error.name);
            console.error('❌ Error Code:', error.code);
            console.error('❌ Error Status:', error.status);
            console.error('\n❌ Full Error Object:');
            console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            console.error('\n❌ Error Stack Trace:');
            console.error(error.stack);
            
            if (error.responseData) {
                console.error('\n❌ Response Data from Service:');
                console.error(JSON.stringify(error.responseData, null, 2));
            }
            
            if (error.originalError) {
                console.error('\n❌ Original Error:');
                console.error(JSON.stringify(error.originalError, null, 2));
            }
            
            console.error('\n❌ [CRON CONTROLLER] ============================================\n');
            
            res.status(500).json({
                error: "Failed to trigger maintenance generation",
                message: error.message,
                details: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                name: error.name,
                code: error.code,
                status: error.status,
                responseData: error.responseData,
                ...(error.response?.data && { originalError: error.response.data })
            });
        }
    }

    // Manual trigger for vendor contract renewal (for testing)
    async triggerVendorContractRenewal(req, res) {
        try {
            const result = await this.cronService.triggerVendorContractRenewal();
            if (!result?.success) {
                return res.status(500).json({
                    success: false,
                    message: "Vendor contract renewal completed with errors",
                    result
                });
            }

            res.status(200).json({
                success: true,
                message: "Vendor contract renewal triggered successfully",
                result
            });
        } catch (error) {
            console.error('Error triggering vendor contract renewal:', error);
            res.status(500).json({
                success: false,
                error: "Failed to trigger vendor contract renewal",
                details: error.message
            });
        }
    }

    // Manual trigger for inspection generation (for testing)
    async triggerInspection(req, res) {
        try {
            const orgId = req.body.org_id || 'ORG001';
            const result = await this.cronService.triggerInspection(orgId);
            res.status(200).json({
                message: "Inspection generation triggered successfully",
                result: result
            });
        } catch (error) {
            console.error('Error triggering inspection generation:', error);
            res.status(500).json({
                error: "Failed to trigger inspection generation",
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