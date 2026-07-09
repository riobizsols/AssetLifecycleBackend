const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { registerTenant, deactivateTenant, testTenantConnection: testConnection } = require('./tenantService');
const { initTenantRegistryPool } = require('./tenantService');
const tenantSchemaService = require('./tenantSchemaService');
const setupWizardService = require('./setupWizardService');
const {
  ensureJobMonitorTables,
  ensureAtInspCertStructure,
  ensureReferenceViews,
  getReferenceUrl,
} = require('./tenantSchemaAlignService');
const { seedRequiredMasterData, alignTenantColumnsFromReference } = require('./tenantReferenceDataService');
const { finalizeTenantForeignKeys } = require('./tenantForeignKeyService');
const { applyNavigationGroupModel } = require('../utils/navigationGroupUtils');
const { seedDefaultJobRoleNav } = require('../utils/seedDefaultJobRoleNav');
const { syncIdSequencesFromData } = require('./tenantIdFormatService');
const { seedTextMessages } = require('../utils/seedTextMessages');
const { generateCustomIdForClient } = require('../utils/idGenerator');
const { DEFAULT_ID_SEQUENCES, DEFAULT_JOB_ROLES, DEFAULT_JOB_ROLE_NAV } = require('../constants/setupDefaults');
const { sendWelcomeEmail } = require('../utils/mailer');
const { registerTenantEmail } = require('./tenantEmailRegistryService');
const {
  getPgSslOption,
  getPgClientConnectTimeoutMs,
  parseDatabaseUrl,
  pgClientOptsFromDatabaseUrl,
} = require('../utils/pgSslOption');
// Removed DEFAULT constants - all data now comes from reference database (GENERIC_URL)
require('dotenv').config();

function pgClientOpts(base) {
  return {
    ...base,
    ssl: getPgSslOption(),
    connectionTimeoutMillis: getPgClientConnectTimeoutMs(),
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

async function checkSubdomainExists(subdomain) {
  const { isSubdomainAvailable } = require('../utils/subdomainUtils');
  const available = await isSubdomainAvailable(subdomain);
  return !available;
}

function getProposedDatabaseName(subdomain) {
  const baseName = String(subdomain || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  return `${baseName}_db`;
}

async function isDatabaseNameTaken(dbName) {
  const pool = initTenantRegistryPool();
  const tenantCheck = await pool.query(
    `SELECT org_id FROM "tenants" WHERE db_name = $1`,
    [dbName],
  );
  if (tenantCheck.rows.length > 0) {
    return true;
  }

  const tenantDbUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDbUrl) {
    return false;
  }

  const tenantDbConfig = parseDatabaseUrl(tenantDbUrl);
  const adminClient = new Client(pgClientOpts({
    host: tenantDbConfig.host,
    port: tenantDbConfig.port,
    user: tenantDbConfig.user,
    password: tenantDbConfig.password,
    database: 'postgres',
  }));

  try {
    await adminClient.connect();
    const dbCheck = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName],
    );
    return dbCheck.rows.length > 0;
  } finally {
    await adminClient.end();
  }
}

/**
 * Verify login domain (subdomain) and proposed Postgres database name are both free.
 */
async function checkDomainAndDatabaseAvailability(subdomainInput) {
  const { validateSubdomain } = require('../utils/subdomainUtils');
  const normalizedSubdomain = validateSubdomain(subdomainInput);
  const databaseName = getProposedDatabaseName(normalizedSubdomain);
  const subdomainTaken = await checkSubdomainExists(normalizedSubdomain);
  const databaseTaken = await isDatabaseNameTaken(databaseName);
  const available = !subdomainTaken && !databaseTaken;

  let message;
  if (subdomainTaken && databaseTaken) {
    message = `Login domain "${normalizedSubdomain}" and database "${databaseName}" are already taken.`;
  } else if (subdomainTaken) {
    message = `Login domain "${normalizedSubdomain}" is already taken.`;
  } else if (databaseTaken) {
    message = `Database name "${databaseName}" is already taken.`;
  } else {
    message = `Login domain "${normalizedSubdomain}" and database "${databaseName}" are available.`;
  }

  return {
    available,
    subdomain: normalizedSubdomain,
    databaseName,
    subdomainTaken,
    databaseTaken,
    message,
  };
}

function buildSubdomainUrl(subdomain) {
  const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'localhost';

  if (MAIN_DOMAIN === 'localhost') {
    const port = process.env.FRONTEND_PORT || '5175';
    return `http://${subdomain}.localhost:${port}`;
  }

  const protocol = process.env.FORCE_HTTP === 'true' ? 'http' : 'https';
  return `${protocol}://${subdomain}.${MAIN_DOMAIN}`;
}

async function getTenantRegistryRow(orgId) {
  const pool = initTenantRegistryPool();
  const subdomainColumnCheck = await pool.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'tenants' AND column_name = 'subdomain'
    )
  `);
  const hasSubdomainColumn = subdomainColumnCheck.rows[0].exists;
  const columns = hasSubdomainColumn
    ? 'org_id, db_name, subdomain, is_active'
    : 'org_id, db_name, is_active';

  const result = await pool.query(
    `SELECT ${columns} FROM "tenants" WHERE org_id = $1`,
    [orgId.toUpperCase()],
  );

  return result.rows[0] || null;
}

async function getTenantRegistryRowBySubdomain(subdomain) {
  const pool = initTenantRegistryPool();
  const result = await pool.query(
    `SELECT org_id, db_name, subdomain, is_active FROM "tenants" WHERE LOWER(TRIM(subdomain)) = $1`,
    [String(subdomain || '').trim().toLowerCase()],
  );
  return result.rows[0] || null;
}

function deriveRegistryOrgId(subdomain) {
  const normalized = String(subdomain || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) {
    throw new Error('Invalid domain name for tenant registry');
  }
  return normalized.slice(0, 10);
}

async function tryResolveExistingTenant(orgIdUpper, subdomain, adminUser, orgName, orgCity) {
  const row = await getTenantRegistryRowBySubdomain(subdomain);
  if (!row || row.is_active === false) {
    return null;
  }

  const rowSubdomain = (row.subdomain || '').trim().toLowerCase();
  const tenantDatabaseUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDatabaseUrl) {
    throw new Error('TENANT_DATABASE_URL must be set.');
  }

  const dbConfig = parseDatabaseUrl(tenantDatabaseUrl);
  const adminClient = new Client(pgClientOpts({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres',
  }));

  try {
    await adminClient.connect();
    const dbCheck = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [row.db_name],
    );
    if (dbCheck.rows.length === 0) {
      return null;
    }
  } finally {
    await adminClient.end();
  }

  const effectiveSubdomain = rowSubdomain || subdomain;

  return {
    orgId: orgIdUpper,
    orgName,
    orgCity,
    subdomain: effectiveSubdomain,
    subdomainUrl: buildSubdomainUrl(effectiveSubdomain),
    database: row.db_name,
    alreadyExists: true,
    adminCredentials: {
      email: adminUser.email,
      password: adminUser.password || 'Initial1',
    },
    message: 'Tenant already exists. You can sign in with your credentials.',
  };
}

/**
 * Generate unique database name based on org details
 */
async function generateUniqueDatabaseName(orgId, subdomain) {
  const pool = initTenantRegistryPool();
  
  // Base name from subdomain or org id
  const baseName = (subdomain || orgId).toLowerCase().replace(/[^a-z0-9]/g, '_');
  let dbName = `${baseName}_db`;
  let counter = 1;
  
  // Check if database name already exists
  // CRITICAL: Only use TENANT_DATABASE_URL, never fallback to DATABASE_URL
  const tenantDbUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDbUrl) {
    throw new Error('TENANT_DATABASE_URL must be set. Do not use DATABASE_URL fallback.');
  }
  
  const tenantDbConfig = parseDatabaseUrl(tenantDbUrl);
  const adminClient = new Client(pgClientOpts({
    host: tenantDbConfig.host,
    port: tenantDbConfig.port,
    user: tenantDbConfig.user,
    password: tenantDbConfig.password,
    database: 'postgres',
  }));
  
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
 * Seed default ID sequences from setupDefaults before creating branch/department.
 * Uses ON CONFLICT DO NOTHING so reference DB copies can still merge later.
 */
async function seedDefaultIdSequences(client) {
  for (const entry of DEFAULT_ID_SEQUENCES) {
    await client.query(
      `
        INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
        VALUES ($1, $2, $3)
        ON CONFLICT (table_key) DO NOTHING
      `,
      [entry.tableKey, entry.prefix, entry.lastNumber]
    );
  }
  console.log(`[TenantSetup] ✅ Default ID sequences seeded (${DEFAULT_ID_SEQUENCES.length} entries)`);
}

/**
 * Ensure branch and department exist before creating admin user
 * Creates branch and department with correct ID formats if they don't exist
 * CRITICAL: This function ONLY uses the tenant client passed as parameter
 * It NEVER falls back to DATABASE_URL or default database connection
 * @param {Client} client - Tenant database client (MUST be connected to tenant database)
 * @param {string} orgId - Organization ID
 */
async function ensureBranchAndDepartment(client, orgId, adminUserId = 'USR001', orgCity = '') {
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
  let branchId;
  try {
    const existingBranch = await client.query(`
      SELECT branch_id FROM public."tblBranches" WHERE org_id = $1 LIMIT 1
    `, [orgId]);
    
    if (existingBranch.rows.length > 0) {
      branchId = existingBranch.rows[0].branch_id;
      console.log(`[TenantSetup] Using existing branch: ${branchId}`);
    } else {
      branchId = await generateCustomIdForClient(client, 'branch', 3);

      await client.query(`
        INSERT INTO public."tblBranches" (
          org_id, branch_id, text, city, branch_code, int_status,
          created_by, created_on, changed_by, changed_on
        )
        VALUES ($1, $2, 'Main Branch', $4, 'HO', 1, $3, NOW(), $3, NOW())
        ON CONFLICT (branch_id) DO NOTHING
      `, [orgId, branchId, adminUserId, (orgCity || '').trim()]);
      if (!/^BR\d{3}$/.test(branchId)) {
        throw new Error(`Generated branch_id "${branchId}" does not match expected format BR###`);
      }
      console.log(`[TenantSetup] ✅ Created branch: ${branchId}`);
    }
  } catch (err) {
    console.error(`[TenantSetup] ❌ Error ensuring branch:`, err.message);
    throw err;
  }
  
  // 2. Ensure department exists with DPT format
  let deptId;
  try {
    const existingDept = await client.query(`
      SELECT dept_id FROM public."tblDepartments" WHERE dept_id LIKE 'DPT%' AND org_id = $1 ORDER BY dept_id LIMIT 1
    `, [orgId]);
    
    if (existingDept.rows.length > 0) {
      deptId = existingDept.rows[0].dept_id;
      console.log(`[TenantSetup] Using existing department: ${deptId}`);
    } else {
      deptId = await generateCustomIdForClient(client, 'department', 3);

      await client.query(`
        INSERT INTO public."tblDepartments" (
          org_id, dept_id, text, branch_id, int_status,
          parent_id, created_on, changed_on, changed_by, created_by
        )
        VALUES ($1, $2, 'Administration', $3, 1, NULL, CURRENT_DATE, CURRENT_DATE, $4, $4)
        ON CONFLICT (dept_id) DO NOTHING
      `, [orgId, deptId, branchId, adminUserId]);
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
 * @param {{ registryOrgId?: string, subdomain?: string }} registryMeta - Registry DB org_id + subdomain for email lookup
 */
async function createAdminUser(client, orgId, adminData, registryMeta = null) {
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE, $9, 1, $2, CURRENT_DATE, $2, CURRENT_DATE, $10)
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
      VALUES ($1, $2, $3, $4, $5, $6, 'JR001', $7, $2, CURRENT_DATE, $2, CURRENT_DATE, 1, 'IST')
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
  } else {
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
  }

  console.log(`[TenantSetup] ✅ Admin user created successfully: ${userId} (${email}) with employee record ${employeeId}`);

  const credentials = {
    userId,
    employeeId,
    email,
    password: plainPassword, // Return initial password for display / email
    fullName,
  };

  if (registryMeta?.registryOrgId && registryMeta?.subdomain && email) {
    try {
      await registerTenantEmail({
        email,
        orgId: registryMeta.registryOrgId,
        subdomain: registryMeta.subdomain,
        userId,
        employeeId,
        source: 'tenant_registration',
      });
      console.log(`[TenantSetup] Admin email registered in tenant_user_emails: ${email}`);
    } catch (registryErr) {
      console.error(`[TenantSetup] Failed to register admin email in tenant_user_emails: ${registryErr.message}`);
      throw new Error(`Admin user created but email registry failed: ${registryErr.message}`);
    }
  }

  return credentials;
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

async function getNextJobRoleNavNumber(client, startAt = 1) {
  const idResult = await client.query(`
    SELECT job_role_nav_id
    FROM "tblJobRoleNav"
    WHERE job_role_nav_id ~ '^JRN[0-9]+$'
    ORDER BY CAST(SUBSTRING(job_role_nav_id FROM 'JRN([0-9]+)') AS INTEGER) DESC
    LIMIT 1
  `);

  if (idResult.rows.length === 0) {
    return startAt;
  }

  const match = idResult.rows[0].job_role_nav_id.match(/JRN(\d+)/);
  return match ? parseInt(match[1], 10) + 1 : startAt;
}

/**
 * Copy JR001 navigation from reference DB with fresh JRN### ids.
 * parent_id is remapped so menu groups (e.g. Inspection) keep working — app_id is unchanged.
 */
async function copyJobRoleNavigationForRole(referenceClient, tenantClient, orgId, jobRoleId = 'JR001') {
  if (!(await tableExists(referenceClient, 'tblJobRoleNav'))) {
    return { copied: 0, skipped: true };
  }

  const refColumns = await getTableColumns(referenceClient, 'tblJobRoleNav');
  const tenantColumns = await getTableColumns(tenantClient, 'tblJobRoleNav');
  const commonColumns = tenantColumns.filter((col) => refColumns.includes(col));

  if (commonColumns.length === 0) {
    return { copied: 0, skipped: true };
  }

  const selectColumns = commonColumns.map((col) => `"${col}"`).join(', ');
  const navResult = await referenceClient.query(
    `
      SELECT ${selectColumns}
      FROM "tblJobRoleNav"
      WHERE job_role_id = $1
      ORDER BY sequence NULLS LAST, job_role_nav_id
    `,
    [jobRoleId],
  );

  const rows = navResult.rows;
  if (rows.length === 0) {
    return { copied: 0, skipped: false };
  }

  let jrnNum = await getNextJobRoleNavNumber(tenantClient);
  const idMap = new Map();

  for (const row of rows) {
    const newId = `JRN${String(jrnNum).padStart(3, '0')}`;
    idMap.set(row.job_role_nav_id, newId);
    jrnNum += 1;
  }

  let copied = 0;
  for (const row of rows) {
    const newRow = { ...row };
    newRow.job_role_nav_id = idMap.get(row.job_role_nav_id);
    if (row.parent_id && idMap.has(row.parent_id)) {
      newRow.parent_id = idMap.get(row.parent_id);
    }
    if (commonColumns.includes('org_id')) {
      newRow.org_id = orgId;
    }
    if (newRow.is_group === true || newRow.is_group === 't' || newRow.is_group === 1) {
      newRow.app_id = null;
    }

    const values = commonColumns.map((col) => newRow[col]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = commonColumns.map((col) => `"${col}"`).join(', ');

    try {
      await tenantClient.query(
        `
          INSERT INTO "tblJobRoleNav" (${columnNames})
          VALUES (${placeholders})
          ON CONFLICT (job_role_nav_id) DO NOTHING
        `,
        values,
      );
      copied += 1;
    } catch (insertErr) {
      console.warn(`[TenantSetup] ⚠️ Error inserting job role nav row for ${newRow.app_id}:`, insertErr.message);
    }
  }

  const maxJrn = jrnNum - 1;
  if (maxJrn > 0) {
    await tenantClient.query(
      `
        INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
        VALUES ('jobrolenav', 'JRN', $1)
        ON CONFLICT (table_key) DO UPDATE
        SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
      `,
      [maxJrn],
    );
  }

  return { copied, skipped: false, maxJrn };
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

    const remapOrgId = options.remapOrgId !== false && commonColumns.includes('org_id');

    // Insert each row
    let copied = 0;
    for (const row of rows.rows) {
      const values = commonColumns.map(col => {
        // Always use tenant org_id when the column exists (reference DB uses ORG001, etc.)
        if (col === 'org_id' && remapOrgId) {
          return orgId;
        }
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
  
  const referenceDbUrl = getReferenceUrl() || process.env.GENERIC_URL;
  if (!referenceDbUrl) {
    throw new Error('TENANT_SCHEMA_REFERENCE_URL, DATABASE_URL, or GENERIC_URL must be set to copy reference data.');
  }

  const referenceDbConfig = parseDatabaseUrl(referenceDbUrl);

  if (process.env.GENERIC_URL && process.env.DATABASE_URL) {
    const genericDbConfig = parseDatabaseUrl(process.env.GENERIC_URL);
    const defaultDbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
    if (referenceDbConfig.database === genericDbConfig.database &&
        referenceDbConfig.host === genericDbConfig.host) {
      console.warn(`[TenantSetup] ⚠️ WARNING: Reference URL points to GENERIC_URL legacy DB. Use hospitality (DATABASE_URL) instead.`);
    }
    if (referenceDbConfig.database !== defaultDbConfig.database) {
      console.log(`[TenantSetup] Using hospitality reference: ${referenceDbConfig.database}`);
    }
  }
  
  const referenceClient = new Client(pgClientOpts({
    host: referenceDbConfig.host,
    port: referenceDbConfig.port,
    user: referenceDbConfig.user,
    password: referenceDbConfig.password,
    database: referenceDbConfig.database,
  }));

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
        
        for (const entry of DEFAULT_ID_SEQUENCES) {
          await tenantClient.query(`
            INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
            VALUES ($1, $2, $3)
            ON CONFLICT (table_key) DO UPDATE
            SET prefix = EXCLUDED.prefix,
                last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
          `, [entry.tableKey, entry.prefix, entry.lastNumber]);
        }
        console.log(`[TenantSetup] ✅ Created ${DEFAULT_ID_SEQUENCES.length} default ID sequences`);
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

    // 6. Seed JR001 navigation from the System Administrator sidebar template
    console.log(`[TenantSetup] Seeding job role navigation for JR001 from DEFAULT_JOB_ROLE_NAV...`);
    try {
      const navCount = await seedDefaultJobRoleNav(tenantClient, orgId, 'TenantSetup');
      console.log(`[TenantSetup] ✅ Seeded ${navCount} job role navigation items for JR001`);
    } catch (err) {
      console.error(`[TenantSetup] ❌ Error seeding job role navigation:`, err.message);
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

    // 12. Copy multilingual text messages (tblTextMessagesDefault + tblTextMessagesOtherLangs)
    console.log(`[TenantSetup] Copying text messages from reference database...`);
    const textMsgDefaultResult = await copyTableDataDynamically(
      referenceClient,
      tenantClient,
      'tblTextMessagesDefault',
      orgId,
    );
    if (textMsgDefaultResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${textMsgDefaultResult.copied} default text messages`);
    } else if (!textMsgDefaultResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No default text messages copied (table may be empty or columns don't match)`);
    }

    const textMsgOtherResult = await copyTableDataDynamically(
      referenceClient,
      tenantClient,
      'tblTextMessagesOtherLangs',
      orgId,
    );
    if (textMsgOtherResult.copied > 0) {
      console.log(`[TenantSetup] ✅ Copied ${textMsgOtherResult.copied} translated text messages`);
    } else if (!textMsgOtherResult.skipped) {
      console.log(`[TenantSetup] ⚠️ No translated text messages copied (table may be empty or columns don't match)`);
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
 * Copy JR001 navigation from reference DB into tenant (upsert so partial tenants get full menu).
 */
async function copyJobRoleNavFromReference(referenceClient, tenantClient, orgId, { upsert = false } = {}) {
  if (!(await tableExists(referenceClient, 'tblJobRoleNav'))) {
    return { copied: 0, skipped: true, reason: 'no reference tblJobRoleNav' };
  }

  const refColumns = await getTableColumns(referenceClient, 'tblJobRoleNav');
  const tenantColumns = await getTableColumns(tenantClient, 'tblJobRoleNav');
  const commonColumns = tenantColumns.filter((col) => refColumns.includes(col));

  if (commonColumns.length === 0) {
    return { copied: 0, skipped: true, reason: 'no common columns' };
  }

  const selectColumns = commonColumns.map((col) => `"${col}"`).join(', ');
  const navRows = await referenceClient.query(`
    SELECT ${selectColumns} FROM "tblJobRoleNav"
    WHERE "job_role_id" = 'JR001'
  `);

  const conflictClause = upsert && commonColumns.includes('job_role_nav_id')
    ? `ON CONFLICT (job_role_nav_id) DO UPDATE SET ${commonColumns
        .filter((col) => col !== 'job_role_nav_id')
        .map((col) => `"${col}" = EXCLUDED."${col}"`)
        .join(', ')}`
    : 'ON CONFLICT DO NOTHING';

  let copied = 0;
  for (const row of navRows.rows) {
    const values = commonColumns.map((col) => {
      if (col === 'org_id' && orgId) return orgId;
      return row[col];
    });
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = commonColumns.map((col) => `"${col}"`).join(', ');

    try {
      const result = await tenantClient.query(
        `
          INSERT INTO "tblJobRoleNav" (${columnNames})
          VALUES (${placeholders})
          ${conflictClause}
        `,
        values,
      );
      if (!upsert && result.rowCount > 0) copied += 1;
      else if (upsert) copied += 1;
    } catch (insertErr) {
      console.warn(`[TenantSetup] ⚠️ Error inserting job role nav row:`, insertErr.message);
    }
  }

  return { copied, total: navRows.rows.length, skipped: false };
}

/**
 * Insert only JR001 nav rows for app_ids missing on the tenant.
 * Does not overwrite existing rows (preserves custom menu grouping).
 */
async function insertMissingJobRoleNavFromReference(referenceClient, tenantClient, orgId, missingAppIds) {
  if (!missingAppIds?.length) {
    return { copied: 0, total: 0, skipped: true };
  }

  const refColumns = await getTableColumns(referenceClient, 'tblJobRoleNav');
  const tenantColumns = await getTableColumns(tenantClient, 'tblJobRoleNav');
  const commonColumns = tenantColumns.filter((col) => refColumns.includes(col));
  if (!commonColumns.length) {
    return { copied: 0, total: 0, skipped: true, reason: 'no common columns' };
  }

  const selectColumns = commonColumns.map((col) => `"${col}"`).join(', ');
  const placeholders = missingAppIds.map((_, i) => `$${i + 1}`).join(', ');
  const navRows = await referenceClient.query(
    `
      SELECT ${selectColumns}
      FROM "tblJobRoleNav"
      WHERE "job_role_id" = 'JR001'
        AND "int_status" = 1
        AND "app_id" IN (${placeholders})
    `,
    missingAppIds,
  );

  let copied = 0;
  for (const row of navRows.rows) {
    const values = commonColumns.map((col) => {
      if (col === 'org_id' && orgId) return orgId;
      return row[col];
    });
    const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = commonColumns.map((col) => `"${col}"`).join(', ');

    try {
      const result = await tenantClient.query(
        `
          INSERT INTO "tblJobRoleNav" (${columnNames})
          VALUES (${valuePlaceholders})
          ON CONFLICT (job_role_nav_id) DO NOTHING
        `,
        values,
      );
      if (result.rowCount > 0) copied += 1;
    } catch (insertErr) {
      console.warn(`[TenantSetup] ⚠️ Error inserting missing nav row:`, insertErr.message);
    }
  }

  return { copied, total: navRows.rows.length, skipped: false };
}

/**
 * Insert JR001 mobile nav rows (mob_desk = 'M') missing on the tenant.
 * Desktop rows can share the same app_id, so app_id-only sync is not enough.
 */
async function insertMissingMobileNavFromReference(referenceClient, tenantClient, orgId) {
  const refColumns = await getTableColumns(referenceClient, 'tblJobRoleNav');
  const tenantColumns = await getTableColumns(tenantClient, 'tblJobRoleNav');
  const commonColumns = tenantColumns.filter((col) => refColumns.includes(col));
  if (!commonColumns.length) {
    return { copied: 0, updated: 0, total: 0, skipped: true };
  }

  const selectColumns = commonColumns.map((col) => `"${col}"`).join(', ');
  const navRows = await referenceClient.query(
    `
      SELECT ${selectColumns}
      FROM "tblJobRoleNav"
      WHERE "job_role_id" = 'JR001'
        AND "int_status" = 1
        AND "mob_desk" = 'M'
    `,
  );

  const tenantIds = await tenantClient.query(
    `
      SELECT job_role_nav_id, app_id, mob_desk
      FROM "tblJobRoleNav"
      WHERE job_role_id = 'JR001' AND int_status = 1
    `,
  );
  const tenantNavById = new Map(tenantIds.rows.map((row) => [row.job_role_nav_id, row]));

  let copied = 0;
  let updated = 0;

  for (const row of navRows.rows) {
    const existing = tenantNavById.get(row.job_role_nav_id);
    if (!existing) {
      const values = commonColumns.map((col) => {
        if (col === 'org_id' && orgId) return orgId;
        return row[col];
      });
      const valuePlaceholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const columnNames = commonColumns.map((col) => `"${col}"`).join(', ');

      try {
        const result = await tenantClient.query(
          `
            INSERT INTO "tblJobRoleNav" (${columnNames})
            VALUES (${valuePlaceholders})
            ON CONFLICT (job_role_nav_id) DO NOTHING
          `,
          values,
        );
        if (result.rowCount > 0) copied += 1;
      } catch (insertErr) {
        console.warn(`[TenantSetup] ⚠️ Error inserting mobile nav row:`, insertErr.message);
      }
      continue;
    }

    if (row.app_id && !existing.app_id) {
      try {
        const result = await tenantClient.query(
          `
            UPDATE "tblJobRoleNav"
            SET app_id = $1,
                label = COALESCE($2, label),
                mob_desk = 'M',
                access_level = COALESCE($3, access_level),
                is_group = COALESCE($4, is_group)
            WHERE job_role_nav_id = $5
              AND (app_id IS NULL OR btrim(app_id) = '')
          `,
          [row.app_id, row.label, row.access_level, row.is_group, row.job_role_nav_id],
        );
        if (result.rowCount > 0) updated += 1;
      } catch (updateErr) {
        console.warn(`[TenantSetup] ⚠️ Error updating mobile nav row:`, updateErr.message);
      }
    }
  }

  return { copied, updated, total: navRows.rows.length, skipped: false };
}

/**
 * Keep JR001 navigation complete without overwriting custom tenant menu layout.
 * Empty tenants get DEFAULT_JOB_ROLE_NAV; existing tenants only gain missing app rows.
 */
async function ensureJobRoleNavigation(client, orgId) {
  if (!client || !orgId) return { synced: false, count: 0 };

  const tenantCountResult = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND int_status = 1
  `);
  const tenantCount = tenantCountResult.rows[0]?.count || 0;

  const referenceDbUrl = getReferenceUrl() || process.env.GENERIC_URL;
  if (referenceDbUrl) {
    const referenceClient = new Client(pgClientOptsFromDatabaseUrl(referenceDbUrl));

    try {
      await referenceClient.connect();

      const tenantApps = await client.query(`
        SELECT DISTINCT app_id FROM "tblJobRoleNav"
        WHERE job_role_id = 'JR001' AND int_status = 1
      `);
      const tenantAppIds = new Set(tenantApps.rows.map((r) => r.app_id));

      const refApps = await referenceClient.query(`
        SELECT DISTINCT app_id FROM "tblJobRoleNav"
        WHERE job_role_id = 'JR001' AND int_status = 1
      `);
      const missingAppIds = refApps.rows
        .filter((r) => r.app_id && !tenantAppIds.has(r.app_id))
        .map((r) => r.app_id);

      if (tenantCount === 0) {
        console.log(`[TenantSetup] JR001 navigation empty for ${orgId}; seeding default template...`);
        const seeded = await seedDefaultJobRoleNav(client, orgId, 'TenantSetup');
        await copyTableDataDynamically(referenceClient, client, 'tblApps', orgId);
        return { synced: true, count: seeded };
      }

      if (missingAppIds.length > 0) {
        console.log(
          `[TenantSetup] JR001 missing ${missingAppIds.length} app(s) for ${orgId}; inserting without overwriting layout...`,
        );
        const syncResult = await insertMissingJobRoleNavFromReference(
          referenceClient,
          client,
          orgId,
          missingAppIds,
        );
        console.log(`[TenantSetup] ✅ Inserted missing JR001 nav rows (${syncResult.copied}/${syncResult.total})`);
        await copyTableDataDynamically(referenceClient, client, 'tblApps', orgId);
      }

      const mobileSyncResult = await insertMissingMobileNavFromReference(referenceClient, client, orgId);
      if (mobileSyncResult.copied > 0 || mobileSyncResult.updated > 0) {
        console.log(
          `[TenantSetup] ✅ Synced JR001 mobile nav for ${orgId} (inserted ${mobileSyncResult.copied}, updated ${mobileSyncResult.updated})`,
        );
        await copyTableDataDynamically(referenceClient, client, 'tblApps', orgId);
        return {
          synced: true,
          count: tenantCount + mobileSyncResult.copied + mobileSyncResult.updated,
        };
      }

      if (missingAppIds.length > 0) {
        return { synced: true, count: tenantCount };
      }

      return { synced: false, count: tenantCount };
    } catch (err) {
      console.warn(`[TenantSetup] Reference navigation sync failed: ${err.message}`);
    } finally {
      await referenceClient.end().catch(() => {});
    }
  }

  if (tenantCount === 0) {
    const seeded = await seedDefaultJobRoleNav(client, orgId, 'TenantSetup');
    return { synced: true, count: seeded };
  }

  return { synced: false, count: tenantCount };
}

/**
 * Seed default JR001 navigation when tenant DB has none (reference copy miss or legacy tenant).
 */
async function seedDefaultJobRoleNavigationIfMissing(client, orgId) {
  if (!client || !orgId) return { seeded: false, count: 0 };

  const navCount = await client.query(`
    SELECT COUNT(*)::int AS count
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND int_status = 1
  `);

  if ((navCount.rows[0]?.count || 0) > 0) {
    return { seeded: false, count: navCount.rows[0].count };
  }

  console.log(`[TenantSetup] No JR001 navigation found for ${orgId}; seeding defaults...`);

  for (const role of DEFAULT_JOB_ROLES) {
    await client.query(
      `
        INSERT INTO "tblJobRoles" (org_id, job_role_id, text, job_function, int_status)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (job_role_id) DO UPDATE
        SET text = EXCLUDED.text,
            job_function = EXCLUDED.job_function,
            int_status = EXCLUDED.int_status,
            org_id = EXCLUDED.org_id
      `,
      [orgId, role.id, role.name, role.jobFunction, role.intStatus],
    );
  }

  const inserted = await seedDefaultJobRoleNav(client, orgId, 'TenantSetup');
  console.log(`[TenantSetup] ✅ Seeded ${inserted} default navigation items for JR001`);
  return { seeded: true, count: inserted };
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

    const textMsgCount = await client.query(
      'SELECT COUNT(*)::int AS count FROM "tblTextMessagesDefault"',
    );
    if ((textMsgCount.rows[0]?.count || 0) === 0) {
      console.log('[TenantSetup] No text messages found after reference copy; running text message seed...');
      await seedTextMessages(client, { genericUrl: getReferenceUrl() || process.env.GENERIC_URL });
    }

    await ensureJobRoleNavigation(client, orgId);

    console.log('[TenantSetup] Verifying required master data from hospitality...');
    await seedRequiredMasterData(client, { orgId });

    await applyNavigationGroupModel(client, 'TenantSetup');

    console.log('[TenantSetup] Syncing ID sequences from tenant data...');
    await syncIdSequencesFromData(client);

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
    subdomain: subdomainInput,
    orgCity,
    adminUser,
  } = tenantData;

  // Validate required fields
  if (!orgId || !orgName) {
    throw new Error('Missing required fields: orgId, orgName');
  }

  if (!subdomainInput) {
    throw new Error('Sub-domain name is required');
  }

  if (!adminUser || !adminUser.email) {
    throw new Error('Admin user email is required');
  }

  const { validateSubdomain } = require('../utils/subdomainUtils');
  const subdomain = validateSubdomain(subdomainInput);
  const registryOrgId = deriveRegistryOrgId(subdomain);

  const orgIdUpper = orgId.toUpperCase().trim();
  if (orgIdUpper.length > 10) {
    throw new Error('Organization ID must be 10 characters or less.');
  }

  const subdomainExists = await checkSubdomainExists(subdomain);
  if (subdomainExists) {
    const existingTenant = await tryResolveExistingTenant(
      orgIdUpper,
      subdomain,
      adminUser,
      orgName,
      orgCity,
    );
    if (existingTenant) {
      return existingTenant;
    }
    throw new Error(`Sub-domain name "${subdomain}" is already taken. Please choose a different one.`);
  }

  console.log(`[TenantSetup] Using user-specified subdomain: ${subdomain}`);

  // Generate unique database name
  const dbName = await generateUniqueDatabaseName(orgIdUpper, subdomain);

  // CRITICAL: Use TENANT_DATABASE_URL for all tenant database operations
  // This ensures we never accidentally use the default DATABASE_URL
  const tenantDatabaseUrl = process.env.TENANT_DATABASE_URL;
  if (!tenantDatabaseUrl) {
    throw new Error('TENANT_DATABASE_URL must be set. This is required for tenant database operations.');
  }

  const dbConfig = parseDatabaseUrl(tenantDatabaseUrl);
  
  // Connect to postgres database to create new database
  const adminClient = new Client(pgClientOpts({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: 'postgres', // Connect to postgres database to create new DB
  }));

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
    await registerTenant(registryOrgId, {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbName,
      user: dbConfig.user,
      password: dbConfig.password,
      subdomain: subdomain, // Add subdomain to tenant registration
    });

    // Create all tables in the new database using DATABASE_URL credentials
    const tenantClient = new Client(pgClientOpts({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbName,
    }));

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
        let schemaSql;
        let foreignKeysSql = '';
        try {
          // Prefer latest schema snapshot (with optional FK split) from setup wizard service.
          console.log(`[TenantSetup] 🔄 Fetching latest schema from template source...`);
          const schemaResult = await setupWizardService.getSchemaSql(false, true);
          
          // Handle both old string format and new object format
          if (typeof schemaResult === 'string') {
            schemaSql = schemaResult;
          } else if (schemaResult && typeof schemaResult === 'object') {
            schemaSql = schemaResult.schema;
            foreignKeysSql = schemaResult.foreignKeys || '';
            console.log(`[TenantSetup] 📋 Schema without FKs: ${schemaSql.length} chars`);
            console.log(`[TenantSetup] 🔗 Foreign keys: ${foreignKeysSql.length} chars`);
          }
        } catch (schemaSourceError) {
          console.warn(`[TenantSetup] Schema source fetch failed, using tenantSchemaService fallback: ${schemaSourceError.message}`);
          // Fallback: generate tenant schema directly (still executed only on tenantClient).
          schemaSql = await tenantSchemaService.generateTenantSchemaSql();
          foreignKeysSql = '';
        }
        
        if (!schemaSql || schemaSql.trim().length === 0) {
          throw new Error('Tenant schema SQL generation returned empty result');
        }
        
        console.log(`[TenantSetup] Executing tenant schema SQL...`);
        console.log(`[TenantSetup] Schema SQL length: ${schemaSql.length} characters`);
        
        // Execute the schema SQL (WITHOUT foreign keys to avoid constraint violations during seeding)
        // Foreign keys will be added after data is inserted
        try {
          await tenantClient.query(schemaSql);
          schemaCreated = true;
          console.log(`[TenantSetup] ✅ Full schema SQL executed successfully (foreign keys deferred)`);
          
          // Store foreign keys for later application
          if (foreignKeysSql && foreignKeysSql.length > 0) {
            console.log(`[TenantSetup] 📋 Foreign keys will be applied after data seeding (${foreignKeysSql.length} chars)`);
            tenantClient._foreignKeysSql = foreignKeysSql;
            tenantClient._foreignKeysValidCount = schemaResult.validCount || 0;
          }
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

      try {
        console.log('[TenantSetup] Applying tenant schema extras (views, job monitor, AT insp certs)...');
        const referenceDbUrl = getReferenceUrl() || process.env.GENERIC_URL;
        const referenceDbConfig = parseDatabaseUrl(referenceDbUrl);
        const refClient = new Client(pgClientOpts({
          host: referenceDbConfig.host,
          port: referenceDbConfig.port,
          user: referenceDbConfig.user,
          password: referenceDbConfig.password,
          database: referenceDbConfig.database,
        }));
        await ensureJobMonitorTables(tenantClient);
        await ensureAtInspCertStructure(tenantClient);
        try {
          await refClient.connect();
          await ensureReferenceViews(tenantClient, refClient);
        } finally {
          await refClient.end().catch(() => {});
        }
        const columnLog = await alignTenantColumnsFromReference(tenantClient, {
          referenceUrl: referenceDbUrl,
        });
        console.log(
          `[TenantSetup] Column alignment: ${columnLog.summary.applied} applied, ${columnLog.summary.failed} failed`
        );
        console.log('[TenantSetup] ✅ Tenant schema extras applied');
      } catch (extrasError) {
        console.error('[TenantSetup] ❌ Tenant schema extras failed:', extrasError.message);
        throw new Error(`Tenant schema extras failed: ${extrasError.message}`);
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

      // Step 1: Create organization record in tblOrgs using the user-specified org_id
      await tenantClient.query('SET search_path TO public');
      console.log(`[TenantSetup] Using user-specified org_id across tenant database: ${orgIdUpper}`);
      
      // Create organization record in tblOrgs with user-specified org_id and subdomain
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
        `, [orgIdUpper, orgName, orgIdUpper, orgCity || '', subdomain]);
      } else {
        await tenantClient.query(`
          INSERT INTO public."tblOrgs" (org_id, text, org_code, org_city, int_status)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT (org_id) DO UPDATE
          SET text = EXCLUDED.text,
              org_code = EXCLUDED.org_code,
              org_city = EXCLUDED.org_city
        `, [orgIdUpper, orgName, orgIdUpper, orgCity || '']);
      }
      console.log(`[TenantSetup] Organization record created in tblOrgs: ${orgIdUpper} with subdomain: ${subdomain}`);

      // Step 2: Seed ID sequences, then ensure branch and department exist
      console.log(`[TenantSetup] Seeding default ID sequences...`);
      await seedDefaultIdSequences(tenantClient);
      console.log(`[TenantSetup] Ensuring branch and department exist...`);
      const plannedAdminUserId = (adminUser.username || 'USR001').toUpperCase();
      await ensureBranchAndDepartment(tenantClient, orgIdUpper, plannedAdminUserId, orgCity);
      
      // Step 3: Create admin user and add to tblUsers in the created database
      console.log(`[TenantSetup] Creating admin user in tblUsers...`);
      const adminCredentials = await createAdminUser(tenantClient, orgIdUpper, adminUser, {
        registryOrgId,
        subdomain,
      });
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
      await seedTenantDefaultData(tenantClient, orgIdUpper, adminCredentials.userId, adminCredentials.employeeId);
      
      // Apply foreign key constraints after all data has been seeded
      if (tenantClient._foreignKeysSql && tenantClient._foreignKeysSql.length > 0) {
        console.log('[TenantSetup] 🔗 Finalizing foreign key constraints (org_id remap + apply)...');
        await finalizeTenantForeignKeys(
          tenantClient,
          orgIdUpper,
          tenantClient._foreignKeysSql,
          {
            expectedCount: tenantClient._foreignKeysValidCount || 0,
            label: 'TenantSetup',
            adminUserId: adminCredentials.userId,
          },
        );
        console.log('[TenantSetup] ✅ Foreign key constraints applied successfully to tenant database');
      } else {
        console.log('[TenantSetup] ℹ️ No foreign key constraints to apply (already in schema or none generated)');
      }
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

      const finalSubdomainUrl = buildSubdomainUrl(subdomain);
      console.log(`[TenantSetup] Generated subdomain URL: ${finalSubdomainUrl}`);

      return {
        orgId: orgIdUpper,
        orgName,
        orgCity,
        subdomain,
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

    try {
      await adminClient.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await deactivateTenant(registryOrgId);
    } catch (dropError) {
      console.error('[TenantSetup] Error rolling back tenant:', dropError);
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
  checkSubdomainExists,
  checkDomainAndDatabaseAvailability,
  getProposedDatabaseName,
  copyJobRoleNavigationForRole,
  seedDefaultJobRoleNavigationIfMissing,
  ensureJobRoleNavigation,
};
