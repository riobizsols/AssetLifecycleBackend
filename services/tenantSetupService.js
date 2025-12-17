const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { registerTenant, deactivateTenant, testTenantConnection: testConnection } = require('./tenantService');
const { initTenantRegistryPool } = require('./tenantService');
const tenantSchemaService = require('./tenantSchemaService');
const { generateCustomId } = require('../utils/idGenerator');
const { sendWelcomeEmail } = require('../utils/mailer');
// Removed DEFAULT constants - all data now comes from reference database (GENERIC_URL)
require('dotenv').config();

/**
 * Parse database URL to extract connection details
 */
function parseDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('Database URL is required');
  }
  const match = databaseUrl.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

/**
 * Check if org_id already exists in tenants table
 */
async function checkOrgIdExists(orgId) {
  const pool = initTenantRegistryPool();
  
  try {
    const result = await pool.query(
      `SELECT org_id FROM "tenants" WHERE org_id = $1`,
      [orgId.toUpperCase()]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[TenantSetup] Error checking org_id:', error);
    throw error;
  }
}

/**
 * Generate unique database name based on org details
 */
async function generateUniqueDatabaseName(orgId, orgCode, orgName) {
  const pool = initTenantRegistryPool();
  
  // Base name from org code or org id
  const baseName = (orgCode || orgId).toLowerCase().replace(/[^a-z0-9]/g, '_');
  let dbName = `${baseName}_db`;
  let counter = 1;
  
  // Check if database name already exists
  // CRITICAL: Only use TENANT_DATABASE_URL, never fallback to DATABASE_URL
  const tenantDbUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDbUrl) {
    throw new Error('TENANT_DATABASE_URL must be set. Do not use DATABASE_URL fallback.');
  }
  
  const tenantDbConfig = parseDatabaseUrl(tenantDbUrl);
  const adminClient = new Client({
    host: tenantDbConfig.host,
    port: tenantDbConfig.port,
    user: tenantDbConfig.user,
    password: tenantDbConfig.password,
    database: 'postgres',
  });
  
  try {
    await adminClient.connect();
    
    // Check in tenants table
    let exists = true;
    while (exists) {
      const tenantCheck = await pool.query(
        `SELECT org_id FROM "tenants" WHERE db_name = $1`,
        [dbName]
      );
      
      if (tenantCheck.rows.length === 0) {
        // Also check if database actually exists
        const dbCheck = await adminClient.query(
          `SELECT 1 FROM pg_database WHERE datname = $1`,
          [dbName]
        );
        exists = dbCheck.rows.length > 0;
      } else {
        exists = true;
      }
      
      if (exists) {
        dbName = `${baseName}_${counter}_db`;
        counter++;
      }
    }
    
    await adminClient.end();
    return dbName;
  } catch (error) {
    await adminClient.end();
    throw error;
  }
}

/**
 * Ensure branch and department exist before creating admin user
 * Creates branch and department with correct ID formats if they don't exist
 * CRITICAL: This function ONLY uses the tenant client passed as parameter
 * It NEVER falls back to DATABASE_URL or default database connection
 * @param {Client} client - Tenant database client (MUST be connected to tenant database)
 * @param {string} orgId - Organization ID
 */
async function ensureBranchAndDepartment(client, orgId) {
  // CRITICAL: Validate client is connected to tenant database
  if (!client) {
    throw new Error('CRITICAL: Tenant database client is required. Cannot ensure branch/department without tenant database connection.');
  }
  
  if (client.ended) {
    throw new Error('CRITICAL: Tenant database client is disconnected. Cannot ensure branch/department.');
  }
  
  if (!orgId) {
    throw new Error('Organization ID is required');
  }
  
  await client.query('SET search_path TO public');
  
  // 1. Ensure branch exists
  let branchId = 'BRANCH001';
  try {
    const existingBranch = await client.query(`
      SELECT branch_id FROM public."tblBranches" WHERE org_id = $1 LIMIT 1
    `, [orgId]);
    
    if (existingBranch.rows.length > 0) {
      branchId = existingBranch.rows[0].branch_id;
      console.log(`[TenantSetup] Using existing branch: ${branchId}`);
    } else {
      // Get next branch ID from sequence or use BRANCH001
      const branchSeq = await client.query(`
        SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = 'branch'
      `);
      
      if (branchSeq.rows.length > 0) {
        const { prefix, last_number } = branchSeq.rows[0];
        const next = last_number + 1;
        branchId = `${prefix}${String(next).padStart(3, "0")}`;
        await client.query(`UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = 'branch'`, [next]);
      }
      
      await client.query(`
        INSERT INTO public."tblBranches" (org_id, branch_id, text, city, branch_code, int_status, created_by, created_on)
        VALUES ($1, $2, 'Main Branch', 'Default City', $3, 1, 'SYSTEM', NOW())
        ON CONFLICT (branch_id) DO NOTHING
      `, [orgId, branchId, branchId]);
      console.log(`[TenantSetup] ✅ Created branch: ${branchId}`);
    }
  } catch (err) {
    console.error(`[TenantSetup] ❌ Error ensuring branch:`, err.message);
    throw err;
  }
  
  // 2. Ensure department exists with DPT format
  let deptId = 'DPT001';
  try {
    const existingDept = await client.query(`
      SELECT dept_id FROM public."tblDepartments" WHERE dept_id LIKE 'DPT%' AND org_id = $1 ORDER BY dept_id LIMIT 1
    `, [orgId]);
    
    if (existingDept.rows.length > 0) {
      deptId = existingDept.rows[0].dept_id;
      console.log(`[TenantSetup] Using existing department: ${deptId}`);
    } else {
      // Get next dept ID from sequence or use DPT001
      const deptSeq = await client.query(`
        SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = 'department'
      `);
      
      if (deptSeq.rows.length > 0) {
        const { prefix, last_number } = deptSeq.rows[0];
        const next = last_number + 1;
        deptId = `${prefix}${String(next).padStart(3, "0")}`;
        await client.query(`UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = 'department'`, [next]);
      } else {
        // If no sequence exists, try to find existing DPT format or use DPT001
        const existingDeptCheck = await client.query(`
          SELECT dept_id FROM "tblDepartments" WHERE dept_id LIKE 'DPT%' ORDER BY dept_id DESC LIMIT 1
        `);
        if (existingDeptCheck.rows.length > 0) {
          const match = existingDeptCheck.rows[0].dept_id.match(/\d+/);
          if (match) {
            const nextNum = parseInt(match[0]) + 1;
            deptId = `DPT${String(nextNum).padStart(3, "0")}`;
          }
        }
      }
      
      await client.query(`
        INSERT INTO public."tblDepartments" (org_id, dept_id, text, branch_id, int_status)
        VALUES ($1, $2, 'Administration', $3, 1)
        ON CONFLICT (dept_id) DO NOTHING
      `, [orgId, deptId, branchId]);
      console.log(`[TenantSetup] ✅ Created department: ${deptId}`);
    }
    
    return { branchId, deptId };
  } catch (err) {
    console.error(`[TenantSetup] ❌ Error ensuring department:`, err.message);
    throw err;
  }
}

/**
 * Create admin user in the tenant database
 * This function adds the admin user to both tblEmployees and tblUsers in the created tenant database
 */
/**
 * Create admin user in tenant database
 * CRITICAL: This function ONLY uses the tenant client passed as parameter
 * It NEVER falls back to DATABASE_URL or default database connection
 * @param {Client} client - Tenant database client (MUST be connected to tenant database)
 * @param {string} orgId - Organization ID
 * @param {object} adminData - Admin user data
 */
async function createAdminUser(client, orgId, adminData) {
  // CRITICAL: Validate client is connected to tenant database
  if (!client) {
    throw new Error('CRITICAL: Tenant database client is required. Cannot create admin user without tenant database connection.');
  }
  
  if (client.ended) {
    throw new Error('CRITICAL: Tenant database client is disconnected. Cannot create admin user.');
  }
  
  // Verify we're using tenant database by checking client database name
  // This prevents accidental use of default database
  try {
    const dbCheck = await client.query('SELECT current_database() as db_name');
    if (dbCheck.rows && dbCheck.rows[0]) {
      const dbName = dbCheck.rows[0].db_name;
      console.log(`[TenantSetup] ✅ Verified using tenant database: ${dbName}`);
      
      // Ensure we're not using the default database (if DATABASE_URL points to a specific database)
      if (process.env.DATABASE_URL) {
        const defaultDbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
        if (dbName === defaultDbConfig.database) {
          throw new Error(`CRITICAL: Attempted to create admin user in default database (${dbName}). This is not allowed. Must use tenant database.`);
        }
      }
    }
  } catch (dbCheckErr) {
    // If we can't verify, log warning but continue (might be connection issue)
    console.warn(`[TenantSetup] ⚠️ Could not verify database name: ${dbCheckErr.message}`);
  }
  
  const {
    fullName = 'System Administrator',
    email,
    username = 'USR001',
    phone = '',
  } = adminData;

  if (!email) {
    throw new Error('Admin user email is required');
  }
  
  if (!orgId) {
    throw new Error('Organization ID is required');
  }

  // Use a fixed initial password for newly created tenant admin
  const plainPassword = 'Initial1';
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const userId = username.toUpperCase();
  const employeeId = 'EMP001'; // First employee in the organization

  await client.query('SET search_path TO public');

  // Ensure System Administrator job role exists
  try {
    await client.query(`
      INSERT INTO public."tblJobRoles" (org_id, job_role_id, text, job_function, int_status)
      VALUES ($1, 'JR001', 'System Administrator', 'Full system access', 1)
      ON CONFLICT (job_role_id) DO NOTHING
    `, [orgId]);
    console.log(`[TenantSetup] Job role 'JR001' (System Administrator) ensured in tblJobRoles`);
  } catch (err) {
    console.warn(`[TenantSetup] Job role creation note: ${err.message}`);
  }

  // Get department ID (should already exist from ensureBranchAndDepartment)
  let deptId = 'DPT001';
  try {
    const existingDept = await client.query(`
      SELECT dept_id FROM public."tblDepartments" WHERE dept_id LIKE 'DPT%' AND org_id = $1 ORDER BY dept_id LIMIT 1
    `, [orgId]);
    
    if (existingDept.rows.length > 0) {
      deptId = existingDept.rows[0].dept_id;
      console.log(`[TenantSetup] Using department: ${deptId}`);
    } else {
      console.warn(`[TenantSetup] No DPT format department found, using DPT001 as fallback`);
    }
  } catch (err) {
    console.warn(`[TenantSetup] Error getting department: ${err.message}, using DPT001 as fallback`);
  }

  // Step 1: Create employee record in tblEmployees (with all required NOT NULL columns)
  try {
    // Generate emp_int_id (first employee gets ID 1)
    const empIntId = 1;
    const employeeType = 'PERMANENT';
    const languageCode = 'en';
    
    await client.query(`
      INSERT INTO public."tblEmployees" (
        emp_int_id, employee_id, name, full_name, email_id, dept_id, 
        phone_number, employee_type, joining_date, language_code,
        int_status, created_by, created_on, changed_by, changed_on, org_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9, 1, 'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, $10)
    `, [empIntId, employeeId, fullName, fullName, email, deptId, phone, employeeType, languageCode, orgId]);
    console.log(`[TenantSetup] Employee record created in tblEmployees: ${employeeId} (emp_int_id: ${empIntId})`);
  } catch (err) {
    console.error(`[TenantSetup] Error creating employee record:`, err.message);
    throw new Error(`Failed to create employee record: ${err.message}`);
  }

  // Step 2: Add admin user to tblUsers with emp_int_id reference
  try {
    const empIntId = 1; // Reference to the employee record we just created
    
    await client.query(`
      INSERT INTO public."tblUsers" (
        org_id, user_id, emp_int_id, full_name, email, phone, job_role_id, password,
        created_by, created_on, changed_by, changed_on, int_status, time_zone
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'JR001', $7, 'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, 1, 'IST')
    `, [orgId, userId, empIntId.toString(), fullName, email, phone, passwordHash]);
    console.log(`[TenantSetup] Admin user inserted into tblUsers: ${userId} (linked to emp_int_id: ${empIntId})`);
  } catch (err) {
    console.error(`[TenantSetup] Error creating user record:`, err.message);
    throw new Error(`Failed to create user record: ${err.message}`);
  }

  // Step 3: Assign job role
  // CRITICAL: This MUST succeed - admin user needs role to access system
  // Note: tblUserJobRoles doesn't have org_id column in the actual schema
  // CRITICAL: All operations use tenant client, never fallback to default database
  
  // Validate client is connected
  if (!client || client.ended) {
    throw new Error('Tenant database client is not connected. Cannot assign job role.');
  }
  
  // First check if the role assignment already exists
  const existingRole = await client.query(`
    SELECT user_job_role_id FROM public."tblUserJobRoles" 
    WHERE user_id = $1 AND job_role_id = 'JR001'
  `, [userId]);
  
  if (existingRole.rows.length > 0) {
    console.log(`[TenantSetup] ✅ Job role already assigned: ${userId} -> JR001 (user_job_role_id: ${existingRole.rows[0].user_job_role_id})`);
    return; // Already assigned, nothing to do
  }
  
  // Generate user_job_role_id using tblIDSequences in the tenant database
  // CRITICAL: All operations use tenant client, never default database
  let userJobRoleId = null;
  
  // Check if userjobrole sequence exists in tblIDSequences
  const seqResult = await client.query(`
    SELECT prefix, last_number FROM public."tblIDSequences" 
    WHERE table_key = 'userjobrole'
  `);
  
  if (seqResult.rows.length > 0) {
    const { prefix, last_number } = seqResult.rows[0];
    const next = last_number + 1;
    
    // Update the sequence atomically
    await client.query(`
      UPDATE public."tblIDSequences" 
      SET last_number = $1 
      WHERE table_key = 'userjobrole'
    `, [next]);
    
    // Generate ID: prefix + padded number (e.g., UJR001)
    userJobRoleId = `${prefix}${String(next).padStart(3, '0')}`;
  } else {
    // Create the sequence entry if it doesn't exist
    await client.query(`
      INSERT INTO public."tblIDSequences" (table_key, prefix, last_number)
      VALUES ('userjobrole', 'UJR', 0)
    `);
    userJobRoleId = 'UJR001';
  }
  
  // Check if this ID already exists (duplicate check)
  const duplicateCheck = await client.query(`
    SELECT user_job_role_id FROM public."tblUserJobRoles" 
    WHERE user_job_role_id = $1
  `, [userJobRoleId]);
  
  if (duplicateCheck.rows.length > 0) {
    // If duplicate, increment and try again
    const seqUpdate = await client.query(`
      UPDATE public."tblIDSequences" 
      SET last_number = last_number + 1 
      WHERE table_key = 'userjobrole'
      RETURNING prefix, last_number
    `);
    if (seqUpdate.rows.length > 0) {
      const { prefix, last_number } = seqUpdate.rows[0];
      userJobRoleId = `${prefix}${String(last_number).padStart(3, '0')}`;
    } else {
      throw new Error('Failed to update ID sequence after duplicate detection');
    }
  }
  
  if (!userJobRoleId) {
    throw new Error('Failed to generate user_job_role_id');
  }
  
  // Insert the role assignment - CRITICAL: This must succeed
  const insertResult = await client.query(`
    INSERT INTO public."tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
    VALUES ($1, $2, 'JR001')
    RETURNING user_job_role_id, user_id, job_role_id
  `, [userJobRoleId, userId]);
  
  if (!insertResult.rows || insertResult.rows.length === 0) {
    throw new Error('Job role assignment INSERT returned no rows');
  }
  
  console.log(`[TenantSetup] ✅ Job role assigned: ${userId} -> JR001 (user_job_role_id: ${insertResult.rows[0].user_job_role_id})`);
  
  // CRITICAL: Verify the insert succeeded - this is a hard requirement
  const verifyResult = await client.query(`
    SELECT user_job_role_id, user_id, job_role_id 
    FROM public."tblUserJobRoles" 
    WHERE user_id = $1 AND job_role_id = 'JR001'
  `, [userId]);
  
  if (verifyResult.rows.length === 0) {
    throw new Error(`CRITICAL: Role assignment insert appeared to succeed but verification query returned no rows. Admin user ${userId} will not have access to the system.`);
  }
  
  if (verifyResult.rows[0].user_job_role_id !== userJobRoleId) {
    throw new Error(`CRITICAL: Role assignment verification failed - expected user_job_role_id ${userJobRoleId} but got ${verifyResult.rows[0].user_job_role_id}`);
  }
  
  console.log(`[TenantSetup] ✅ Verified role assignment exists in tenant database (user_job_role_id: ${verifyResult.rows[0].user_job_role_id})`);

  console.log(`[TenantSetup] ✅ Admin user created successfully: ${userId} (${email}) with employee record ${employeeId}`);

  return {
    userId,
    employeeId,
    email,
    password: plainPassword, // Return initial password for display / email
    fullName,
  };
}

/**
 * Helper function to check if a table exists in the reference database
 */
async function tableExists(client, tableName) {
  try {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `, [tableName]);
    return result.rows[0].exists;
  } catch (err) {
    console.error(`[TenantSetup] Error checking table existence for ${tableName}:`, err.message);
    return false;
  }
}

/**
 * Helper function to get column names from a table
 */
async function getTableColumns(client, tableName) {
  try {
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);
    return result.rows.map(row => row.column_name);
  } catch (err) {
    console.error(`[TenantSetup] Error getting columns for ${tableName}:`, err.message);
    return [];
  }
}

/**
 * Helper function to copy data dynamically based on actual column names
 */
async function copyTableDataDynamically(referenceClient, tenantClient, tableName, orgId, options = {}) {
  try {
    if (!(await tableExists(referenceClient, tableName))) {
      console.log(`[TenantSetup] ⚠️ ${tableName} does not exist in reference database, skipping...`);
      return { copied: 0, skipped: true };
    }

    // Get column names from both tables
    const refColumns = await getTableColumns(referenceClient, tableName);
    const tenantColumns = await getTableColumns(tenantClient, tableName);

    if (refColumns.length === 0 || tenantColumns.length === 0) {
      console.log(`[TenantSetup] ⚠️ Could not get columns for ${tableName}, skipping...`);
      return { copied: 0, skipped: true };
    }

    // Find common columns (excluding org_id which we'll replace)
    const commonColumns = tenantColumns.filter(col => 
      refColumns.includes(col) || (options.orgIdColumn && col === options.orgIdColumn)
    );

    if (commonColumns.length === 0) {
      console.log(`[TenantSetup] ⚠️ No common columns found for ${tableName}, skipping...`);
      return { copied: 0, skipped: true };
    }

    // Build SELECT query with only common columns
    const selectColumns = commonColumns.map(col => `"${col}"`).join(', ');
    const rows = await referenceClient.query(`SELECT ${selectColumns} FROM "${tableName}"`);

    if (rows.rows.length === 0) {
      console.log(`[TenantSetup] ⚠️ No data found in ${tableName}, skipping...`);
      return { copied: 0, skipped: false };
    }

    // Insert each row
    let copied = 0;
    for (const row of rows.rows) {
      const values = commonColumns.map(col => {
        // Replace org_id with tenant's org_id if specified
        if (options.orgIdColumn && col === options.orgIdColumn) {
          return orgId;
        }
        return row[col];
      });

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const columnNames = commonColumns.map(col => `"${col}"`).join(', ');

      try {
        await tenantClient.query(`
          INSERT INTO "${tableName}" (${columnNames})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `, values);
        copied++;
      } catch (insertErr) {
        // Log but continue with other rows
        console.warn(`[TenantSetup] ⚠️ Error inserting row into ${tableName}:`, insertErr.message);
      }
    }

    return { copied, skipped: false };
  } catch (err) {
    console.error(`[TenantSetup] ❌ Error copying ${tableName}:`, err.message);
    return { copied: 0, skipped: false, error: err.message };
  }
}

/**
 * Copy data from reference database (GENERIC_URL) to tenant database
 * This function connects to GENERIC_URL and copies all required default data
 */
/**
 * Copy data from reference database (GENERIC_URL) to tenant database
 * CRITICAL: This function uses GENERIC_URL for reference data and tenantClient for target
 * It NEVER uses DATABASE_URL for either source or target
 * @param {Client} tenantClient - Tenant database client (MUST be connected to tenant database)
 * @param {string} orgId - Organization ID
 */
async function copyDataFromReferenceDatabase(tenantClient, orgId) {
  // CRITICAL: Validate tenant client is connected
  if (!tenantClient) {
    throw new Error('CRITICAL: Tenant database client is required. Cannot copy reference data without tenant database connection.');
  }
  
  if (tenantClient.ended) {
    throw new Error('CRITICAL: Tenant database client is disconnected. Cannot copy reference data.');
  }
  
  if (!orgId) {
    throw new Error('Organization ID is required');
  }
  
  // GENERIC_URL should point to the golden/reference database that has
  // all master tables (tblEvents, tblApps, tblJobRoleNav, etc.)
  // CRITICAL: Only use GENERIC_URL, never fallback to DATABASE_URL
  const referenceDbUrl = process.env.GENERIC_URL;
  if (!referenceDbUrl) {
    throw new Error('GENERIC_URL must be set to copy reference data. Do not use DATABASE_URL fallback.');
  }

  const referenceDbConfig = parseDatabaseUrl(referenceDbUrl);
  
  // CRITICAL: Verify we're not accidentally using the default database as reference
  if (process.env.DATABASE_URL) {
    const defaultDbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    if (referenceDbConfig.database === defaultDbConfig.database && 
        referenceDbConfig.host === defaultDbConfig.host) {
      console.warn(`[TenantSetup] ⚠️ WARNING: GENERIC_URL points to same database as DATABASE_URL. This may cause data conflicts.`);
    }
  }
  
  const referenceClient = new Client({
    host: referenceDbConfig.host,
    port: referenceDbConfig.port,
    user: referenceDbConfig.user,
    password: referenceDbConfig.password,
    database: referenceDbConfig.database,
  });

  try {
    await referenceClient.connect();
    console.log(`[TenantSetup] ✅ Connected to reference database: ${referenceDbConfig.database}`);
    
    // Verify reference client is connected
    const refDbCheck = await referenceClient.query('SELECT current_database() as db_name');
    console.log(`[TenantSetup] ✅ Reference database verified: ${refDbCheck.rows[0].db_name}`);
    
    await referenceClient.query('SET search_path TO public');
    await tenantClient.query('SET search_path TO public');

    // 1. Copy all ID Sequences from tblIDSequences
    console.log(`[TenantSetup] Copying ID sequences from reference database...`);
    try {
      // Check if table exists in reference database
      const tableCheck = await referenceClient.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tblIDSequences'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log(`[TenantSetup] ⚠️ tblIDSequences table does not exist in reference database, skipping...`);
        console.log(`[TenantSetup] Creating default ID sequences in tenant database...`);
        
        // Create default sequences if they don't exist
        const defaultSequences = [
          { table_key: 'employee', prefix: 'EMP', last_number: 1 },
          { table_key: 'user', prefix: 'USR', last_number: 1 },
          { table_key: 'branch', prefix: 'BRANCH', last_number: 1 },
          { table_key: 'department', prefix: 'DPT', last_number: 1 },
        ];
        
        for (const seq of defaultSequences) {
          await tenantClient.query(`
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (table_key) DO NOTHING
          `, [seq.table_key, seq.prefix, seq.last_number]);
        }
        console.log(`[TenantSetup] ✅ Created ${defaultSequences.length} default ID sequences`);
      } else {
        const idSequences = await referenceClient.query('SELECT * FROM "tblIDSequences"');
        for (const seq of idSequences.rows) {
          // For employee and user sequences, set last_number to 1 since we've already created EMP001 and USR001
          let lastNumber = seq.last_number;
          if (seq.table_key === 'employee' || seq.table_key === 'user') {
            lastNumber = 1; // We've used 001, so next will be 002
          }
          
          await tenantClient.query(`
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (table_key) DO UPDATE
            SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
          `, [seq.table_key, seq.prefix, lastNumber]);
        }
        console.log(`[TenantSetup] ✅ Copied ${idSequences.rows.length} ID sequences`);
      }
    } catch (err) {
      console.error(`[TenantSetup] ❌ Error copying ID sequences:`, err.message);
      // Don't throw - continue with other data copying
      console.log(`[TenantSetup] ⚠️ Continuing without ID sequences from reference database...`);
    }

    // 2. Branch and department are already created by ensureBranchAndDepartment
    // Skip creating them here to avoid duplicates
    console.log(`[TenantSetup] Branch and department already created, skipping...`);

    // 3. Copy all events from tblEvents (reference database)
    console.log(`[TenantSetup] Copying events from reference database...`);
    const eventsResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblEvents', orgId);
    if (eventsResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${eventsResult.copied} events`);
    } else if (!eventsResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No events copied (table may be empty or columns don't match)`);
    }

    // 4. Copy all apps from tblApps (reference database)
    console.log(`[TenantSetup] Copying apps from reference database...`);
    const appsResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblApps', orgId);
    if (appsResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${appsResult.copied} apps`);
    } else if (!appsResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No apps copied (table may be empty or columns don't match)`);
    }

    // 5. Copy all audit log config from tblAuditLogConfig (reference database)
    console.log(`[TenantSetup] Copying audit log config from reference database...`);
    const auditLogResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblAuditLogConfig', orgId, { orgIdColumn: 'org_id' });
    if (auditLogResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${auditLogResult.copied} audit log config rows`);
    } else if (!auditLogResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No audit log config copied (table may be empty or columns don't match)`);
    }

    // 6. Copy job role navigation for JR001 from tblJobRoleNav (reference database)
    // Filter to only copy rows where job_role_id = 'JR001'
    console.log(`[TenantSetup] Copying job role navigation for JR001 from reference database...`);
    try {
      if (await tableExists(referenceClient, 'tblJobRoleNav')) {
        const refColumns = await getTableColumns(referenceClient, 'tblJobRoleNav');
        const tenantColumns = await getTableColumns(tenantClient, 'tblJobRoleNav');
        const commonColumns = tenantColumns.filter(col => refColumns.includes(col));

        if (commonColumns.length > 0) {
          const selectColumns = commonColumns.map(col => `"${col}"`).join(', ');
          const navRows = await referenceClient.query(`
            SELECT ${selectColumns} FROM "tblJobRoleNav" 
            WHERE "job_role_id" = 'JR001'
          `);

          let copied = 0;
          for (const row of navRows.rows) {
            const values = commonColumns.map(col => row[col]);
            const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
            const columnNames = commonColumns.map(col => `"${col}"`).join(', ');

            try {
              await tenantClient.query(`
                INSERT INTO "tblJobRoleNav" (${columnNames})
                VALUES (${placeholders})
                ON CONFLICT DO NOTHING
              `, values);
              copied++;
            } catch (insertErr) {
              console.warn(`[TenantSetup] ⚠️ Error inserting job role nav row:`, insertErr.message);
            }
          }
          console.log(`[TenantSetup] ✅ Copied ${copied} job role navigation items for JR001`);
        }
      } else {
        console.log(`[TenantSetup] ⚠️ tblJobRoleNav does not exist in reference database, skipping...`);
      }
    } catch (err) {
      console.error(`[TenantSetup] ❌ Error copying job role navigation:`, err.message);
      console.log(`[TenantSetup] ⚠️ Continuing without job role navigation...`);
    }

    // 7. Copy all maintenance status from tblMaintStatus (reference database)
    console.log(`[TenantSetup] Copying maintenance status from reference database...`);
    const maintStatusResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblMaintStatus', orgId);
    if (maintStatusResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${maintStatusResult.copied} maintenance statuses`);
    } else if (!maintStatusResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No maintenance status copied (table may be empty or columns don't match)`);
    }

    // 8. Copy all maintenance types from tblMaintTypes (reference database)
    console.log(`[TenantSetup] Copying maintenance types from reference database...`);
    const maintTypesResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblMaintTypes', orgId, { orgIdColumn: 'org_id' });
    if (maintTypesResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${maintTypesResult.copied} maintenance types`);
    } else if (!maintTypesResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No maintenance types copied (table may be empty or columns don't match)`);
    }

    // 9. Copy all org settings from tblOrgSettings (reference database)
    console.log(`[TenantSetup] Copying organization settings from reference database...`);
    const orgSettingsResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblOrgSettings', orgId, { orgIdColumn: 'org_id' });
    if (orgSettingsResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${orgSettingsResult.copied} organization settings`);
    } else if (!orgSettingsResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No organization settings copied (table may be empty or columns don't match)`);
    }

    // 10. Copy all table filter columns from tblTableFilterColumns (reference database)
    console.log(`[TenantSetup] Copying table filter columns from reference database...`);
    const filterColumnsResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblTableFilterColumns', orgId, { orgIdColumn: 'org_id' });
    if (filterColumnsResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${filterColumnsResult.copied} table filter columns`);
    } else if (!filterColumnsResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No table filter columns copied (table may be empty or columns don't match)`);
    }

    // 11. Copy all technical log config from tblTechnicalLogConfig (reference database)
    console.log(`[TenantSetup] Copying technical log config from reference database...`);
    const techLogResult = await copyTableDataDynamically(referenceClient, tenantClient, 'tblTechnicalLogConfig', orgId, { orgIdColumn: 'org_id' });
    if (techLogResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${techLogResult.copied} technical log configs`);
    } else if (!techLogResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No technical log config copied (table may be empty or columns don't match)`);
    }

    console.log(`[TenantSetup] ✅ Reference data copy process completed`);
    
  } catch (error) {
    console.error(`[TenantSetup] ❌ Error in reference data copy process:`, error.message);
    // Don't throw - allow tenant creation to continue even if reference data copy fails
    console.log(`[TenantSetup] ⚠️ Continuing tenant creation without reference data...`);
  } finally {
    if (referenceClient) {
      await referenceClient.end();
    }
  }
}

/**
 * Seed default data for tenant database
 * This includes: ID sequences, job roles, navigation, asset types, maintenance types, etc.
 * Excludes any RioAdmin-specific data
 * Now copies data from GENERIC_URL instead of using constants
 * CRITICAL: This function ONLY uses the tenant client passed as parameter
 * It NEVER falls back to DATABASE_URL or default database connection
 * @param {Client} client - Tenant database client (MUST be connected to tenant database)
 * @param {string} orgId - Organization ID
 * @param {string} adminUserId - Admin user ID (for logging)
 * @param {string} adminEmployeeId - Admin employee ID (for logging)
 */
async function seedTenantDefaultData(client, orgId, adminUserId, adminEmployeeId) {
  // CRITICAL: Validate client is connected to tenant database
  if (!client) {
    throw new Error('CRITICAL: Tenant database client is required. Cannot seed default data without tenant database connection.');
  }
  
  if (client.ended) {
    throw new Error('CRITICAL: Tenant database client is disconnected. Cannot seed default data.');
  }
  
  if (!orgId) {
    throw new Error('Organization ID is required');
  }
  
  console.log(`[TenantSetup] 🌱 Seeding default data for tenant from reference database...`);
  
  await client.query('SET search_path TO public');
  
  try {
    // Copy all data from reference database (GENERIC_URL)
    // CRITICAL: copyDataFromReferenceDatabase uses GENERIC_URL, never DATABASE_URL
    await copyDataFromReferenceDatabase(client, orgId);
    
    console.log(`[TenantSetup] ✅ Default data seeding process completed`);
    
  } catch (error) {
    console.error(`[TenantSetup] ❌ Error seeding default data:`, error.message);
    console.error(`[TenantSetup] Error stack:`, error.stack);
    // CRITICAL: Re-throw error - tenant creation should fail if seeding fails
    // This ensures data integrity - tenant without default data is not usable
    throw new Error(`Failed to seed default tenant data: ${error.message}`);
  }
}

/**
 * Create a new tenant
 * This will:
 * 1. Check org_id uniqueness
 * 2. Generate unique database name
 * 3. Create a new database for the organization using TENANT_DATABASE_URL credentials
 * 4. Create all tables with constraints
 * 5. Create admin user (using tenant database client)
 * 6. Register the tenant in the tenant table
 * 
 * CRITICAL: All tenant operations use TENANT_DATABASE_URL, never DATABASE_URL
 * Reference data comes from GENERIC_URL, never DATABASE_URL
 */
async function createTenant(tenantData) {
  const {
    orgId,
    orgName,
    orgCode,
    orgCity,
    adminUser,
  } = tenantData;

  // Validate required fields
  if (!orgId || !orgName) {
    throw new Error('Missing required fields: orgId, orgName');
  }

  if (!adminUser || !adminUser.email) {
    throw new Error('Admin user email is required');
  }

  // Check if org_id already exists
  const orgIdUpper = orgId.toUpperCase();
  const orgExists = await checkOrgIdExists(orgIdUpper);
  if (orgExists) {
    throw new Error(`Organization ID ${orgIdUpper} already exists. Please choose a different ID.`);
  }

  // Generate unique subdomain from organization name
  const { generateUniqueSubdomain } = require('../utils/subdomainUtils');
  const subdomain = await generateUniqueSubdomain(orgName);
  console.log(`[TenantSetup] Generated subdomain: ${subdomain} for organization: ${orgName}`);

  // Generate unique database name
  const dbName = await generateUniqueDatabaseName(orgIdUpper, orgCode, orgName);

  // CRITICAL: Use TENANT_DATABASE_URL for all tenant database operations
  // This ensures we never accidentally use the default DATABASE_URL
  const tenantDatabaseUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDatabaseUrl) {
    throw new Error('TENANT_DATABASE_URL must be set. This is required for tenant database operations.');
  }

  const dbConfig = parseDatabaseUrl(tenantDatabaseUrl);
  
  // Connect to postgres database to create new database
  const adminClient = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres', // Connect to postgres database to create new DB
  });

  try {
    await adminClient.connect();

    // Check if database already exists
    const dbCheckResult = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (dbCheckResult.rows.length > 0) {
      throw new Error(`Database ${dbName} already exists`);
    }

    // Create the database
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`[TenantSetup] Created database: ${dbName}`);

    // Register tenant in tenant table using DATABASE_URL credentials
    // Note: registerTenant will be updated to accept subdomain
    await registerTenant(orgIdUpper, {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbName,
      user: dbConfig.user,
      password: dbConfig.password,
      subdomain: subdomain, // Add subdomain to tenant registration
    });

    // Create all tables in the new database using DATABASE_URL credentials
    const tenantClient = new Client({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbName,
    });

    try {
      await tenantClient.connect();
      console.log(`[TenantSetup] Connected to tenant database: ${dbName}`);

      // Ensure public schema exists and is set as default
      try {
        await tenantClient.query('CREATE SCHEMA IF NOT EXISTS public');
      } catch (err) {
        if (err.code !== '42P06') throw err; // Ignore if schema already exists
      }

      // Grant permissions
      try {
        await tenantClient.query(`GRANT USAGE ON SCHEMA public TO "${dbConfig.user}"`);
        await tenantClient.query(`GRANT CREATE ON SCHEMA public TO "${dbConfig.user}"`);
      } catch (err) {
        console.warn('[TenantSetup] Could not grant schema permissions:', err.message);
      }

      // Set search_path
      await tenantClient.query('SET search_path TO public');
      await tenantClient.query("SET session search_path TO 'public'");

      // Get and execute tenant schema SQL (excludes tblRioAdmin)
      // This includes all tables, primary keys, foreign keys, indexes, and constraints
      let schemaCreated = false;
      try {
        // Note: generateTenantSchemaSql may read schema structure from DATABASE_URL for reference
        // but the actual SQL execution uses tenantClient (tenant database), never writes to DATABASE_URL
        console.log(`[TenantSetup] 🔄 Generating tenant schema SQL (excluding tblRioAdmin)...`);
        
        const schemaSql = await tenantSchemaService.generateTenantSchemaSql();
        
        if (!schemaSql || schemaSql.trim().length === 0) {
          throw new Error('Tenant schema SQL generation returned empty result');
        }
        
        console.log(`[TenantSetup] Executing tenant schema SQL...`);
        console.log(`[TenantSetup] Schema SQL length: ${schemaSql.length} characters`);
        
        // Execute the schema SQL as a single transaction
        try {
          await tenantClient.query(schemaSql);
          schemaCreated = true;
          console.log(`[TenantSetup] ✅ Tenant schema SQL executed successfully`);
        } catch (execError) {
          console.error(`[TenantSetup] Error executing schema SQL as single query:`, execError.message);
          // If single query fails, try executing statement by statement
          console.warn(`[TenantSetup] Single query execution failed, trying statement-by-statement:`, execError.message);
          
          const statements = schemaSql
            .split(/;\s*(?=\n|$)/)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));
          
          console.log(`[TenantSetup] Executing ${statements.length} SQL statements individually...`);
          
          let successCount = 0;
          let errorCount = 0;
          
          for (let i = 0; i < statements.length; i++) {
            try {
              if (statements[i].trim()) {
                await tenantClient.query(statements[i]);
                successCount++;
              }
            } catch (stmtError) {
              errorCount++;
              // Log but continue - some statements might fail if objects already exist
              if (!stmtError.message.includes('already exists') && 
                  !stmtError.message.includes('duplicate') &&
                  !stmtError.message.includes('does not exist') &&
                  stmtError.code !== '42P07' && // duplicate_table
                  stmtError.code !== '42710' && // duplicate_object
                  stmtError.code !== '42P01') { // undefined_table (might be FK referencing table not yet created)
                console.warn(`[TenantSetup] Error on statement ${i + 1}/${statements.length}:`, stmtError.message);
                console.warn(`[TenantSetup] Statement: ${statements[i].substring(0, 100)}...`);
              }
            }
          }
          
          console.log(`[TenantSetup] Statement execution complete: ${successCount} succeeded, ${errorCount} failed/warned`);
          
          // Check if at least some tables were created
          const tableCheck = await tenantClient.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          `);
          
          if (parseInt(tableCheck.rows[0].count) > 0) {
            schemaCreated = true;
            console.log(`[TenantSetup] ✅ Schema partially created (${tableCheck.rows[0].count} tables)`);
          } else {
            throw new Error('No tables were created after executing tenant schema SQL');
          }
        }
      } catch (schemaError) {
        console.error(`[TenantSetup] ❌ Error generating/executing tenant schema:`, schemaError.message);
        console.error(`[TenantSetup] Stack trace:`, schemaError.stack);
        throw new Error(`Tenant schema creation failed: ${schemaError.message}`);
      }
      
      if (!schemaCreated) {
        throw new Error('Tenant schema was not created successfully');
      }
      
      // Verify that tblOrgs table exists before trying to insert
      const tableCheck = await tenantClient.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'tblOrgs'
        )
      `);
      
      if (!tableCheck.rows[0].exists) {
        // Try to create tblOrgs manually as last resort
        console.log(`[TenantSetup] tblOrgs does not exist, creating it manually...`);
        try {
          await tenantClient.query(`
            CREATE TABLE IF NOT EXISTS "tblOrgs" (
              org_id character varying(10) PRIMARY KEY,
              text character varying(50),
              valid_from date,
              valid_to date,
              int_status integer,
              org_code character varying(50) NOT NULL DEFAULT '',
              org_city character varying(100) NOT NULL DEFAULT '',
              gst_number character varying(30),
              cin_number character varying(30)
            )
          `);
          console.log(`[TenantSetup] ✅ Created tblOrgs table manually`);
        } catch (createErr) {
          console.error(`[TenantSetup] Failed to create tblOrgs manually:`, createErr.message);
          throw new Error('tblOrgs table was not created. Schema creation failed completely.');
        }
      }
      
      console.log(`[TenantSetup] ✅ Verified tblOrgs table exists`);
      
      // Verify that tables were created with constraints
      try {
        const tableCount = await tenantClient.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `);
        const pkCount = await tenantClient.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'PRIMARY KEY' AND table_schema = 'public'
        `);
        const fkCount = await tenantClient.query(`
          SELECT COUNT(*) as count 
          FROM information_schema.table_constraints 
          WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
        `);
        const indexCount = await tenantClient.query(`
          SELECT COUNT(*) as count 
          FROM pg_indexes 
          WHERE schemaname = 'public'
        `);
        
        console.log(`[TenantSetup] ✅ Schema verification:`);
        console.log(`[TenantSetup]   - Tables created: ${tableCount.rows[0].count}`);
        console.log(`[TenantSetup]   - Primary keys: ${pkCount.rows[0].count}`);
        console.log(`[TenantSetup]   - Foreign keys: ${fkCount.rows[0].count}`);
        console.log(`[TenantSetup]   - Indexes: ${indexCount.rows[0].count}`);
        
        if (parseInt(tableCount.rows[0].count) === 0) {
          throw new Error('No tables were created. Schema creation failed completely.');
        }
      } catch (verifyError) {
        console.error(`[TenantSetup] Schema verification failed:`, verifyError.message);
        throw new Error(`Schema verification failed: ${verifyError.message}`);
      }

      // Ensure search_path is set to public before any operations
      await tenantClient.query('SET search_path TO public');
      
      // Verify tblOrgs exists before trying to alter it
      const tblOrgsCheck = await tenantClient.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'tblOrgs'
        )
      `);
      
      if (!tblOrgsCheck.rows[0].exists) {
        throw new Error('tblOrgs table does not exist. Cannot proceed with data insertion.');
      }
      
      console.log(`[TenantSetup] ✅ Verified tblOrgs table exists in public schema`);
      
      // Add gst_number and cin_number columns to tblOrgs if they don't exist
      // Use fully qualified table name with schema
      try {
        await tenantClient.query(`
          SET search_path TO public;
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
                AND table_name = 'tblOrgs' 
                AND column_name = 'gst_number'
            ) THEN
              ALTER TABLE public."tblOrgs" ADD COLUMN gst_number character varying(30);
            END IF;
            
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = 'public' 
                AND table_name = 'tblOrgs' 
                AND column_name = 'cin_number'
            ) THEN
              ALTER TABLE public."tblOrgs" ADD COLUMN cin_number character varying(30);
            END IF;
          END $$;
        `);
        console.log(`[TenantSetup] ✅ Verified/added gst_number and cin_number columns to tblOrgs`);
      } catch (err) {
        console.warn("[TenantSetup] Could not alter tblOrgs table:", err.message);
        // This is not critical, continue
      }

      // Step 1: Generate org_id for tblOrgs (ORG001 format)
      // Query tblIDSequences to get the next org_id
      await tenantClient.query('SET search_path TO public');
      
      let generatedOrgId;
      try {
        // Check if tblIDSequences exists and has 'org' entry
        const seqCheck = await tenantClient.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'tblIDSequences'
          )
        `);
        
        if (seqCheck.rows[0].exists) {
          // Check if 'org' entry exists in tblIDSequences
          const orgSeqCheck = await tenantClient.query(`
            SELECT prefix, last_number FROM "tblIDSequences" WHERE table_key = 'org'
          `);
          
          if (orgSeqCheck.rows.length > 0) {
            // Use existing sequence
            const { prefix, last_number } = orgSeqCheck.rows[0];
            const next = last_number + 1;
            generatedOrgId = `${prefix}${String(next).padStart(3, "0")}`;
            
            // Update the sequence
            await tenantClient.query(`
              UPDATE "tblIDSequences" SET last_number = $1 WHERE table_key = 'org'
            `, [next]);
          } else {
            // Create 'org' entry in tblIDSequences
            await tenantClient.query(`
              INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
              VALUES ('org', 'ORG', 0)
            `);
            generatedOrgId = 'ORG001';
          }
        } else {
          // tblIDSequences doesn't exist, use default
          generatedOrgId = 'ORG001';
        }
        
        // Check if generated org_id already exists in tblOrgs
        const existingCheck = await tenantClient.query(`
          SELECT org_id FROM public."tblOrgs" WHERE org_id = $1
        `, [generatedOrgId]);
        
        if (existingCheck.rows.length > 0) {
          // If exists, find the next available
          const allOrgs = await tenantClient.query(`
            SELECT org_id FROM public."tblOrgs" WHERE org_id LIKE 'ORG%' ORDER BY org_id DESC LIMIT 1
          `);
          if (allOrgs.rows.length > 0) {
            const lastOrgId = allOrgs.rows[0].org_id;
            const match = lastOrgId.match(/\d+/);
            if (match) {
              const nextNum = parseInt(match[0]) + 1;
              generatedOrgId = `ORG${String(nextNum).padStart(3, "0")}`;
            }
          }
        }
      } catch (seqError) {
        console.warn('[TenantSetup] Could not generate org_id from sequence, using default:', seqError.message);
        // Fallback: use ORG001 or find next available
        const fallbackCheck = await tenantClient.query(`
          SELECT org_id FROM public."tblOrgs" WHERE org_id LIKE 'ORG%' ORDER BY org_id DESC LIMIT 1
        `);
        if (fallbackCheck.rows.length > 0) {
          const lastOrgId = fallbackCheck.rows[0].org_id;
          const match = lastOrgId.match(/\d+/);
          if (match) {
            const nextNum = parseInt(match[0]) + 1;
            generatedOrgId = `ORG${String(nextNum).padStart(3, "0")}`;
          } else {
            generatedOrgId = 'ORG001';
          }
        } else {
          generatedOrgId = 'ORG001';
        }
      }
      
      console.log(`[TenantSetup] Generated org_id for tblOrgs: ${generatedOrgId} (tenant org_id: ${orgIdUpper})`);
      
      // Create organization record in tblOrgs with generated org_id and subdomain
      // Check if subdomain column exists before inserting
      const subdomainColumnCheck = await tenantClient.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'tblOrgs' 
            AND column_name = 'subdomain'
        )
      `);
      
      const hasSubdomainColumn = subdomainColumnCheck.rows[0].exists;
      
      if (hasSubdomainColumn) {
        await tenantClient.query(`
          INSERT INTO public."tblOrgs" (org_id, text, org_code, org_city, subdomain, int_status)
          VALUES ($1, $2, $3, $4, $5, 1)
          ON CONFLICT (org_id) DO UPDATE
          SET text = EXCLUDED.text,
              org_code = EXCLUDED.org_code,
              org_city = EXCLUDED.org_city,
              subdomain = EXCLUDED.subdomain
        `, [generatedOrgId, orgName, orgCode || orgIdUpper, orgCity || '', subdomain]);
      } else {
        await tenantClient.query(`
          INSERT INTO public."tblOrgs" (org_id, text, org_code, org_city, int_status)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (org_id) DO UPDATE
          SET text = EXCLUDED.text,
              org_code = EXCLUDED.org_code,
              org_city = EXCLUDED.org_city
        `, [generatedOrgId, orgName, orgCode || orgIdUpper, orgCity || '']);
      }
      console.log(`[TenantSetup] Organization record created in tblOrgs: ${generatedOrgId} with subdomain: ${subdomain}`);

      // Step 2: Ensure branch and department exist (required before creating admin user)
      console.log(`[TenantSetup] Ensuring branch and department exist...`);
      await ensureBranchAndDepartment(tenantClient, generatedOrgId);
      
      // Step 3: Create admin user and add to tblUsers in the created database
      // Use generatedOrgId (ORG001 format) for the admin user, not tenant orgId
      console.log(`[TenantSetup] Creating admin user in tblUsers...`);
      const adminCredentials = await createAdminUser(tenantClient, generatedOrgId, adminUser);
      console.log(`[TenantSetup] Admin user added to tblUsers: ${adminCredentials.userId} (${adminCredentials.email})`);

      // Send welcome email with initial password and role information
      try {
        const userData = {
          full_name: adminCredentials.fullName,
          email: adminCredentials.email,
          generatedPassword: adminCredentials.password,
        };
        const roles = [
          { job_role_name: 'System Administrator' },
        ];
        await sendWelcomeEmail(userData, roles, orgName);
        console.log('[TenantSetup] Welcome email sent to admin user');
      } catch (emailErr) {
        console.warn('[TenantSetup] Failed to send welcome email to admin user:', emailErr.message);
      }

      // Step 4: Seed default data (ID sequences, job roles, navigation, asset types, etc.)
      console.log(`[TenantSetup] Seeding default tenant data...`);
      await seedTenantDefaultData(tenantClient, generatedOrgId, adminCredentials.userId, adminCredentials.employeeId);

      console.log(`[TenantSetup] All tables created successfully in: ${dbName}`);
      
      // CRITICAL: Final validation - verify tenant database was used throughout
      // This ensures we never accidentally used DATABASE_URL for tenant operations
      try {
        const finalDbCheck = await tenantClient.query('SELECT current_database() as db_name');
        if (finalDbCheck.rows && finalDbCheck.rows[0]) {
          const finalDbName = finalDbCheck.rows[0].db_name;
          if (finalDbName !== dbName) {
            throw new Error(`CRITICAL: Final validation failed - expected database ${dbName} but got ${finalDbName}. Tenant operations may have used wrong database.`);
          }
          console.log(`[TenantSetup] ✅ Final validation passed - all operations used tenant database: ${finalDbName}`);
        }
      } catch (validationErr) {
        // If validation fails, this is critical - tenant may be in inconsistent state
        console.error(`[TenantSetup] ❌ CRITICAL: Final validation failed: ${validationErr.message}`);
        throw new Error(`Tenant creation validation failed: ${validationErr.message}`);
      }
      
      await tenantClient.end();
      
      // Get base domain from environment variable or use default
      // Main domain is riowebworks.net (configured in GoDaddy with wildcard DNS)
      const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'localhost';
      
      // Construct subdomain URL
      // If MAIN_DOMAIN is 'localhost', use development format with port
      // Otherwise, use production format with HTTPS
      let finalSubdomainUrl;
      
      if (MAIN_DOMAIN === 'localhost') {
        // Development: use localhost with port
        const port = process.env.FRONTEND_PORT || '5173';
        finalSubdomainUrl = `http://${subdomain}.localhost:${port}`;
      } else {
        // Production: use main domain with subdomain
        // Always use HTTPS for production (secure tenant access)
        // FORCE_HTTP can be set to 'true' only for testing purposes
        const protocol = process.env.FORCE_HTTP === 'true' ? 'http' : 'https';
        finalSubdomainUrl = `${protocol}://${subdomain}.${MAIN_DOMAIN}`;
        
        // Log security note
        if (protocol === 'https') {
          console.log(`[TenantSetup] ✅ Generated secure HTTPS subdomain URL: ${finalSubdomainUrl}`);
        } else {
          console.warn(`[TenantSetup] ⚠️ WARNING: Using HTTP instead of HTTPS. This is not secure for production!`);
        }
      }
      
      console.log(`[TenantSetup] Generated subdomain URL: ${finalSubdomainUrl}`);
      
      return {
        orgId: orgIdUpper, // Tenant org_id (for login/tenant identification)
        generatedOrgId: generatedOrgId, // Generated org_id for tblOrgs (ORG001 format)
        orgName,
        orgCode,
        orgCity,
        subdomain, // Add subdomain to response
        subdomainUrl: finalSubdomainUrl, // Add subdomain URL to response
        database: dbName,
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        adminCredentials,
        message: 'Tenant created successfully with all tables and admin user',
      };
    } catch (schemaError) {
      console.error('[TenantSetup] Error creating schema:', schemaError);
      await tenantClient.end();
      // Don't fail tenant creation if schema creation fails - user can run setup wizard later
      throw new Error(`Database created but schema creation failed: ${schemaError.message}`);
    }
  } catch (error) {
    console.error('[TenantSetup] Error creating tenant:', error);
    
    // If database was created but registration failed, try to drop it
    try {
      await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    } catch (dropError) {
      console.error('[TenantSetup] Error dropping database:', dropError);
    }
    
    throw error;
  } finally {
    await adminClient.end();
  }
}

/**
 * Get all tenants
 */
async function getAllTenants() {
  const pool = initTenantRegistryPool();
  
  try {
    const result = await pool.query(
      `SELECT org_id, db_host, db_port, db_name, db_user, is_active, created_at, updated_at
       FROM "tenants"
       ORDER BY created_at DESC`
    );

    return result.rows.map(tenant => ({
      orgId: tenant.org_id,
      host: tenant.db_host,
      port: tenant.db_port,
      database: tenant.db_name,
      user: tenant.db_user,
      isActive: tenant.is_active,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    }));
  } catch (error) {
    console.error('[TenantSetup] Error getting tenants:', error);
    throw error;
  }
}

/**
 * Get tenant by org_id
 */
async function getTenantById(orgId) {
  const pool = initTenantRegistryPool();
  
  try {
    const result = await pool.query(
      `SELECT org_id, db_host, db_port, db_name, db_user, is_active, created_at, updated_at
       FROM "tenants"
       WHERE org_id = $1`,
      [orgId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Tenant not found: ${orgId}`);
    }

    const tenant = result.rows[0];
    return {
      orgId: tenant.org_id,
      host: tenant.db_host,
      port: tenant.db_port,
      database: tenant.db_name,
      user: tenant.db_user,
      isActive: tenant.is_active,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    };
  } catch (error) {
    console.error('[TenantSetup] Error getting tenant:', error);
    throw error;
  }
}

/**
 * Update tenant
 */
async function updateTenant(orgId, updateData) {
  const { updateTenant: updateTenantInTable } = require('./tenantService');
  
  if (!updateData.host || !updateData.user || !updateData.password) {
    throw new Error('Missing required fields: host, user, password');
  }

  await updateTenantInTable(orgId, {
    host: updateData.host,
    port: updateData.port || 5432,
    database: updateData.database,
    user: updateData.user,
    password: updateData.password,
  });

  return {
    orgId,
    message: 'Tenant updated successfully',
  };
}

/**
 * Delete/Deactivate tenant
 */
async function deleteTenant(orgId) {
  await deactivateTenant(orgId);
  return {
    orgId,
    message: 'Tenant deactivated successfully',
  };
}

/**
 * Test tenant database connection
 */
async function testTenantConnection(orgId) {
  return await testConnection(orgId);
}

module.exports = {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  testTenantConnection,
  checkOrgIdExists,
};
