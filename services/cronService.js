const cron = require('node-cron');
const axios = require('axios');
const { BACKEND_URL } = require('../config/environment');
const { startWorkflowEscalationCron } = require('../cron/workflowEscalationCron');
const maintenanceCronLogger = require('../eventLoggers/maintenanceCronEventLogger');

class CronService {
    constructor() {
        this.baseURL = BACKEND_URL;
        this.apiToken = process.env.CRON_API_TOKEN;
        this.maintenanceCronTask = null; // Store the cron task reference
    }

    // Initialize all cron jobs
    initCronJobs() {
        const userId = 'SYSTEM';
        
        console.log('Initializing cron jobs...');
        
        maintenanceCronLogger.logCronJobInitialization({
            jobs: ['maintenance_schedule_generation', 'workflow_escalation'],
            userId
        }).catch(err => console.error('Logging error:', err));
        
        // Schedule maintenance schedule generation every 24 hours at 12 AM
        this.scheduleMaintenanceGeneration();
        
        // Schedule workflow escalation every day at 9 AM
        this.scheduleWorkflowEscalation();
        
        console.log('Cron jobs initialized successfully');
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

    // Call the maintenance schedule generation API
    async generateMaintenanceSchedules() {
        const userId = 'SYSTEM';
        
        try {
            const url = `${this.baseURL}/api/maintenance-schedules/generate-cron`;
            
            maintenanceCronLogger.logCallingMaintenanceScheduleAPI({
                url,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            const requestConfig = {
                method: 'POST',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'CronService/1.0'
                },
                data: {
                    // test_date: "2025-09-05"
                }
            };

            const response = await axios(requestConfig);
            
            maintenanceCronLogger.logMaintenanceScheduleAPIResponse({
                status: response.status,
                data: response.data,
                userId
            }).catch(err => console.error('Logging error:', err));
            
            console.log('📊 [CRON] Maintenance generation response:', {
                status: response.status,
                data: response.data
            });

            return response.data;
        } catch (error) {
            maintenanceCronLogger.logMaintenanceScheduleAPIError({
                error,
                status: error.response?.status,
                data: error.response?.data,
                userId
            }).catch(logErr => console.error('Logging error:', logErr));
            
            console.error('❌ [CRON] API call failed:', {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
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
            }
        };
    }
}

module.exports = CronService; 