const { getDbFromContext } = require('../utils/dbContext');
const CronService = require('../services/cronService');
const { backfillMissingWorkflowSequences } = require('../cron/wfAtSeqBackfillCron');
const { backfillMissingScrapWorkflowSequences } = require('../cron/wfScrapSeqBackfillCron');
const { ensureWarrantyNotificationsForWindowAllOrgs } = require('./assetWarrantyNotifyModel');

const getDb = () => getDbFromContext();

const DEFAULT_JOBS = [
  { job_id: 'JOB001', job_name: 'maintenance trigger', frequency: '0 0 * * *', status: 'DISABLED', file_path: 'services/cronService.triggerMaintenanceGeneration' },
  { job_id: 'JOB002', job_name: 'Inspection', frequency: '0 1 * * *', status: 'DISABLED', file_path: 'services/cronService.triggerInspection' },
  { job_id: 'JOB003', job_name: 'Vendor contract renewal', frequency: '0 8 * * *', status: 'DISABLED', file_path: 'cron/vendorContractRenewalCron' },
  { job_id: 'JOB004', job_name: 'scrap seq setting', frequency: 'manual', status: 'DISABLED', file_path: 'cron/wfScrapSeqBackfillCron' },
  { job_id: 'JOB005', job_name: 'maint seq setting', frequency: 'manual', status: 'DISABLED', file_path: 'cron/wfAtSeqBackfillCron' },
  { job_id: 'JOB006', job_name: 'warranty notification trigger', frequency: '0 7 * * *', status: 'DISABLED', file_path: 'cron/warrantyNotificationTrigger' },
];

const ensureDefaultJobs = async () => {
  const dbPool = getDb();
  for (const job of DEFAULT_JOBS) {
    await dbPool.query(
      `
      INSERT INTO "tblJobs" (job_id, job_name, frequency, status, file_path, created_by)
      VALUES ($1, $2, $3, $4, $5, 'SYSTEM')
      ON CONFLICT (job_id) DO NOTHING
      `,
      [job.job_id, job.job_name, job.frequency, job.status, job.file_path],
    );
  }
};

const listJobs = async () => {
  await ensureDefaultJobs();
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT job_id, job_name, frequency, status, file_path
     FROM "tblJobs"
     ORDER BY job_id`,
  );
  return result.rows;
};

const updateJob = async (jobId, payload) => {
  const dbPool = getDb();
  const { frequency, status, changed_by } = payload;
  const result = await dbPool.query(
    `UPDATE "tblJobs"
     SET frequency = COALESCE($1, frequency),
         status = COALESCE($2, status),
         changed_by = $3,
         changed_on = CURRENT_TIMESTAMP
     WHERE job_id = $4
     RETURNING job_id, job_name, frequency, status, file_path`,
    [frequency ?? null, status ?? null, changed_by || 'SYSTEM', jobId],
  );
  return result.rows[0] || null;
};

const getJobById = async (jobId) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT job_id, job_name, frequency, status, file_path
     FROM "tblJobs"
     WHERE job_id = $1`,
    [jobId],
  );
  return result.rows[0] || null;
};

const nextHistoryId = async () => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT MAX(CAST(SUBSTRING(jh_id FROM '[0-9]+$') AS INTEGER)) AS max_num
     FROM "tblJobHistory"
     WHERE jh_id ~ '^[A-Z_]*[0-9]+$'`,
  );
  const next = (result.rows[0]?.max_num || 0) + 1;
  return `JH_${String(next).padStart(4, '0')}`;
};

const addHistory = async ({ job_id, executed_by, duration_ms, is_error, output_json }) => {
  const dbPool = getDb();
  const jhId = await nextHistoryId();
  await dbPool.query(
    `INSERT INTO "tblJobHistory" (
      jh_id, job_id, execution_timestamp, executed_by, duration_ms, is_error, output_json
    ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6::jsonb)`,
    [jhId, job_id, executed_by, duration_ms, is_error, JSON.stringify(output_json ?? {})],
  );
  return jhId;
};

const getJobHistory = async (jobId, limit = 100) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT jh_id, job_id, execution_timestamp, executed_by, duration_ms, is_error, output_json
     FROM "tblJobHistory"
     WHERE job_id = $1
     ORDER BY execution_timestamp DESC
     LIMIT $2`,
    [jobId, limit],
  );
  return result.rows;
};

const cleanupOldestWarrantyNotifications = async (limit = 100) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      WITH to_delete AS (
        SELECT notify_id
        FROM "tblAssetWarrantyNotify"
        ORDER BY created_on ASC, notify_id ASC
        LIMIT $1
      )
      DELETE FROM "tblAssetWarrantyNotify" n
      USING to_delete d
      WHERE n.notify_id = d.notify_id
      RETURNING n.notify_id
    `,
    [limit]
  );
  return { deletedCount: result.rowCount || 0 };
};

const executeJob = async (jobId, userId, orgId) => {
  const dbPool = getDb();
  const job = await getJobById(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  // Requirement: manual Run should execute directly from UI.
  // We do not block execution on persisted ENABLED/DISABLED state.
  await dbPool.query(
    `UPDATE "tblJobs"
     SET status = 'RUNNING',
         changed_by = $1,
         changed_on = CURRENT_TIMESTAMP
     WHERE job_id = $2`,
    [userId || 'SYSTEM', jobId],
  );

  const start = Date.now();
  let output = {};
  let isError = false;

  try {
    if (jobId === 'JOB001') {
      const cronService = new CronService();
      output = await cronService.triggerMaintenanceGeneration();
    } else if (jobId === 'JOB002') {
      const cronService = new CronService();
      output = await cronService.triggerInspection(orgId || 'ORG001');
    } else if (jobId === 'JOB003') {
      const cronService = new CronService();
      output = await cronService.triggerVendorContractRenewal();
    } else if (jobId === 'JOB004') {
      output = await backfillMissingScrapWorkflowSequences();
    } else if (jobId === 'JOB005') {
      output = await backfillMissingWorkflowSequences();
    } else if (jobId === 'JOB006') {
      output = await ensureWarrantyNotificationsForWindowAllOrgs({ days: 10 });
    } else {
      throw new Error('Unsupported job mapping');
    }
  } catch (error) {
    isError = true;
    output = {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  const durationMs = Date.now() - start;
  await addHistory({
    job_id: jobId,
    executed_by: userId || 'SYSTEM',
    duration_ms: durationMs,
    is_error: isError,
    output_json: output,
  });

  // Requirement: after a run attempt, status should return to DISABLED.
  await dbPool.query(
    `UPDATE "tblJobs"
     SET status = 'DISABLED',
         changed_by = $1,
         changed_on = CURRENT_TIMESTAMP
     WHERE job_id = $2`,
    [userId || 'SYSTEM', jobId],
  );

  if (isError) {
    const err = new Error(output.error || 'Job execution failed');
    err.output = output;
    err.durationMs = durationMs;
    throw err;
  }

  return { durationMs, output };
};

module.exports = {
  listJobs,
  getJobById,
  updateJob,
  executeJob,
  getJobHistory,
  addHistory,
  cleanupOldestWarrantyNotifications,
};

