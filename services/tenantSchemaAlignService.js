const { Pool, Client } = require('pg');
const tenantSchemaService = require('./tenantSchemaService');
const {
  alignTenantColumnsFromReference,
  seedRequiredMasterData,
} = require('./tenantReferenceDataService');

const EXCLUDED_FROM_TENANTS = ['tblRioAdmin'];

/** Never drop these even if absent from a stale reference dump. */
const PROTECTED_RUNTIME_TABLES = [
  'tblAssetMaintSch_BR_Hist',
  'tblAssetExpiryNotify',
  'tblJobs',
  'tblJobHistory',
];

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
 * Scrap workflow status must be numeric IDs from tblStatusCodes (integer/bigint),
 * matching current scrapMaintenanceModel SQL.
 * Older tenant generation used varchar status codes ('IN','IP','AP') + text CHECKs,
 * which breaks approvals list with: varchar = bigint.
 */
async function ensureScrapWorkflowStatusInteger(client) {
  const tables = ['tblWFScrap_H', 'tblWFScrap_D'];
  const results = [];

  for (const tableName of tables) {
    const exists = await client.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
      `,
      [tableName]
    );
    if (!exists.rows[0]?.exists) {
      results.push({ table: tableName, status: 'missing' });
      continue;
    }

    // Drop legacy text-code check constraints (IN/IP/AP as strings)
    const checks = await client.query(
      `
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = $1
        AND con.contype = 'c'
        AND (
          con.conname ILIKE '%status%'
          OR pg_get_constraintdef(con.oid) ILIKE '%''IN''%'
        )
      `,
      [tableName]
    );
    for (const row of checks.rows) {
      await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${row.conname}"`);
    }

    const col = await client.query(
      `
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = 'status'
      `,
      [tableName]
    );
    if (!col.rows[0]) {
      results.push({ table: tableName, status: 'no_status_column' });
      continue;
    }

    const dataType = String(col.rows[0].data_type || '').toLowerCase();
    if (dataType === 'integer' || dataType === 'bigint' || dataType === 'smallint') {
      // Ensure numeric default for IN (id=1) when possible
      try {
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN status DROP DEFAULT`);
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN status SET DEFAULT 1`);
      } catch (_) {
        /* ignore */
      }
      results.push({ table: tableName, status: 'already_numeric', dataType });
      continue;
    }

    // Convert varchar/text status codes or numeric strings → integer IDs
    await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN status DROP DEFAULT`);
    await client.query(
      `
      ALTER TABLE "${tableName}"
      ALTER COLUMN status TYPE integer
      USING (
        CASE
          WHEN NULLIF(TRIM(status::text), '') IS NULL THEN 1
          WHEN TRIM(status::text) ~ '^[0-9]+$' THEN TRIM(status::text)::integer
          ELSE COALESCE(
            (SELECT sc.id FROM "tblStatusCodes" sc WHERE sc.status_code = TRIM(status::text) LIMIT 1),
            1
          )
        END
      )
      `
    );
    await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN status SET DEFAULT 1`);
    results.push({ table: tableName, status: 'converted_to_integer', from: dataType });
  }

  console.log('[TenantSchemaAlign] Scrap workflow status schema:', JSON.stringify(results));
  return results;
}

/**
 * Runtime-critical schema that must exist even if the reference dump/template is stale.
 * Fixes maintenance list 500 (hours_required), reopened breakdowns 500 (BR_Hist),
 * and dashboard expiry notifications 500 (tblAssetExpiryNotify).
 */
async function ensureCriticalRuntimeSchema(client) {
  const results = [];

  // Maintenance list joins tblMaintTypes.hours_required
  try {
    await client.query(`
      ALTER TABLE "tblMaintTypes"
      ADD COLUMN IF NOT EXISTS "hours_required" DECIMAL(10,2)
    `);
    results.push({ object: 'tblMaintTypes.hours_required', status: 'ensured' });
  } catch (err) {
    if (err.code === '42P01') {
      results.push({ object: 'tblMaintTypes.hours_required', status: 'table_missing' });
    } else {
      throw err;
    }
  }

  // Optional maintenance time-tracking columns used alongside hours_required
  try {
    await client.query(`
      ALTER TABLE "tblAssetMaintSch"
      ADD COLUMN IF NOT EXISTS "hours_spent" DECIMAL(10,2)
    `);
    await client.query(`
      ALTER TABLE "tblAssetMaintSch"
      ADD COLUMN IF NOT EXISTS "maint_notes" TEXT
    `);
    results.push({ object: 'tblAssetMaintSch.hours_spent/maint_notes', status: 'ensured' });
  } catch (err) {
    if (err.code !== '42P01') throw err;
    results.push({ object: 'tblAssetMaintSch.hours_spent/maint_notes', status: 'table_missing' });
  }

  // Reopened breakdowns report / history writes
  try {
    const brHistExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tblAssetMaintSch_BR_Hist'
      ) AS exists
    `);
    if (!brHistExists.rows[0]?.exists) {
      const parentExists = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'tblAssetMaintSch'
        ) AS exists
      `);
      if (parentExists.rows[0]?.exists) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS "tblAssetMaintSch_BR_Hist" (
            amsbr_id    TEXT PRIMARY KEY,
            ams_id      TEXT NOT NULL,
            status      VARCHAR(20) NOT NULL,
            created_on  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by  TEXT NOT NULL,
            notes       TEXT,
            CONSTRAINT fk_tblAssetMaintSch_BR_Hist_ams_id
              FOREIGN KEY (ams_id)
              REFERENCES "tblAssetMaintSch"(ams_id)
              ON UPDATE CASCADE
              ON DELETE CASCADE
          )
        `);
      } else {
        await client.query(`
          CREATE TABLE IF NOT EXISTS "tblAssetMaintSch_BR_Hist" (
            amsbr_id    TEXT PRIMARY KEY,
            ams_id      TEXT NOT NULL,
            status      VARCHAR(20) NOT NULL,
            created_on  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            created_by  TEXT NOT NULL,
            notes       TEXT
          )
        `);
      }
      results.push({ object: 'tblAssetMaintSch_BR_Hist', status: 'created' });
    } else {
      results.push({ object: 'tblAssetMaintSch_BR_Hist', status: 'exists' });
    }
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetMaintSch_BR_Hist_ams_id
        ON "tblAssetMaintSch_BR_Hist" (ams_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetMaintSch_BR_Hist_status
        ON "tblAssetMaintSch_BR_Hist" (status)
    `);
  } catch (err) {
    console.warn('[TenantSchemaAlign] Could not ensure tblAssetMaintSch_BR_Hist:', err.message);
    results.push({ object: 'tblAssetMaintSch_BR_Hist', status: 'error', message: err.message });
  }

  // Dashboard / expiry notifications
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "tblAssetExpiryNotify" (
        notify_id       VARCHAR(50) PRIMARY KEY,
        notif_group_id  VARCHAR(50),
        asset_id        VARCHAR(50) NOT NULL,
        org_id          VARCHAR(50) NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'UNREAD',
        title           VARCHAR(255),
        body            TEXT,
        last_seen_on    TIMESTAMPTZ,
        snooze_days     INTEGER NOT NULL DEFAULT 0,
        emp_int_id      VARCHAR(50),
        created_on      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_asset_id
        ON "tblAssetExpiryNotify" (asset_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_org_id
        ON "tblAssetExpiryNotify" (org_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_emp_int_id
        ON "tblAssetExpiryNotify" (emp_int_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_status
        ON "tblAssetExpiryNotify" (status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tblAssetExpiryNotify_created_on
        ON "tblAssetExpiryNotify" (created_on DESC)
    `);
    results.push({ object: 'tblAssetExpiryNotify', status: 'ensured' });
  } catch (err) {
    console.warn('[TenantSchemaAlign] Could not ensure tblAssetExpiryNotify:', err.message);
    results.push({ object: 'tblAssetExpiryNotify', status: 'error', message: err.message });
  }

  // ID sequence used when writing BR_Hist rows
  try {
    await client.query(`
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES ('amsbr', 'AMSBR', 0)
      ON CONFLICT (table_key) DO NOTHING
    `);
    results.push({ object: 'tblIDSequences.amsbr', status: 'ensured' });
  } catch (err) {
    if (err.code !== '42P01') {
      console.warn('[TenantSchemaAlign] Could not ensure amsbr sequence:', err.message);
    }
  }

  console.log('[TenantSchemaAlign] Critical runtime schema:', JSON.stringify(results));
  return results;
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
  const extra = tenantTables.filter(
    (t) => !refSet.has(t) && !PROTECTED_RUNTIME_TABLES.includes(t)
  );

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

    console.log('[TenantSchemaAlign] Ensuring scrap workflow status is integer IDs...');
    await ensureScrapWorkflowStatusInteger(client);

    console.log('[TenantSchemaAlign] Ensuring critical runtime tables/columns...');
    await ensureCriticalRuntimeSchema(client);

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

    // Re-apply after column align / cleanup so a stale reference cannot leave these missing
    console.log('[TenantSchemaAlign] Re-ensuring critical runtime schema after align...');
    await ensureCriticalRuntimeSchema(client);

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
  ensureScrapWorkflowStatusInteger,
  ensureCriticalRuntimeSchema,
  ensureReferenceViews,
};
