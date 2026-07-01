const { Pool, Client } = require('pg');
const tenantSchemaService = require('./tenantSchemaService');
const {
  alignTenantColumnsFromReference,
  seedRequiredMasterData,
} = require('./tenantReferenceDataService');

const EXCLUDED_FROM_TENANTS = ['tblRioAdmin'];

function getReferenceUrl() {
  return (
    process.env.TENANT_SCHEMA_REFERENCE_URL ||
    process.env.DATABASE_URL ||
    process.env.HOSPITALITY_DATABASE_URL
  );
}

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

async function listBaseTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function listViews(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'VIEW'
    ORDER BY table_name
  `);
  return rows.map((r) => r.table_name);
}

async function getObjectType(client, name) {
  const { rows } = await client.query(
    `
    SELECT table_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = $1
  `,
    [name]
  );
  return rows[0]?.table_type || null;
}

async function tableRowCount(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS c FROM "${tableName}"`);
  return rows[0].c;
}

const DEFAULT_JOBS = [
  ['JOB001', 'maintenance trigger', '0 0 * * *', 'DISABLED', 'services/cronService.triggerMaintenanceGeneration'],
  ['JOB002', 'Inspection', '0 1 * * *', 'DISABLED', 'services/cronService.triggerInspection'],
  ['JOB003', 'Vendor contract renewal', '0 8 * * *', 'DISABLED', 'cron/vendorContractRenewalCron'],
  ['JOB004', 'scrap seq setting', 'manual', 'DISABLED', 'cron/wfScrapSeqBackfillCron'],
  ['JOB005', 'maint seq setting', 'manual', 'DISABLED', 'cron/wfAtSeqBackfillCron'],
  ['JOB006', 'warranty notification trigger', '0 7 * * *', 'DISABLED', 'cron/warrantyNotificationTrigger'],
  ['JOB007', 'asset expiry notification trigger', '0 7 * * *', 'DISABLED', 'cron/assetExpiryNotificationTrigger'],
];

async function ensureJobMonitorTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "tblJobs" (
      job_id VARCHAR(50) PRIMARY KEY,
      job_name VARCHAR(255) NOT NULL,
      frequency VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
      file_path TEXT,
      created_on TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
      changed_on TIMESTAMPTZ,
      changed_by VARCHAR(100)
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_tblJobs_status ON "tblJobs" (status);`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "tblJobHistory" (
      jh_id VARCHAR(50) PRIMARY KEY,
      job_id VARCHAR(50) NOT NULL REFERENCES "tblJobs"(job_id) ON UPDATE CASCADE ON DELETE CASCADE,
      execution_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      executed_by VARCHAR(100) NOT NULL,
      duration_ms BIGINT NOT NULL DEFAULT 0,
      is_error BOOLEAN NOT NULL DEFAULT FALSE,
      output_json JSONB
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_tblJobHistory_job_id ON "tblJobHistory" (job_id);`);
  await client.query(
    `CREATE INDEX IF NOT EXISTS idx_tblJobHistory_execution_timestamp ON "tblJobHistory" (execution_timestamp DESC);`
  );
  await client.query(`CREATE INDEX IF NOT EXISTS idx_tblJobHistory_is_error ON "tblJobHistory" (is_error);`);

  for (const row of DEFAULT_JOBS) {
    await client.query(
      `INSERT INTO "tblJobs" (job_id, job_name, frequency, status, file_path, created_by)
       VALUES ($1, $2, $3, $4, $5, 'SYSTEM')
       ON CONFLICT (job_id) DO NOTHING`,
      row
    );
  }
}

/**
 * Hospitality uses tblATInspCert (table) + tblATInspCerts (view).
 * Older tenant templates used tblATInspCerts as a physical table.
 */
async function ensureAtInspCertStructure(client) {
  const baseType = await getObjectType(client, 'tblATInspCert');
  const certsType = await getObjectType(client, 'tblATInspCerts');

  if (certsType === 'BASE TABLE') {
    const rows = await tableRowCount(client, 'tblATInspCerts');
    if (rows > 0) {
      throw new Error(
        'tblATInspCerts exists as a table with data; manual migration required before creating tblATInspCert view pattern.'
      );
    }
    await client.query('DROP TABLE IF EXISTS "tblATInspCerts" CASCADE');
  } else if (certsType === 'VIEW') {
    await client.query('DROP VIEW IF EXISTS "tblATInspCerts" CASCADE');
  }

  if (!baseType) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblATInspCert" (
        atic_id VARCHAR(50) PRIMARY KEY,
        asset_type_id VARCHAR(50) NOT NULL,
        tc_id VARCHAR(50) NOT NULL,
        org_id VARCHAR(50),
        created_by VARCHAR(50),
        created_on TIMESTAMP,
        is_mandatory BOOLEAN,
        requires_expiry BOOLEAN,
        expiry_alert_days INTEGER,
        aatic_id VARCHAR(20)
      );
    `);
  }

  await client.query(`
    CREATE OR REPLACE VIEW "tblATInspCerts" AS
    SELECT * FROM "tblATInspCert";
  `);
}

async function ensureReferenceViews(client, referenceClient) {
  const refViews = await listViews(referenceClient);
  for (const viewName of refViews) {
    if (EXCLUDED_FROM_TENANTS.includes(viewName)) continue;
    const tenantType = await getObjectType(client, viewName);
    if (tenantType === 'VIEW') continue;
    if (tenantType === 'BASE TABLE') {
      const rows = await tableRowCount(client, viewName);
      if (rows > 0) {
        console.warn(`[TenantSchemaAlign] Skip view ${viewName}: physical table has data`);
        continue;
      }
      await client.query(`DROP TABLE IF EXISTS "${viewName}" CASCADE`);
    }
    const { rows } = await referenceClient.query(
      `SELECT definition FROM pg_views WHERE schemaname = 'public' AND viewname = $1`,
      [viewName]
    );
    if (!rows[0]?.definition) continue;
    await client.query(`CREATE OR REPLACE VIEW "${viewName}" AS ${rows[0].definition}`);
  }
}

async function removeExtraEmptyTables(client, referenceTables) {
  const refSet = new Set(referenceTables);
  const tenantTables = await listBaseTables(client);
  const extra = tenantTables.filter((t) => !refSet.has(t));

  for (const tableName of extra) {
    try {
      const rows = await tableRowCount(client, tableName);
      if (rows > 0) {
        console.warn(`[TenantSchemaAlign] Keeping extra table ${tableName} (${rows} rows)`);
        continue;
      }
      await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      console.log(`[TenantSchemaAlign] Dropped empty extra table ${tableName}`);
    } catch (err) {
      console.warn(`[TenantSchemaAlign] Could not drop ${tableName}:`, err.message);
    }
  }
}

async function executeSchemaSql(client, schemaSql) {
  try {
    await client.query(schemaSql);
    return;
  } catch (err) {
    console.warn('[TenantSchemaAlign] Bulk schema apply failed, trying statement-by-statement:', err.message);
  }

  const statements = schemaSql
    .split(/;\s*(?=\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await client.query(statement);
    } catch (stmtErr) {
      const benign =
        stmtErr.message.includes('already exists') ||
        stmtErr.code === '42P07' ||
        stmtErr.code === '42710';
      if (!benign) {
        console.warn('[TenantSchemaAlign] Statement warning:', stmtErr.message);
      }
    }
  }
}

/**
 * Align an existing tenant database to match the hospitality reference schema.
 */
async function alignTenantSchema(client, options = {}) {
  const referenceUrl = options.referenceUrl || getReferenceUrl();
  if (!referenceUrl) {
    throw new Error('TENANT_SCHEMA_REFERENCE_URL or DATABASE_URL must be set');
  }

  const refClient = new Client({ connectionString: referenceUrl, ssl: false });
  await refClient.connect();

  try {
    const tenantTablesBefore = await listBaseTables(client);

    console.log('[TenantSchemaAlign] Applying reference schema (CREATE IF NOT EXISTS)...');
    const schemaSql = await tenantSchemaService.generateTenantSchemaSql();
    await executeSchemaSql(client, schemaSql);

    console.log('[TenantSchemaAlign] Ensuring job monitor tables and default jobs...');
    await ensureJobMonitorTables(client);

    console.log('[TenantSchemaAlign] Fixing tblATInspCert / tblATInspCerts structure...');
    await ensureAtInspCertStructure(client);

    console.log('[TenantSchemaAlign] Ensuring reference views...');
    await ensureReferenceViews(client, refClient);

    const refTables = await listBaseTables(refClient);
    if (options.removeExtraEmptyTables !== false) {
      console.log('[TenantSchemaAlign] Removing empty tables not present in reference...');
      await removeExtraEmptyTables(client, refTables);
    }

    if (options.alignColumns !== false) {
      console.log('[TenantSchemaAlign] Aligning column definitions to reference...');
      const columnLog = await alignTenantColumnsFromReference(client, { referenceUrl });
      console.log(
        `[TenantSchemaAlign] Column align: ${columnLog.summary.applied} applied, ${columnLog.summary.failed} failed`
      );
    }

    if (options.seedMasterData) {
      console.log('[TenantSchemaAlign] Seeding required master data from reference...');
      const orgId =
        options.orgId ||
        (await client.query('SELECT org_id FROM "tblOrgs" LIMIT 1')).rows[0]?.org_id;
      await seedRequiredMasterData(client, { orgId, referenceUrl });
    }

    const tenantTablesAfter = await listBaseTables(client);
    const stillMissing = refTables.filter((t) => !tenantTablesAfter.includes(t));

    return {
      referenceTableCount: refTables.length,
      tenantTableCountBefore: tenantTablesBefore.length,
      tenantTableCountAfter: tenantTablesAfter.length,
      missingAfterAlign: stillMissing,
      referenceUrl: referenceUrl.replace(/:[^:@/]+@/, ':***@'),
    };
  } finally {
    await refClient.end();
  }
}

/**
 * CLI helper: align a tenant database by name.
 */
async function alignTenantDatabase(dbName, options = {}) {
  const client = new Client({ connectionString: tenantUrl(dbName), ssl: false });
  await client.connect();
  try {
    await client.query('SET search_path TO public');
    return await alignTenantSchema(client, options);
  } finally {
    await client.end();
  }
}

module.exports = {
  getReferenceUrl,
  alignTenantSchema,
  alignTenantDatabase,
  ensureJobMonitorTables,
  ensureAtInspCertStructure,
  ensureReferenceViews,
};
