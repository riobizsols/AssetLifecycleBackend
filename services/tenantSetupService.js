const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { registerTenant, deactivateTenant, testTenantConnection: testConnection } = require('./tenantService');
const { initTenantRegistryPool } = require('./tenantService');
const setupWizardService = require('./setupWizardService');
const { generateCustomId } = require('../utils/idGenerator');
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
 * This function adds the admin user to tblUsers in the created tenant database
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

  // Ensure System Administrator job role exists
  // Use fully qualified table name
  try {
    await client.query('SET search_path TO public');
    await client.query(`
      INSERT INTO public."tblJobRoles" (job_role_id, text, job_function, int_status)
      VALUES ('JR001', 'System Administrator', 'Full system access', 1)
      ON CONFLICT (job_role_id) DO NOTHING
    `);
    console.log(`[TenantSetup] Job role 'JR001' (System Administrator) ensured in tblJobRoles`);
  } catch (err) {
    // Job role might already exist, continue
    console.warn(`[TenantSetup] Job role creation note: ${err.message}`);
  }

  // Add admin user to tblUsers in the created database
  // Use fully qualified table name
  await client.query(`
    INSERT INTO public."tblUsers" (
      org_id, user_id, full_name, email, phone, job_role_id, password,
      created_by, created_on, changed_by, changed_on, int_status, time_zone
    )
    VALUES ($1, $2, $3, $4, $5, 'JR001', $6, 'SETUP', CURRENT_DATE, 'SETUP', CURRENT_DATE, 1, 'IST')
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        password = EXCLUDED.password
  `, [orgId, userId, fullName, email, phone, passwordHash]);
  console.log(`[TenantSetup] Admin user inserted into tblUsers: ${userId}`);

  // Assign job role - use fully qualified table name
  try {
    await client.query('SET search_path TO public');
    await client.query(`
      INSERT INTO public."tblUserJobRoles" (user_job_role_id, user_id, job_role_id)
      VALUES ('UJR001', $1, 'JR001')
      ON CONFLICT (user_job_role_id) DO NOTHING
    `, [userId]);
  } catch (err) {
    // Role assignment might already exist, continue
    console.warn(`[TenantSetup] User job role assignment note: ${err.message}`);
  }

  console.log(`[TenantSetup] Admin user created: ${userId} (${email})`);

  return {
    userId,
    email,
    password, // Return plain password for display
    fullName,
  };
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

      // Get and execute schema SQL from setup wizard service
      // This includes all tables, primary keys, foreign keys, indexes, and constraints
      let schemaCreated = false;
      try {
        let schemaSql;
        try {
          // Force regeneration to ensure we get the latest schema including any new tables
          console.log(`[TenantSetup] 🔄 Fetching latest schema (will include any new tables from DATABASE_URL)...`);
          schemaSql = await setupWizardService.getSchemaSql(false, true); // forceRegenerate = true
        } catch (fileError) {
          console.error(`[TenantSetup] Error reading schema SQL file:`, fileError.message);
          console.error(`[TenantSetup] This is expected if the SQL dump file doesn't exist. Will use CORE_TABLE_DDL fallback.`);
          schemaSql = null; // Will trigger fallback
        }
        
        if (!schemaSql || schemaSql.trim().length === 0) {
          console.log(`[TenantSetup] Schema SQL is empty or not available. Will use CORE_TABLE_DDL fallback.`);
          schemaSql = null; // Will trigger fallback
        } else {
          console.log(`[TenantSetup] Executing full schema SQL (includes all tables, PKs, FKs, constraints)...`);
          console.log(`[TenantSetup] Schema SQL length: ${schemaSql.length} characters`);
        
        // Execute the schema SQL as a single transaction
        // PostgreSQL can handle multiple statements in a single query
        try {
          await tenantClient.query(schemaSql);
          schemaCreated = true;
          console.log(`[TenantSetup] ✅ Full schema SQL executed successfully`);
        } catch (execError) {
          console.error(`[TenantSetup] Error executing schema SQL as single query:`, execError.message);
          // If single query fails, try executing statement by statement
          console.warn(`[TenantSetup] Single query execution failed, trying statement-by-statement:`, execError.message);
          
          // Split by semicolons and execute statements one by one for better error handling
          // But be careful with functions, triggers, etc. that contain semicolons
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
            console.warn(`[TenantSetup] No tables were created after executing schema SQL. Will use CORE_TABLE_DDL fallback.`);
          }
        }
        }
      } catch (schemaError) {
        console.error(`[TenantSetup] ❌ Error executing schema SQL:`, schemaError.message);
        console.error(`[TenantSetup] Stack trace:`, schemaError.stack);
        // Try fallback to core tables
        console.log(`[TenantSetup] Attempting to create core tables as fallback...`);
      }

      // Create core tables (safety net - ensures essential tables exist)
      // Note: These are basic table definitions. The full schema SQL above should have already
      // created all tables with complete constraints. This is just a fallback.
      if (!schemaCreated) {
        console.log(`[TenantSetup] Creating core tables as fallback...`);
        const CORE_TABLE_DDL = setupWizardService.CORE_TABLE_DDL;
        if (CORE_TABLE_DDL && Array.isArray(CORE_TABLE_DDL)) {
          for (const ddl of CORE_TABLE_DDL) {
            try {
              if (ddl && ddl.trim()) {
                await tenantClient.query(ddl);
                console.log(`[TenantSetup] Created table from CORE_TABLE_DDL`);
              }
            } catch (err) {
              // Table might already exist (from schema SQL), continue
              if (err.code !== '42P07' && err.code !== '42710') {
                console.error(`[TenantSetup] Error creating core table:`, err.message);
                console.error(`[TenantSetup] DDL that failed:`, ddl.substring(0, 200));
              }
            }
          }
        } else {
          console.error(`[TenantSetup] CORE_TABLE_DDL is not available or not an array`);
        }
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
