const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { registerTenant, deactivateTenant, testTenantConnection: testConnection } = require('./tenantService');
const { initTenantRegistryPool } = require('./tenantService');
const tenantSchemaService = require('./tenantSchemaService');
const { generateCustomId } = require('../utils/idGenerator');
const {
  DEFAULT_ASSET_TYPES,
  DEFAULT_PROD_SERVICES,
  DEFAULT_ORG_SETTINGS,
  DEFAULT_EVENTS,
  DEFAULT_APPS,
  DEFAULT_AUDIT_EVENTS,
  DEFAULT_MAINT_TYPES,
  DEFAULT_MAINT_STATUS,
  DEFAULT_ID_SEQUENCES,
  DEFAULT_JOB_ROLES,
  DEFAULT_JOB_ROLE_NAV,
} = require('../constants/setupDefaults');
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
  const tenantDbUrl = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!tenantDbUrl) {
    throw new Error('TENANT_DATABASE_URL or DATABASE_URL must be set');
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
 * Create admin user in the tenant database
 * This function adds the admin user to both tblEmployees and tblUsers in the created tenant database
 */
async function createAdminUser(client, orgId, adminData) {
  const {
    fullName = 'System Administrator',
    email,
    password,
    username = 'USR001',
    phone = '',
  } = adminData;

  if (!email || !password) {
    throw new Error('Admin user email and password are required');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const userId = username.toUpperCase();
  const employeeId = 'EMP001'; // First employee in the organization

  await client.query('SET search_path TO public');

  // Ensure System Administrator job role exists
  try {
    await client.query(`
      INSERT INTO public."tblJobRoles" (job_role_id, text, job_function, int_status)
      VALUES ('JR001', 'System Administrator', 'Full system access', 1)
      ON CONFLICT (job_role_id) DO NOTHING
    `);
    console.log(`[TenantSetup] Job role 'JR001' (System Administrator) ensured in tblJobRoles`);
  } catch (err) {
    console.warn(`[TenantSetup] Job role creation note: ${err.message}`);
  }

  // Step 1: Create employee record in tblEmployees (without email - it doesn't exist in schema)
  try {
    await client.query(`
      INSERT INTO public."tblEmployees" (
        org_id, employee_id, full_name, phone,
        created_by, created_on, changed_by, changed_on, int_status
      )
      VALUES ($1, $2, $3, $4, 'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, 1)
      ON CONFLICT (employee_id) DO UPDATE
      SET full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone
    `, [orgId, employeeId, fullName, phone]);
    console.log(`[TenantSetup] Employee record created in tblEmployees: ${employeeId}`);
  } catch (err) {
    console.error(`[TenantSetup] Error creating employee record:`, err.message);
    throw new Error(`Failed to create employee record: ${err.message}`);
  }

  // Step 2: Add admin user to tblUsers with employee_id reference
  try {
    await client.query(`
      INSERT INTO public."tblUsers" (
        org_id, user_id, employee_id, full_name, email, phone, job_role_id, password,
        created_by, created_on, changed_by, changed_on, int_status, time_zone
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'JR001', $7, 'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, 1, 'IST')
      ON CONFLICT (user_id) DO UPDATE
      SET employee_id = EXCLUDED.employee_id,
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          password = EXCLUDED.password
    `, [orgId, userId, employeeId, fullName, email, phone, passwordHash]);
    console.log(`[TenantSetup] Admin user inserted into tblUsers: ${userId} (linked to ${employeeId})`);
  } catch (err) {
    console.error(`[TenantSetup] Error creating user record:`, err.message);
    throw new Error(`Failed to create user record: ${err.message}`);
  }

  // Step 3: Assign job role
  try {
    await client.query(`
      INSERT INTO public."tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
      VALUES ('UJR001', $1, 'JR001')
      ON CONFLICT (user_job_role_id) DO NOTHING
    `, [userId]);
    console.log(`[TenantSetup] Job role assigned: ${userId} -> JR001`);
  } catch (err) {
    console.warn(`[TenantSetup] User job role assignment note: ${err.message}`);
  }

  console.log(`[TenantSetup] ✅ Admin user created successfully: ${userId} (${email}) with employee record ${employeeId}`);

  return {
    userId,
    employeeId,
    email,
    password, // Return plain password for display
    fullName,
  };
}

/**
 * Seed default data for tenant database
 * This includes: ID sequences, job roles, navigation, asset types, maintenance types, etc.
 * Excludes any RioAdmin-specific data
 */
async function seedTenantDefaultData(client, orgId, adminUserId, adminEmployeeId) {
  console.log(`[TenantSetup] 🌱 Seeding default data for tenant...`);
  
  await client.query('SET search_path TO public');
  
  try {
    // 1. Seed ID Sequences
    console.log(`[TenantSetup] Seeding ID sequences...`);
    for (const seq of DEFAULT_ID_SEQUENCES) {
      try {
        // For employee and user sequences, set last_number to 1 since we've already created EMP001 and USR001
        let lastNumber = seq.last_number;
        if (seq.table_key === 'employee' || seq.table_key === 'user') {
          lastNumber = 1; // We've used 001, so next will be 002
        }
        
        await client.query(`
          INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
          VALUES ($1, $2, $3)
          ON CONFLICT (table_key) DO UPDATE
          SET last_number = GREATEST("tblIDSequences".last_number, EXCLUDED.last_number)
        `, [seq.table_key, seq.prefix, lastNumber]);
      } catch (err) {
        console.warn(`[TenantSetup] ID Sequence ${seq.table_key}:`, err.message);
      }
    }
    
    // 2. Seed Job Roles (System Administrator already created in createAdminUser)
    console.log(`[TenantSetup] Seeding job roles...`);
    for (const role of DEFAULT_JOB_ROLES) {
      try {
        await client.query(`
          INSERT INTO "tblJobRoles" (job_role_id, text, job_function, int_status)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (job_role_id) DO NOTHING
        `, [role.job_role_id, role.text, role.job_function, role.int_status]);
      } catch (err) {
        console.warn(`[TenantSetup] Job Role ${role.job_role_id}:`, err.message);
      }
    }
    
    // 3. Seed Job Role Navigation (for System Administrator role)
    console.log(`[TenantSetup] Seeding job role navigation...`);
    const navItemsForJR001 = DEFAULT_JOB_ROLE_NAV.filter(nav => nav.job_role_id === 'JR001');
    for (const nav of navItemsForJR001) {
      try {
        await client.query(`
          INSERT INTO "tblJobRoleNav" (job_role_id, display_text, path_url)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [nav.job_role_id, nav.display_text, nav.path_url]);
      } catch (err) {
        console.warn(`[TenantSetup] Navigation ${nav.display_text}:`, err.message);
      }
    }
    
    // 4. Seed Asset Types
    console.log(`[TenantSetup] Seeding asset types...`);
    for (const assetType of DEFAULT_ASSET_TYPES) {
      try {
        await client.query(`
          INSERT INTO "tblAssetTypes" (
            asset_type_id, text, asset_assignment_type, inspection_req, 
            group_req, maint_req, maint_type_id, serial_format, 
            depreciation_type, description, int_status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1)
          ON CONFLICT (asset_type_id) DO NOTHING
        `, [
          assetType.id,
          assetType.name,
          assetType.assignmentType,
          assetType.inspectionRequired,
          assetType.groupRequired,
          assetType.maintRequired,
          assetType.maintTypeId || null,
          assetType.serialFormat,
          assetType.depreciationType,
          assetType.description
        ]);
      } catch (err) {
        console.warn(`[TenantSetup] Asset Type ${assetType.id}:`, err.message);
      }
    }
    
    // 5. Seed Product/Services
    console.log(`[TenantSetup] Seeding products/services...`);
    for (const prodServ of DEFAULT_PROD_SERVICES) {
      try {
        await client.query(`
          INSERT INTO "tblProdServ" (prod_serv_id, text, int_status)
          VALUES ($1, $2, 1)
          ON CONFLICT (prod_serv_id) DO NOTHING
        `, [prodServ.id, prodServ.name]);
      } catch (err) {
        console.warn(`[TenantSetup] Prod/Service ${prodServ.id}:`, err.message);
      }
    }
    
    // 6. Seed Maintenance Types
    console.log(`[TenantSetup] Seeding maintenance types...`);
    for (const maintType of DEFAULT_MAINT_TYPES) {
      try {
        await client.query(`
          INSERT INTO "tblMaintTypes" (maint_type_id, text, int_status)
          VALUES ($1, $2, 1)
          ON CONFLICT (maint_type_id) DO NOTHING
        `, [maintType.id, maintType.name]);
      } catch (err) {
        console.warn(`[TenantSetup] Maint Type ${maintType.id}:`, err.message);
      }
    }
    
    // 7. Seed Maintenance Status
    console.log(`[TenantSetup] Seeding maintenance status...`);
    for (const maintStatus of DEFAULT_MAINT_STATUS) {
      try {
        await client.query(`
          INSERT INTO "tblMaintStatus" (status_id, status_text, int_status)
          VALUES ($1, $2, 1)
          ON CONFLICT (status_id) DO NOTHING
        `, [maintStatus.id, maintStatus.text]);
      } catch (err) {
        console.warn(`[TenantSetup] Maint Status ${maintStatus.id}:`, err.message);
      }
    }
    
    // 8. Seed Events
    console.log(`[TenantSetup] Seeding events...`);
    for (const event of DEFAULT_EVENTS) {
      try {
        await client.query(`
          INSERT INTO "tblEvents" (event_id, event_text)
          VALUES ($1, $2)
          ON CONFLICT (event_id) DO NOTHING
        `, [event.id, event.text]);
      } catch (err) {
        console.warn(`[TenantSetup] Event ${event.id}:`, err.message);
      }
    }
    
    // 9. Seed Apps
    console.log(`[TenantSetup] Seeding apps...`);
    for (const app of DEFAULT_APPS) {
      try {
        await client.query(`
          INSERT INTO "tblApps" (app_id, app_name)
          VALUES ($1, $2)
          ON CONFLICT (app_id) DO NOTHING
        `, [app.id, app.name]);
      } catch (err) {
        console.warn(`[TenantSetup] App ${app.id}:`, err.message);
      }
    }
    
    // 10. Seed Audit Events
    console.log(`[TenantSetup] Seeding audit events...`);
    for (const auditEvent of DEFAULT_AUDIT_EVENTS) {
      try {
        await client.query(`
          INSERT INTO "tblAuditEvents" (app_id, event_id, event_name, description)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (app_id, event_id) DO NOTHING
        `, [auditEvent.app_id, auditEvent.event_id, auditEvent.event_name, auditEvent.description]);
      } catch (err) {
        console.warn(`[TenantSetup] Audit Event ${auditEvent.app_id}-${auditEvent.event_id}:`, err.message);
      }
    }
    
    // 11. Seed Organization Settings (no super_access_users for tenant)
    console.log(`[TenantSetup] Seeding organization settings...`);
    for (const setting of DEFAULT_ORG_SETTINGS) {
      // Skip super_access_users setting as it's only for main org with RioAdmin
      if (setting.setting_key === 'super_access_users') {
        console.log(`[TenantSetup] Skipping super_access_users setting (not applicable for tenant)`);
        continue;
      }
      
      try {
        await client.query(`
          INSERT INTO "tblOrgSettings" (org_id, setting_key, setting_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (org_id, setting_key) DO UPDATE
          SET setting_value = EXCLUDED.setting_value
        `, [orgId, setting.setting_key, setting.setting_value]);
      } catch (err) {
        console.warn(`[TenantSetup] Org Setting ${setting.setting_key}:`, err.message);
      }
    }
    
    console.log(`[TenantSetup] ✅ Default data seeded successfully`);
    
  } catch (error) {
    console.error(`[TenantSetup] ❌ Error seeding default data:`, error.message);
    throw error;
  }
}

/**
 * Create a new tenant
 * This will:
 * 1. Check org_id uniqueness
 * 2. Generate unique database name
 * 3. Create a new database for the organization using DATABASE_URL credentials
 * 4. Create all tables with constraints
 * 5. Create admin user
 * 6. Register the tenant in the tenant table
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

  if (!adminUser || !adminUser.email || !adminUser.password) {
    throw new Error('Admin user email and password are required');
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

  // Parse DATABASE_URL to get connection details for creating new database
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set');
  }

  const dbConfig = parseDatabaseUrl(databaseUrl);
  
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
        console.log(`[TenantSetup] 🔄 Generating tenant schema from DATABASE_URL (excluding tblRioAdmin)...`);
        
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

      // Step 2: Create admin user and add to tblUsers in the created database
      // Use generatedOrgId (ORG001 format) for the admin user, not tenant orgId
      console.log(`[TenantSetup] Creating admin user in tblUsers...`);
      const adminCredentials = await createAdminUser(tenantClient, generatedOrgId, adminUser);
      console.log(`[TenantSetup] Admin user added to tblUsers: ${adminCredentials.userId} (${adminCredentials.email})`);

      // Step 3: Seed default data (ID sequences, job roles, navigation, asset types, etc.)
      console.log(`[TenantSetup] Seeding default tenant data...`);
      await seedTenantDefaultData(tenantClient, generatedOrgId, adminCredentials.userId, adminCredentials.employeeId);

      console.log(`[TenantSetup] All tables created successfully in: ${dbName}`);
      
      await tenantClient.end();
      
      // Get base domain from environment variable or use default
      // Main domain is riowebworks.net (configured in GoDaddy with wildcard DNS)
      const MAIN_DOMAIN = process.env.MAIN_DOMAIN || 'riowebworks.net';
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      // Construct subdomain URL
      // For development, use subdomain.localhost:port format
      // For production, use subdomain.riowebworks.net format with HTTPS (secure)
      let finalSubdomainUrl;
      
      if (isDevelopment) {
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
