const cron = require('node-cron');
const axios = require('axios');
const { BACKEND_URL } = require('../config/environment');
const { startWorkflowEscalationCron } = require('../cron/workflowEscalationCron');
const { startVendorContractRenewalCron } = require('../cron/vendorContractRenewalCron');
const { startWfAtSeqBackfillCron } = require('../cron/wfAtSeqBackfillCron');
const { startWfScrapSeqBackfillCron } = require('../cron/wfScrapSeqBackfillCron');
const maintenanceCronLogger = require('../eventLoggers/maintenanceCronEventLogger');
const { generateMaintenanceSchedules } = require('../controllers/maintenanceScheduleController');
const { generateInspectionSchedules } = require('../controllers/inspectionScheduleController');
const {
    ensureWarrantyNotificationsForWindowAllOrgs,
} = require('../models/assetWarrantyNotifyModel');

class CronService {
    constructor() {
        this.baseURL = BACKEND_URL;
        this.apiToken = process.env.CRON_API_TOKEN;
        this.maintenanceCronTask = null; // Store the cron task reference
    }

    // Initialize all cron jobs with staggered startup to avoid a "connection storm"
    // (multiple cron loggers hitting the DB pool at once and exhausting connections).
    // Gaps of 10–15s let the pool rest between each cron's startup logging.
    initCronJobs() {
        const userId = 'SYSTEM';
        
        console.log('Initializing cron jobs...');
        
        // Defer initial logging so it doesn't run in parallel with DB startup
        setTimeout(() => {
            maintenanceCronLogger.logCronJobInitialization({
                jobs: ['maintenance_schedule_generation', 'workflow_escalation', 'vendor_contract_renewal', 'wfat_sequence_backfill', 'wfscrap_sequence_backfill'],
                userId
            }).catch(err => console.error('Logging error:', err));
        }, 2000);
        
        // Schedule maintenance first (paused; only runs on manual trigger)
        this.scheduleMaintenanceGeneration();
        
        // Stagger workflow (10s) and vendor (20s) so pool has time to recover between cron startups
        setTimeout(() => {
            this.scheduleWorkflowEscalation();
        }, 10000);
        
        setTimeout(() => {
            this.scheduleVendorContractRenewal();
            console.log('Cron jobs initialized successfully');
        }, 30000);

        // Start WFAT sequence backfill after other jobs to reduce startup contention.
        setTimeout(() => {
            this.scheduleWfAtSeqBackfill();
        }, 45000);

        setTimeout(() => {
            this.scheduleWfScrapSeqBackfill();
        }, 60000);

        setTimeout(() => {
            this.scheduleWarrantyNotificationTrigger();
        }, 75000);
    }

    // Schedule workflow escalation for overdue approvals
    scheduleWorkflowEscalation() {
        try {
            startWorkflowEscalationCron();
            console.log('📅 [CRON] Workflow Cutoff Date Escalation: Scheduled for every day at 9:00 AM (IST)');
            console.log('   → Automatically escalates overdue workflows to next approver when cutoff date is exceeded');
        } catch (error) {
            console.error('❌ [CRON] Failed to schedule workflow escalation:', error.message);
        }
    }

    // Schedule vendor contract renewal check
    scheduleVendorContractRenewal() {
        try {
            startVendorContractRenewalCron();
            console.log('📅 [CRON] Vendor Contract Renewal: Scheduled for every day at 8:00 AM (IST)');
            console.log('   → Checks vendor contract end dates and creates renewal workflows 10 days before expiry');
            console.log('   → Blocks vendors with expired contracts (workflow not approved before contract_end_date)');
        } catch (error) {
            console.error('❌ [CRON] Failed to schedule vendor contract renewal:', error.message);
        }
    }

    // Backfill missing default workflow sequences for any asset type/org without tblWFATSeqs
    scheduleWfAtSeqBackfill() {
        try {
            startWfAtSeqBackfillCron();
            console.log('📅 [CRON] WFAT Sequence Backfill: Scheduled for every day at 1:00 AM (IST)');
            console.log('   → For each tblAssetTypes row with org_id missing tblWFATSeqs, inserts default Seq 10 / WFS-06');
        } catch (error) {
            console.error('❌ [CRON] Failed to schedule WFAT sequence backfill:', error.message);
        }
    }

    /** tblWFScrapSeq: one-level scrap approval for asset types missing a row (default WFS-02, seq 10). */
    scheduleWfScrapSeqBackfill() {
        try {
            startWfScrapSeqBackfillCron();
            console.log('📅 [CRON] WF Scrap Sequence Backfill: Scheduled for every day at 3:30 AM (IST)');
            console.log('   → For each tblAssetTypes row missing tblWFScrapSeq, inserts default Seq 10 / WFS-02');
        } catch (error) {
            console.error('❌ [CRON] Failed to schedule WF scrap sequence backfill:', error.message);
        }
    }

    // Schedule warranty notifications for assets expiring within 10 days.
    scheduleWarrantyNotificationTrigger() {
        try {
            cron.schedule('0 7 * * *', async () => {
                const startedAt = new Date().toISOString();
                try {
                    const result = await ensureWarrantyNotificationsForWindowAllOrgs({ days: 10 });
                    console.log(
                        `✅ [CRON] Warranty notification trigger completed at ${startedAt}. Orgs: ${result.orgs}, scanned assets: ${result.scanned}, created notifications: ${result.created}`
                    );
                } catch (error) {
                    console.error('❌ [CRON] Warranty notification trigger failed:', error.message);
                }
            }, {
                timezone: "Asia/Kolkata",
            });

            console.log('📅 [CRON] Warranty Notification Trigger: Scheduled daily at 7:00 AM (IST)');
            console.log('   → Creates notifications for assets with warranty expiry within next 10 days');
        } catch (error) {
            console.error('❌ [CRON] Failed to schedule warranty notification trigger:', error.message);
        }
    }

    // Schedule maintenance schedule generation
    scheduleMaintenanceGeneration() {
        // Run every 24 hours at 12:00 AM (midnight) - Currently paused, only runs via manual trigger
        this.maintenanceCronTask = cron.schedule('0 0 * * *', async () => {
            const startTime = Date.now();
            const executionTime = new Date().toISOString();
            const userId = 'SYSTEM'; // Cron jobs run as system
            
            console.log('🕐 [CRON] Starting scheduled maintenance schedule generation at:', executionTime);
            
            try {
                maintenanceCronLogger.logMaintenanceScheduleCronExecutionStarted({
                    executionTime,
                    userId
                }).catch(err => console.error('Logging error:', err));

                await this.generateMaintenanceSchedules();
                
                maintenanceCronLogger.logMaintenanceScheduleCronCompleted({
                    results: { status: 'success' },
                    userId,
                    duration: Date.now() - startTime
                }).catch(err => console.error('Logging error:', err));
                
                console.log('✅ [CRON] Maintenance schedule generation completed successfully');
            } catch (error) {
                maintenanceCronLogger.logMaintenanceScheduleCronError({
                    error,
                    userId
                }).catch(logErr => console.error('Logging error:', logErr));
                
                console.error('❌ [CRON] Error in maintenance schedule generation:', error.message);
            }
        }, {
            scheduled: false, // Paused - will only run when manually triggered from dashboard
            timezone: "Asia/Kolkata" // IST timezone
        });

        maintenanceCronLogger.logMaintenanceScheduleCronStarted({
            schedule: '0 0 * * * (Every 24 hours - PAUSED)',
            timezone: 'Asia/Kolkata',
            userId: 'SYSTEM'
        }).catch(err => console.error('Logging error:', err));

        console.log('📅 [CRON] Maintenance schedule generation configured to run every 24 hours at 12:00 AM (IST) - CURRENTLY PAUSED');
        console.log('   → The cron job will only execute when manually triggered from the dashboard');
    }

    // Call the maintenance schedule generation directly (no HTTP request)
    async generateMaintenanceSchedules() {
        const userId = 'SYSTEM';
        
        try {
            console.log('📊 [CRON] Calling maintenance schedule generation directly...');
            console.log('📊 [CRON] Environment:', {
                NODE_ENV: process.env.NODE_ENV,
                DATABASE_URL: process.env.DATABASE_URL ? `${process.env.DATABASE_URL.substring(0, 20)}...` : 'NOT SET'
            });
            
            // Create mock request and response objects for the controller
            const mockReq = {
                body: {
                    // test_date: "2025-09-05" // Uncomment to test with specific date
                }
            };
            
            let responseData = null;
            let responseStatus = 200;
            let responseError = null;
            
            const mockRes = {
                status: (code) => {
                    responseStatus = code;
                    return mockRes;
                },
                json: (data) => {
                    responseData = data;
                    return mockRes;
                }
            };
            
            // Call the controller function directly
            try {
                await generateMaintenanceSchedules(mockReq, mockRes);
                
                // Check if response was set (controller should have called res.json())
                if (!responseData && responseStatus === 200) {
                    console.warn('⚠️ [CRON] Controller did not send a response, assuming success');
                    responseData = { message: "Maintenance generation completed (no response from controller)" };
                }
            } catch (controllerError) {
                console.error('\n❌ [CRON SERVICE] ============================================');
                console.error('❌ [CRON SERVICE] CONTROLLER THREW AN ERROR');
                console.error('❌ [CRON SERVICE] ============================================');
                console.error('❌ Error Message:', controllerError.message);
                console.error('❌ Error Name:', controllerError.name);
                console.error('❌ Error Code:', controllerError.code);
                console.error('❌ Error Errno:', controllerError.errno);
                console.error('❌ Error Syscall:', controllerError.syscall);
                console.error('❌ Error Hostname:', controllerError.hostname);
                console.error('❌ Error Port:', controllerError.port);
                console.error('\n❌ Full Error Object:');
                console.error(JSON.stringify(controllerError, Object.getOwnPropertyNames(controllerError), 2));
                console.error('\n❌ Error Stack Trace:');
                console.error(controllerError.stack);
                console.error('❌ [CRON SERVICE] ============================================\n');
                
                // If controller throws, create a proper error response
                if (responseStatus === 200) {
                    responseStatus = 500;
                }
                
                // Check if it's a database connection error
                const isDatabaseError = controllerError.code === 'ECONNREFUSED' || 
                                      controllerError.code === 'ENOTFOUND' ||
                                      controllerError.message?.includes('connection') ||
                                      controllerError.message?.includes('database') ||
                                      controllerError.message?.includes('timeout');
                
                responseData = {
                    error: "Maintenance generation failed",
                    message: controllerError.message,
                    details: controllerError.message,
                    name: controllerError.name,
                    code: controllerError.code,
                    isDatabaseError: isDatabaseError,
                    stack: process.env.NODE_ENV === 'development' ? controllerError.stack : undefined
                };
            }
            
            maintenanceCronLogger.logMaintenanceScheduleAPIResponse({
                status: responseStatus,
                data: responseData,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            console.log('📊 [CRON] Maintenance generation response:', {
                status: responseStatus,
                data: responseData
            });

            if (responseStatus !== 200) {
                const errorMessage = responseData?.message || 
                                   responseData?.error || 
                                   responseData?.details || 
                                   `Maintenance generation failed with status ${responseStatus}`;
                const error = new Error(errorMessage);
                error.status = responseStatus;
                error.responseData = responseData;
                throw error;
            }

            return responseData;
        } catch (error) {
            console.error('\n❌ [CRON SERVICE] ============================================');
            console.error('❌ [CRON SERVICE] MAINTENANCE GENERATION FAILED');
            console.error('❌ [CRON SERVICE] ============================================');
            console.error('❌ Error Message:', error.message);
            console.error('❌ Error Name:', error.name);
            console.error('❌ Error Status:', error.status || 500);
            console.error('❌ Error Code:', error.code);
            console.error('\n❌ Full Error Object:');
            console.error(JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
            console.error('\n❌ Error Stack Trace:');
            console.error(error.stack);
            
            if (error.responseData) {
                console.error('\n❌ Response Data:');
                console.error(JSON.stringify(error.responseData, null, 2));
            }
            
            if (error.originalError) {
                console.error('\n❌ Original Error:');
                console.error(JSON.stringify(error.originalError, null, 2));
            }
            
            console.error('❌ [CRON SERVICE] ============================================\n');
            
            maintenanceCronLogger.logMaintenanceScheduleAPIError({
                error,
                status: error.status || 500,
                data: error.message,
                userId
            }).catch(logErr => console.error('Logging error:', logErr));
            
            // Enhance error with more details
            const enhancedError = new Error(error.message || 'Maintenance generation failed');
            enhancedError.stack = error.stack;
            enhancedError.status = error.status || 500;
            enhancedError.responseData = error.responseData;
            enhancedError.originalError = error;
            throw enhancedError;
        }
    }

    // Manual trigger for vendor contract renewal
    async triggerVendorContractRenewal() {
        const userId = 'SYSTEM';
        
        try {
            console.log('🔧 [CRON] Manually triggering vendor contract renewal check...');
            
            const { triggerVendorContractRenewal } = require('../cron/vendorContractRenewalCron');
            const result = await triggerVendorContractRenewal();
            
            console.log('✅ [CRON] Vendor contract renewal check completed successfully');
            return result;
        } catch (error) {
            console.error('❌ [CRON] Error in manual vendor contract renewal trigger:', error);
            throw error;
        }
    }

    // Manual trigger for testing
    async triggerMaintenanceGeneration() {
        const userId = 'SYSTEM';
        
        maintenanceCronLogger.logManualTriggerMaintenanceGeneration({
            triggeredBy: 'Manual Trigger',
            userId
        }).catch(err => console.error('Logging error:', err));
        
        console.log('🔧 [CRON] Manually triggering maintenance schedule generation...');
        return await this.generateMaintenanceSchedules();
    }

    // Get cron job status
    // Trigger inspection generation
    async triggerInspection(orgId) {
        console.log(`[CRON SERVICE] Triggering inspection generation for org ${orgId}`);
        // Mock request object for controller function
        const req = {
            body: { org_id: orgId },
            user: { org_id: orgId, userId: 'SYSTEM' }
        };
        
        let responseData = null;
        const mockRes = {
            status: (code) => mockRes, // chainable
            json: (data) => {
                responseData = data;
                return mockRes;
            }
        };

        await generateInspectionSchedules(req, mockRes);
        return responseData || { message: "Generated inspection schedules" };
    }

    getCronStatus() {
        return {
            maintenanceGeneration: {
                schedule: '0 0 * * *', // Every 24 hours at 12:00 AM
                description: 'Generate maintenance schedules for assets every 24 hours at 12:00 AM (IST) - Currently PAUSED',
                timezone: 'Asia/Kolkata',
                nextRun: 'Paused - Only runs when manually triggered',
                status: 'PAUSED',
                canTrigger: true
            },
            workflowCutoffEscalation: {
                name: 'Workflow Cutoff Date Escalation',
                schedule: '0 9 * * *', // Every day at 9:00 AM
                description: 'Automatically escalates maintenance approval workflows to next approver when cutoff date is exceeded and current approver has not taken action',
                timezone: 'Asia/Kolkata',
                nextRun: 'Daily at 9:00 AM IST',
                purpose: 'Ensures timely maintenance approvals by escalating to next superior when deadlines are missed'
            },
            vendorContractRenewal: {
                name: 'Vendor Contract Renewal',
                schedule: '0 8 * * *', // Every day at 8:00 AM
                description: 'Checks vendor contract end dates and creates renewal workflows 10 days before expiry. Blocks vendors with expired contracts (workflow not approved before contract_end_date).',
                timezone: 'Asia/Kolkata',
                nextRun: 'Daily at 8:00 AM IST',
                status: 'ACTIVE',
                canTrigger: true,
                purpose: 'Automatically manages vendor contract renewals and deactivates expired vendors'
            },
            warrantyNotificationTrigger: {
                name: 'Warranty Notification Trigger',
                schedule: '0 7 * * *',
                description: 'Creates warranty alerts for assets whose expiry_date falls within next 10 days.',
                timezone: 'Asia/Kolkata',
                nextRun: 'Daily at 7:00 AM IST',
                status: 'ACTIVE',
                purpose: 'Proactively notify mapped job roles before warranty end date'
            }
        };
    }
}

module.exports = CronService; 