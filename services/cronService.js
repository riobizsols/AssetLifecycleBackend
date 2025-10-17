const cron = require('node-cron');
const axios = require('axios');
const { BACKEND_URL } = require('../config/environment');
const { startWorkflowEscalationCron } = require('../cron/workflowEscalationCron');

class CronService {
    constructor() {
        this.baseURL = BACKEND_URL;
        this.apiToken = process.env.CRON_API_TOKEN;
    }

    // Initialize all cron jobs
    initCronJobs() {
        console.log('Initializing cron jobs...');
        
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
        // Run every day at 12:00 AM (midnight)
        cron.schedule('0 0 * * *', async () => {
            console.log('🕐 [CRON] Starting scheduled maintenance schedule generation at:', new Date().toISOString());
            
            try {
                await this.generateMaintenanceSchedules();
                console.log('✅ [CRON] Maintenance schedule generation completed successfully');
            } catch (error) {
                console.error('❌ [CRON] Error in maintenance schedule generation:', error.message);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kolkata" // IST timezone
        });

        console.log('📅 [CRON] Maintenance schedule generation scheduled for every day at 12:00 AM (IST)');
    }

    // Call the maintenance schedule generation API
    async generateMaintenanceSchedules() {
        try {
            const url = `${this.baseURL}/api/maintenance-schedules/generate-cron`;
            
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
            
            console.log('📊 [CRON] Maintenance generation response:', {
                status: response.status,
                data: response.data
            });

            return response.data;
        } catch (error) {
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
        console.log('🔧 [CRON] Manually triggering maintenance schedule generation...');
        return await this.generateMaintenanceSchedules();
    }

    // Get cron job status
    getCronStatus() {
        return {
            maintenanceGeneration: {
                schedule: '0 0 * * *', // Every day at 12:00 AM
                description: 'Generate maintenance schedules for assets every day at 12:00 AM (IST)',
                timezone: 'Asia/Kolkata',
                nextRun: 'Daily at midnight IST'
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