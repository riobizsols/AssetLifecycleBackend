/**
 * Ensure tblJobs (and tblJobHistory) exist on the target DB, then copy tblJobs rows
 * from the hospitality database.
 *
 * Env:
 *   DATABASE_URL          — target (e.g. .../assetLifecycle)
 *   HOSPITALITY_DATABASE_URL — optional source; if omitted, same host/user as DATABASE_URL
 *                            with database name replaced by "hospitality"
 *
 * Run:
 *   node migrations/sync-tblJobs-from-hospitality.js
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl) {
  console.error('❌ DATABASE_URL is required (target = assetLifecycle).');
  process.exit(1);
}

function defaultHospitalityUrl(fromTarget) {
  try {
    const u = new URL(fromTarget.replace(/^postgresql:/i, 'postgres:'));
    const base = u.pathname.split('/').filter(Boolean)[0];
    if (!base) return null;
    u.pathname = '/hospitality';
    return u.toString().replace(/^postgres:/i, 'postgresql:');
  } catch {
    return fromTarget.replace(/\/([^/?]+)(\?.*)?$/i, '/hospitality$2');
  }
}

const sourceUrl = process.env.HOSPITALITY_DATABASE_URL || defaultHospitalityUrl(targetUrl);
if (!sourceUrl) {
  console.error('❌ Could not derive hospitality URL. Set HOSPITALITY_DATABASE_URL.');
  process.exit(1);
}

const DDL_JOBS = `
  CREATE TABLE IF NOT EXISTS "tblJobs" (
    job_id         VARCHAR(50) PRIMARY KEY,
    job_name       VARCHAR(255) NOT NULL,
    frequency      VARCHAR(100),
    status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    file_path      TEXT,
    created_on     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by     VARCHAR(100) NOT NULL DEFAULT 'SYSTEM',
    changed_on     TIMESTAMPTZ,
    changed_by     VARCHAR(100)
  );
`;

const DDL_JOBS_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_tblJobs_status
  ON "tblJobs" (status);
`;

const DDL_HISTORY = `
  CREATE TABLE IF NOT EXISTS "tblJobHistory" (
    jh_id                 VARCHAR(50) PRIMARY KEY,
    job_id                VARCHAR(50) NOT NULL,
    execution_timestamp   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executed_by           VARCHAR(100) NOT NULL,
    duration_ms           BIGINT NOT NULL DEFAULT 0,
    is_error              BOOLEAN NOT NULL DEFAULT FALSE,
    output_json           JSONB,
    CONSTRAINT fk_tblJobHistory_job_id
      FOREIGN KEY (job_id)
      REFERENCES "tblJobs" (job_id)
      ON UPDATE CASCADE
      ON DELETE CASCADE
  );
`;

const DDL_HISTORY_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_tblJobHistory_job_id ON "tblJobHistory" (job_id);`,
  `CREATE INDEX IF NOT EXISTS idx_tblJobHistory_execution_timestamp ON "tblJobHistory" (execution_timestamp DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_tblJobHistory_is_error ON "tblJobHistory" (is_error);`,
];

async function tableExists(client, name) {
  const r = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS e`,
    [name],
  );
  return r.rows[0]?.e === true;
}

async function run() {
  const sourcePool = new Pool({ connectionString: sourceUrl });
  const targetPool = new Pool({ connectionString: targetUrl });

  console.log('Target (DATABASE_URL):', maskUrl(targetUrl));
  console.log('Source (hospitality):   ', maskUrl(sourceUrl));

  if (normalizeDbKey(targetUrl) === normalizeDbKey(sourceUrl)) {
    console.warn(
      '⚠️  Target and source are the same database. To copy hospitality → assetLifecycle, set DATABASE_URL to .../assetLifecycle (and optionally HOSPITALITY_DATABASE_URL to .../hospitality).',
    );
  }

  const src = await sourcePool.connect();
  const dst = await targetPool.connect();

  try {
    const jobsOnSource = await tableExists(src, 'tblJobs');
    if (!jobsOnSource) {
      console.error('❌ Source database has no public."tblJobs". Create it on hospitality first or fix HOSPITALITY_DATABASE_URL.');
      process.exit(1);
    }

    const { rows: sourceRows } = await src.query(
      `SELECT job_id, job_name, frequency, status, file_path, created_on, created_by, changed_on, changed_by
       FROM "tblJobs"
       ORDER BY job_id`,
    );
    console.log(`Source tblJobs row count: ${sourceRows.length}`);

    await dst.query('BEGIN');
    await dst.query(DDL_JOBS);
    await dst.query(DDL_JOBS_INDEX);
    await dst.query(DDL_HISTORY);
    for (const q of DDL_HISTORY_INDEXES) {
      await dst.query(q);
    }

    let upserted = 0;
    for (const row of sourceRows) {
      await dst.query(
        `INSERT INTO "tblJobs" (
           job_id, job_name, frequency, status, file_path, created_on, created_by, changed_on, changed_by
         ) VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP), COALESCE($7, 'SYSTEM'), $8::timestamptz, $9)
         ON CONFLICT (job_id) DO UPDATE SET
           job_name   = EXCLUDED.job_name,
           frequency  = EXCLUDED.frequency,
           status     = EXCLUDED.status,
           file_path  = EXCLUDED.file_path,
           created_on = COALESCE(EXCLUDED.created_on, "tblJobs".created_on),
           created_by = COALESCE(EXCLUDED.created_by, "tblJobs".created_by),
           changed_on = EXCLUDED.changed_on,
           changed_by = EXCLUDED.changed_by`,
        [
          row.job_id,
          row.job_name,
          row.frequency,
          row.status,
          row.file_path,
          row.created_on,
          row.created_by,
          row.changed_on,
          row.changed_by,
        ],
      );
      upserted += 1;
    }

    await dst.query('COMMIT');
    const { rows: verify } = await targetPool.query(`SELECT COUNT(*)::int AS c FROM "tblJobs"`);
    console.log(`✅ Upserted ${upserted} job row(s). Target tblJobs count: ${verify[0]?.c}`);
  } catch (e) {
    await dst.query('ROLLBACK').catch(() => {});
    console.error('❌ Failed:', e.message);
    process.exit(1);
  } finally {
    dst.release();
    src.release();
    await targetPool.end();
    await sourcePool.end();
  }
}

/** Compare host+port+dbname only (ignore password quirks). */
function normalizeDbKey(u) {
  try {
    const x = new URL(u.replace(/^postgresql:/i, 'postgres:'));
    const db = (x.pathname || '').replace(/^\//, '').split('/')[0] || '';
    return `${x.hostname}:${x.port || '5432'}/${db}`;
  } catch {
    return u;
  }
}

function maskUrl(u) {
  try {
    const x = new URL(u.replace(/^postgresql:/i, 'postgres:'));
    if (x.password) x.password = '***';
    return x.toString().replace(/^postgres:/i, 'postgresql:');
  } catch {
    return '(unparseable)';
  }
}

run();
