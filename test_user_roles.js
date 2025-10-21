/**
 * Test Script: Check User Roles and Workflow Assignment
 * 
 * This script verifies that users have the correct roles assigned
 * and that workflows are properly assigned to roles.
 * 
 * Run: node test_user_roles.js [emp_int_id]
 */

const pool = require('./config/db');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = {
  header: (msg) => console.log(`\n${colors.bright}${colors.blue}${'='.repeat(80)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${colors.magenta}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  data: (label, value) => console.log(`   ${colors.bright}${label}:${colors.reset} ${JSON.stringify(value, null, 2)}`)
};

async function checkUserRoles(empIntId) {
  log.header();
  log.title(`CHECKING USER ROLES FOR: ${empIntId}`);
  log.header();
  
  try {
    // Step 1: Check if user exists
    const userQuery = `
      SELECT 
        u.user_id,
        u.emp_int_id,
        u.full_name,
        u.email,
        u.job_role_id as legacy_job_role_id
      FROM "tblUsers" u
      WHERE u.emp_int_id = $1 AND u.int_status = 1
    `;
    
    const userResult = await pool.query(userQuery, [empIntId]);
    
    if (userResult.rows.length === 0) {
      log.error(`User not found with emp_int_id: ${empIntId}`);
      return null;
    }
    
    const user = userResult.rows[0];
    log.success(`Found user: ${user.full_name} (${user.email})`);
    log.data('User ID', user.user_id);
    log.data('Legacy Job Role ID', user.legacy_job_role_id);
    
    // Step 2: Check user's roles in tblUserJobRoles
    const rolesQuery = `
      SELECT 
        ujr.user_job_role_id,
        ujr.job_role_id,
        jr.text as role_name
      FROM "tblUserJobRoles" ujr
      INNER JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
      WHERE ujr.user_id = $1
      ORDER BY jr.text
    `;
    
    const rolesResult = await pool.query(rolesQuery, [user.user_id]);
    
    if (rolesResult.rows.length === 0) {
      log.error('User has NO roles assigned in tblUserJobRoles!');
      log.warning('This is why notifications show "Unassigned"');
      return { user, roles: [] };
    }
    
    const roles = rolesResult.rows;
    log.success(`User has ${roles.length} role(s) assigned:`);
    roles.forEach(role => {
      console.log(`   - ${role.role_name} (${role.job_role_id})`);
    });
    
    return { user, roles };
  } catch (error) {
    log.error(`Error checking user roles: ${error.message}`);
    return null;
  }
}

async function checkWorkflowAssignments(userRoleIds, orgId = 'ORG001') {
  log.header();
  log.title('CHECKING WORKFLOW ASSIGNMENTS');
  log.header();
  
  try {
    // Check workflows where user's roles are involved
    const workflowQuery = `
      SELECT DISTINCT
        wfh.wfamsh_id,
        wfh.asset_id,
        wfh.pl_sch_date,
        wfh.status as header_status,
        a.asset_type_id,
        at.text as asset_type_name,
        wfd.job_role_id,
        jr.text as required_role,
        wfd.sequence,
        wfd.status as detail_status
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblWFAssetMaintSch_D" wfd ON wfh.wfamsh_id = wfd.wfamsh_id
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblJobRoles" jr ON wfd.job_role_id = jr.job_role_id
      WHERE wfd.org_id = $1
        AND wfd.job_role_id = ANY($2::varchar[])
        AND wfh.status IN ('IN', 'IP', 'CO', 'CA')
        AND wfd.status IN ('IN', 'IP', 'UA', 'UR', 'AP')
      ORDER BY wfh.pl_sch_date ASC, wfd.sequence ASC
    `;
    
    const result = await pool.query(workflowQuery, [orgId, userRoleIds]);
    
    if (result.rows.length === 0) {
      log.warning('No workflows found for user\'s roles');
      log.info('This could mean:');
      log.info('  1. No maintenance workflows are pending');
      log.info('  2. User\'s roles are not assigned to any workflows');
      log.info('  3. All workflows are completed or cancelled');
      return [];
    }
    
    log.success(`Found ${result.rows.length} workflow step(s) for user's roles`);
    
    // Group by workflow
    const workflowMap = new Map();
    result.rows.forEach(row => {
      if (!workflowMap.has(row.wfamsh_id)) {
        workflowMap.set(row.wfamsh_id, {
          wfamsh_id: row.wfamsh_id,
          asset_id: row.asset_id,
          asset_type_name: row.asset_type_name,
          pl_sch_date: row.pl_sch_date,
          header_status: row.header_status,
          steps: []
        });
      }
      workflowMap.get(row.wfamsh_id).steps.push({
        sequence: row.sequence,
        job_role_id: row.job_role_id,
        required_role: row.required_role,
        status: row.detail_status
      });
    });
    
    workflowMap.forEach((workflow, wfamshId) => {
      console.log(`\n   ${colors.bright}Workflow: ${wfamshId}${colors.reset}`);
      log.data('   Asset', workflow.asset_id);
      log.data('   Asset Type', workflow.asset_type_name);
      log.data('   Scheduled Date', workflow.pl_sch_date);
      log.data('   Status', workflow.header_status);
      console.log(`   ${colors.bright}User's Role Steps:${colors.reset}`);
      workflow.steps.forEach(step => {
        const statusColor = step.status === 'AP' ? colors.yellow : 
                           step.status === 'UA' ? colors.green : 
                           step.status === 'UR' ? colors.red : colors.blue;
        console.log(`      ${step.sequence}. ${step.required_role} (${step.job_role_id}) - ${statusColor}${step.status}${colors.reset}`);
      });
    });
    
    return Array.from(workflowMap.values());
  } catch (error) {
    log.error(`Error checking workflow assignments: ${error.message}`);
    return [];
  }
}

async function checkNotificationQuery(empIntId, orgId = 'ORG001') {
  log.header();
  log.title('TESTING NOTIFICATION QUERY');
  log.header();
  
  try {
    // This is the exact query from notificationModel.js
    const query = `
      SELECT DISTINCT
        wfh.wfamsh_id,
        wfh.pl_sch_date,
        wfh.asset_id,
        wfh.status as header_status,
        a.asset_type_id,
        CASE 
          WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
          ELSE at.maint_lead_type::text
        END as maint_lead_type,
        COALESCE(at.text, 'Unknown Asset Type') as asset_type_name,
        COALESCE(wfh.maint_type_id, at.maint_type_id) as maint_type_id,
        COALESCE(mt.text, 'Regular Maintenance') as maint_type_name,
        -- Get the current action role and users
        COALESCE(current_action_role.job_role_name, 'Unknown Role') as current_action_role_name,
        current_action_role.job_role_id as current_action_role_id,
        -- Calculate cutoff date: pl_sch_date - maint_lead_type
        (wfh.pl_sch_date - INTERVAL '1 day' * CAST(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
            ELSE at.maint_lead_type::text
          END AS INTEGER
        )) as cutoff_date,
        -- Calculate days until due
        EXTRACT(DAY FROM (wfh.pl_sch_date - CURRENT_DATE)) as days_until_due,
        -- Calculate days until cutoff
        EXTRACT(DAY FROM ((wfh.pl_sch_date - INTERVAL '1 day' * CAST(
          CASE 
            WHEN at.maint_lead_type IS NULL OR at.maint_lead_type = '' THEN '0'
            ELSE at.maint_lead_type::text
          END AS INTEGER
        )) - CURRENT_DATE)) as days_until_cutoff
      FROM "tblWFAssetMaintSch_H" wfh
      INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
      INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblMaintTypes" mt ON mt.maint_type_id = COALESCE(wfh.maint_type_id, at.maint_type_id)
      -- Get current action role (workflow step with AP status)
      LEFT JOIN (
        SELECT 
          wfd2.wfamsh_id,
          wfd2.job_role_id,
          jr2.text as job_role_name
        FROM "tblWFAssetMaintSch_D" wfd2
        LEFT JOIN "tblJobRoles" jr2 ON wfd2.job_role_id = jr2.job_role_id
        WHERE wfd2.status IN ('AP', 'IN')
          AND wfd2.wfamsd_id = (
            SELECT MAX(wfd3.wfamsd_id)
            FROM "tblWFAssetMaintSch_D" wfd3
            WHERE wfd3.wfamsh_id = wfd2.wfamsh_id
              AND wfd3.status IN ('AP', 'IN')
          )
      ) current_action_role ON wfh.wfamsh_id = current_action_role.wfamsh_id
      -- Check if the requesting employee has a role involved in this workflow
      WHERE wfh.org_id = $1 
        AND wfh.status IN ('IN', 'IP', 'CO')
        AND EXISTS (
          SELECT 1 
          FROM "tblWFAssetMaintSch_D" wfd
          INNER JOIN "tblUserJobRoles" ujr ON wfd.job_role_id = ujr.job_role_id
          INNER JOIN "tblUsers" u ON ujr.user_id = u.user_id
          WHERE wfd.wfamsh_id = wfh.wfamsh_id
            AND u.emp_int_id = $2
            AND u.int_status = 1
            AND wfd.status IN ('IN', 'IP', 'AP', 'UA', 'UR')
        )
      ORDER BY wfh.pl_sch_date ASC
    `;
    
    const result = await pool.query(query, [orgId, empIntId]);
    
    if (result.rows.length === 0) {
      log.warning('No notifications found for this user');
      log.info('This matches what the frontend would show');
      return [];
    }
    
    log.success(`Found ${result.rows.length} notification(s) for user`);
    
    result.rows.forEach((notification, index) => {
      console.log(`\n   ${colors.bright}Notification ${index + 1}:${colors.reset}`);
      log.data('   Workflow ID', notification.wfamsh_id);
      log.data('   Asset', notification.asset_id);
      log.data('   Asset Type', notification.asset_type_name);
      log.data('   Maintenance Type', notification.maint_type_name);
      log.data('   Scheduled Date', notification.pl_sch_date);
      log.data('   Cutoff Date', notification.cutoff_date);
      log.data('   Days Until Due', Math.floor(notification.days_until_due));
      log.data('   Days Until Cutoff', Math.floor(notification.days_until_cutoff));
      log.data('   Current Action Role', `${notification.current_action_role_name} (${notification.current_action_role_id})`);
      
      if (notification.days_until_cutoff <= 2) {
        log.warning(`   URGENT: Cutoff date approaching!`);
      }
    });
    
    return result.rows;
  } catch (error) {
    log.error(`Error testing notification query: ${error.message}`);
    console.error(error);
    return [];
  }
}

async function runDiagnostics() {
  log.header();
  log.title('🔍 USER ROLES & WORKFLOW DIAGNOSTICS');
  log.header();
  
  // Get test user from command line or use default
  const testEmpIntId = process.argv[2] || 'EMP001';
  
  log.info(`Testing with emp_int_id: ${testEmpIntId}`);
  
  try {
    // Step 1: Check user roles
    const userInfo = await checkUserRoles(testEmpIntId);
    if (!userInfo) {
      log.error('Cannot proceed without valid user. Exiting.');
      process.exit(1);
    }
    
    const { user, roles } = userInfo;
    const userRoleIds = roles.map(r => r.job_role_id);
    
    // Step 2: Check workflow assignments
    const workflows = await checkWorkflowAssignments(userRoleIds);
    
    // Step 3: Test notification query
    const notifications = await checkNotificationQuery(testEmpIntId);
    
    // Summary
    log.header();
    log.title('📊 DIAGNOSTIC SUMMARY');
    log.header();
    
    log.success(`User: ${user.full_name}`);
    log.success(`Roles: ${roles.length}`);
    log.success(`Workflows: ${workflows.length}`);
    log.success(`Notifications: ${notifications.length}`);
    
    if (roles.length === 0) {
      log.error('❌ ISSUE FOUND: User has no roles assigned!');
      log.info('SOLUTION: Assign roles to user in tblUserJobRoles table');
    } else if (workflows.length === 0) {
      log.warning('⚠️  No workflows found for user\'s roles');
      log.info('This could be normal if no maintenance is pending');
    } else if (notifications.length === 0) {
      log.warning('⚠️  No notifications found despite having workflows');
      log.info('This might indicate an issue with the notification query');
    } else {
      log.success('✅ All systems working correctly!');
    }
    
    log.header();
    log.success('Diagnostics completed!');
    log.header();
    
  } catch (error) {
    log.error(`Diagnostics failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run diagnostics
runDiagnostics();
