/**
 * Setup missing job roles for workflow steps
 */

const { getDb } = require('../utils/dbContext');
const db = require('../config/db');

const getDbPool = () => {
    try {
        return getDb();
    } catch (error) {
        return db;
    }
};

async function setupMissingJobRoles() {
    const dbPool = getDbPool();
    
    try {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🔧 SETTING UP MISSING JOB ROLES');
        console.log('═══════════════════════════════════════════════════════════\n');
        
        // Check which workflow steps need job roles
        const stepsNeedingRoles = ['WFS05', 'WFS03'];
        
        // Get available job roles
        const jobRolesQuery = `
            SELECT job_role_id, text as job_role_name
            FROM "tblJobRoles"
            WHERE int_status = 1
            ORDER BY job_role_id
        `;
        
        const jobRolesResult = await dbPool.query(jobRolesQuery);
        
        console.log('📋 Available Job Roles:\n');
        if (jobRolesResult.rows.length === 0) {
            console.log('   ❌ No job roles found!');
            return;
        }
        
        for (const role of jobRolesResult.rows) {
            console.log(`   - ${role.job_role_id}: ${role.job_role_name || 'N/A'}`);
        }
        
        // Check existing job roles for these steps
        for (const stepId of stepsNeedingRoles) {
            console.log(`\n🔍 Checking ${stepId}...`);
            
            const existingCheck = await dbPool.query(
                `SELECT COUNT(*) as count FROM "tblWFJobRole" WHERE wf_steps_id = $1`,
                [stepId]
            );
            
            if (parseInt(existingCheck.rows[0].count) > 0) {
                console.log(`   ✅ Job roles already exist for ${stepId}`);
                continue;
            }
            
            // Get step name
            const stepQuery = await dbPool.query(
                `SELECT text FROM "tblWFSteps" WHERE wf_steps_id = $1`,
                [stepId]
            );
            
            const stepName = stepQuery.rows[0]?.text || stepId;
            console.log(`   ⚠️  No job roles found for ${stepId} (${stepName})`);
            
            // Suggest a job role based on step name
            let suggestedJobRole = null;
            if (stepId === 'WFS05') {
                // Final Approval - usually needs admin or manager role
                suggestedJobRole = jobRolesResult.rows.find(r => 
                    r.job_role_name?.toLowerCase().includes('admin') || 
                    r.job_role_name?.toLowerCase().includes('manager')
                ) || jobRolesResult.rows[0];
            } else if (stepId === 'WFS03') {
                // Hospital Admin - needs admin role
                suggestedJobRole = jobRolesResult.rows.find(r => 
                    r.job_role_name?.toLowerCase().includes('admin')
                ) || jobRolesResult.rows[0];
            } else {
                suggestedJobRole = jobRolesResult.rows[0];
            }
            
            if (suggestedJobRole) {
                console.log(`   💡 Suggested job role: ${suggestedJobRole.job_role_id} (${suggestedJobRole.job_role_name})`);
                
                // Get a department ID from existing job role entries or get first available department
                let deptId = null;
                const existingDeptQuery = await dbPool.query(
                    `SELECT dept_id FROM "tblWFJobRole" WHERE dept_id IS NOT NULL LIMIT 1`
                );
                
                if (existingDeptQuery.rows.length > 0) {
                    deptId = existingDeptQuery.rows[0].dept_id;
                } else {
                    // Get first available department
                    const deptQuery = await dbPool.query(
                        `SELECT dept_id FROM "tblDepartments" WHERE int_status = 1 LIMIT 1`
                    );
                    if (deptQuery.rows.length > 0) {
                        deptId = deptQuery.rows[0].dept_id;
                    }
                }
                
                if (!deptId) {
                    console.log(`   ❌ No department found. Cannot create job role entry without dept_id.\n`);
                    continue;
                }
                
                console.log(`   📍 Using department: ${deptId}`);
                
                // Get next wf_job_role_id - check all existing IDs to avoid duplicates
                const getIdQuery = `
                    SELECT wf_job_role_id 
                    FROM "tblWFJobRole" 
                    ORDER BY wf_job_role_id DESC
                `;
                
                const idResult = await dbPool.query(getIdQuery);
                let nextId = 'WFJR001';
                let nextNum = 1;
                
                if (idResult.rows.length > 0) {
                    // Find the highest numeric ID
                    const numericIds = idResult.rows
                        .map(row => {
                            const match = row.wf_job_role_id.match(/\d+/);
                            return match ? parseInt(match[0]) : 0;
                        })
                        .filter(n => n > 0);
                    
                    if (numericIds.length > 0) {
                        nextNum = Math.max(...numericIds) + 1;
                    }
                    
                    // Generate ID and check for uniqueness
                    nextId = `WFJR${String(nextNum).padStart(3, '0')}`;
                    
                    // Ensure uniqueness by checking if ID exists
                    while (idResult.rows.some(row => row.wf_job_role_id === nextId)) {
                        nextNum++;
                        nextId = `WFJR${String(nextNum).padStart(3, '0')}`;
                    }
                }
                
                // Get org_id from existing job role or use default
                let orgId = 'ORG001';
                const existingOrgQuery = await dbPool.query(
                    `SELECT org_id FROM "tblWFJobRole" WHERE org_id IS NOT NULL LIMIT 1`
                );
                if (existingOrgQuery.rows.length > 0) {
                    orgId = existingOrgQuery.rows[0].org_id;
                }
                
                // Create the job role entry
                const insertQuery = `
                    INSERT INTO "tblWFJobRole" (
                        wf_job_role_id,
                        wf_steps_id,
                        job_role_id,
                        dept_id,
                        emp_int_id,
                        org_id
                    ) VALUES ($1, $2, $3, $4, NULL, $5)
                    RETURNING *
                `;
                
                const insertResult = await dbPool.query(insertQuery, [
                    nextId,
                    stepId,
                    suggestedJobRole.job_role_id,
                    deptId,
                    orgId
                ]);
                
                console.log(`   ✅ Created job role entry: ${nextId} for ${stepId} with job_role_id: ${suggestedJobRole.job_role_id}, dept_id: ${deptId}\n`);
            }
        }
        
        console.log('✅ Setup completed!\n');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('   Stack:', error.stack);
    } finally {
        console.log('═══════════════════════════════════════════════════════════\n');
    }
}

setupMissingJobRoles()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

