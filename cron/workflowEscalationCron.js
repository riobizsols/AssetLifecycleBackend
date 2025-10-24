const cron = require('node-cron');
const { processWorkflowEscalations } = require('../models/workflowEscalationModel');
const maintenanceCronLogger = require('../eventLoggers/maintenanceCronEventLogger');

/**
 * ==================================================================================
 * WORKFLOW CUTOFF DATE ESCALATION - AUTOMATED CRON JOB
 * ==================================================================================
 * 
 * PURPOSE:
 * Automatically escalates maintenance approval workflows to the next approver
 * in the sequence when the cutoff date is exceeded and the current approver
 * has not taken action.
 * 
 * HOW IT WORKS:
 * 1. Calculates cutoff date: Due Date - Lead Time (default 3-5 days)
 * 2. Identifies workflows where cutoff date has passed
 * 3. Checks if current approver still has status 'AP' (Approval Pending)
 * 4. Updates current approver status to 'UA' (Unapproved/Escalated)
 * 5. Updates next approver status from 'IN' (Inactive) to 'AP' (Approval Pending)
 * 6. Sends email notification to next approver
 * 7. Logs escalation in tblWorkflowEscalationLog
 * 
 * SCHEDULE: 
 * - Default: Every day at 9:00 AM IST
 * - Cron Expression: '0 9 * * *'
 * 
 * CUSTOMIZATION OPTIONS:
 * - Every hour: '0 * * * *'
 * - Every 6 hours: '0 *\/6 * * *'
 * - Twice daily (9 AM & 5 PM): '0 9,17 * * *'
 * - Custom time: '0 HH * * *' (replace HH with hour in 24-hour format)
 * 
 * EXAMPLE SCENARIO:
 * - Maintenance Due: October 20, 2025
 * - Lead Time: 5 days
 * - Cutoff Date: October 15, 2025
 * - Current Date: October 16, 2025
 * - Action: Escalate from Approver A to Approver B
 * 
 * ==================================================================================
 */

let escalationCronJob = null;

/**
 * Start the Workflow Cutoff Date Escalation cron job
 * Automatically escalates overdue workflows to next approver
 */
const startWorkflowEscalationCron = () => {
  try {
    // Stop existing job if it's running
    if (escalationCronJob) {
      escalationCronJob.stop();
    }

    // Create and start the cron job
    // Runs every day at 9:00 AM IST
    escalationCronJob = cron.schedule('0 9 * * *', async () => {
      const startTime = Date.now();
      const executionTime = new Date().toISOString();
      const userId = 'SYSTEM'; // Cron jobs run as system
      
      console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
      console.log('║  WORKFLOW CUTOFF DATE ESCALATION - AUTOMATED PROCESS STARTED     ║');
      console.log('╚═══════════════════════════════════════════════════════════════════╝');
      console.log('⏰ Execution Time:', executionTime);
      console.log('📋 Task: Escalate overdue workflows to next approver');
      console.log('───────────────────────────────────────────────────────────────────\n');

      try {
        maintenanceCronLogger.logWorkflowEscalationCronExecutionStarted({
          executionTime,
          userId
        }).catch(err => console.error('Logging error:', err));

        maintenanceCronLogger.logProcessingWorkflowEscalations({
          orgId: 'ORG001',
          userId
        }).catch(err => console.error('Logging error:', err));

        // Process escalations for the default organization
        const results = await processWorkflowEscalations('ORG001');
        
        maintenanceCronLogger.logWorkflowEscalationCronCompleted({
          orgId: 'ORG001',
          results,
          userId,
          duration: Date.now() - startTime
        }).catch(err => console.error('Logging error:', err));
        
        console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.log('║  WORKFLOW CUTOFF DATE ESCALATION - COMPLETED SUCCESSFULLY ✓      ║');
        console.log('╚═══════════════════════════════════════════════════════════════════╝');
        console.log('📊 RESULTS SUMMARY:');
        console.log('   • Total overdue workflows found:', results.total);
        console.log('   • Successfully escalated:', results.escalated);
        console.log('   • No next approver available:', results.noNextApprover);
        console.log('   • Errors encountered:', results.errors);
        console.log('───────────────────────────────────────────────────────────────────\n');
      } catch (error) {
        maintenanceCronLogger.logWorkflowEscalationCronError({
          orgId: 'ORG001',
          error,
          userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        console.error('\n╔═══════════════════════════════════════════════════════════════════╗');
        console.error('║  WORKFLOW CUTOFF DATE ESCALATION - FAILED ✗                     ║');
        console.error('╚═══════════════════════════════════════════════════════════════════╝');
        console.error('❌ Error Details:', error.message);
        console.error('───────────────────────────────────────────────────────────────────\n');
      }
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata" // Adjust timezone as needed
    });

    maintenanceCronLogger.logWorkflowEscalationCronStarted({
      schedule: '0 9 * * *',
      timezone: 'Asia/Kolkata',
      userId: 'SYSTEM'
    }).catch(err => console.error('Logging error:', err));

    console.log('✅ WORKFLOW CUTOFF DATE ESCALATION - Cron Job Started Successfully');
    console.log('   📅 Schedule: Every day at 9:00 AM (Asia/Kolkata timezone)');
    console.log('   🎯 Purpose: Auto-escalate workflows to next approver when cutoff date is exceeded');
    
    return escalationCronJob;
  } catch (error) {
    console.error('❌ Failed to start Workflow Escalation Cron Job:', error);
    throw error;
  }
};

/**
 * Stop the workflow escalation cron job
 */
const stopWorkflowEscalationCron = () => {
  try {
    if (escalationCronJob) {
      escalationCronJob.stop();
      
      maintenanceCronLogger.logWorkflowEscalationCronStopped({
        userId: 'SYSTEM'
      }).catch(err => console.error('Logging error:', err));
      
      console.log('✅ Workflow Escalation Cron Job stopped successfully');
    } else {
      console.log('⚠️  No Workflow Escalation Cron Job is currently running');
    }
  } catch (error) {
    console.error('❌ Failed to stop Workflow Escalation Cron Job:', error);
    throw error;
  }
};

/**
 * Get the status of the workflow escalation cron job
 */
const getWorkflowEscalationCronStatus = () => {
  if (escalationCronJob) {
    // Calculate next run time (9:00 AM IST)
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(9, 0, 0, 0);
    
    // If 9 AM has already passed today, set to tomorrow
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    return {
      isRunning: true,
      schedule: '0 9 * * *',
      description: 'Every day at 9:00 AM',
      timezone: 'Asia/Kolkata',
      nextRun: nextRun.toISOString()
    };
  } else {
    return {
      isRunning: false,
      schedule: null,
      description: null,
      timezone: null,
      nextRun: null
    };
  }
};

module.exports = {
  startWorkflowEscalationCron,
  stopWorkflowEscalationCron,
  getWorkflowEscalationCronStatus,
  escalationCronJob
};

