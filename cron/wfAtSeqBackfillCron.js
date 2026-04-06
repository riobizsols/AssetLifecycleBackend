const cron = require('node-cron');
const { getDb } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

let wfAtSeqBackfillCronJob = null;

const DEFAULT_WF_STEP_ID = process.env.WFATSEQ_DEFAULT_WF_STEP_ID || 'WFS-06';
const DEFAULT_SEQ_NO = Number(process.env.WFATSEQ_DEFAULT_SEQ_NO || 10);

const getEligibleAssetTypesWithoutWorkflowSeq = async () => {
  // Only asset types that have zero rows in tblWFATSeqs for (asset_type_id, org_id).
  // If any workflow sequence already exists for that pair, we do not insert (manual or cron).
  const query = `
    SELECT at.asset_type_id, at.org_id
    FROM "tblAssetTypes" at
    WHERE COALESCE(TRIM(at.org_id), '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM "tblWFATSeqs" s
        WHERE s.asset_type_id = at.asset_type_id
          AND s.org_id = at.org_id
      )
    ORDER BY at.org_id, at.asset_type_id
  `;
  return getDb().query(query);
};

const wfStepExists = async (wfStepId, orgId) => {
  const query = `
    SELECT 1
    FROM "tblWFSteps"
    WHERE wf_steps_id = $1
      AND (org_id = $2 OR org_id IS NULL)
    LIMIT 1
  `;
  const result = await getDb().query(query, [wfStepId, orgId]);
  return result.rows.length > 0;
};

const backfillMissingWorkflowSequences = async () => {
  const result = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    skippedMissingWfStep: 0,
    /** Insert affected 0 rows: seq appeared between scan and insert (rare race). */
    skippedAlreadyHasSeq: 0,
    errors: 0,
  };

  const eligibleResult = await getEligibleAssetTypesWithoutWorkflowSeq();
  const assetTypes = eligibleResult.rows;
  result.scanned = assetTypes.length;

  for (const row of assetTypes) {
    const { asset_type_id, org_id } = row;
    try {
      const exists = await wfStepExists(DEFAULT_WF_STEP_ID, org_id);
      if (!exists) {
        result.skipped += 1;
        result.skippedMissingWfStep += 1;
        console.warn(
          `[WFATSEQ BACKFILL] Skipping ${asset_type_id}/${org_id}: wf_step_id ${DEFAULT_WF_STEP_ID} not found`,
        );
        continue;
      }

      const wfAtSeqId = await generateCustomId('wfas', 3);
      // Atomic: only insert if still no row for this asset type/org (avoids duplicates on concurrent runs).
      // Use $6/$7 for NOT EXISTS (duplicate values) — reusing $2/$5 in SELECT + subquery
      // causes PostgreSQL: "inconsistent types deduced for parameter $2".
      const insertRes = await getDb().query(
        `
          INSERT INTO "tblWFATSeqs" (wf_at_seqs_id, asset_type_id, wf_steps_id, seqs_no, org_id)
          SELECT $1, $2, $3, $4, $5
          WHERE NOT EXISTS (
            SELECT 1
            FROM "tblWFATSeqs" s
            WHERE s.asset_type_id = $6
              AND s.org_id = $7
          )
          RETURNING wf_at_seqs_id
        `,
        [
          wfAtSeqId,
          asset_type_id,
          DEFAULT_WF_STEP_ID,
          DEFAULT_SEQ_NO,
          org_id,
          asset_type_id,
          org_id,
        ],
      );

      if (insertRes.rowCount === 0) {
        result.skippedAlreadyHasSeq += 1;
        console.log(
          `[WFATSEQ BACKFILL] Skipped ${asset_type_id}/${org_id}: workflow sequence already present`,
        );
        continue;
      }

      result.inserted += 1;
      console.log(
        `[WFATSEQ BACKFILL] Inserted default workflow sequence for ${asset_type_id}/${org_id}: ${wfAtSeqId}`,
      );
    } catch (error) {
      result.errors += 1;
      console.error(
        `[WFATSEQ BACKFILL] Failed for ${asset_type_id}/${org_id}:`,
        error.message,
      );
    }
  }

  return result;
};

const startWfAtSeqBackfillCron = () => {
  if (wfAtSeqBackfillCronJob) {
    wfAtSeqBackfillCronJob.stop();
  }

  // Every day at 1:00 AM IST.
  wfAtSeqBackfillCronJob = cron.schedule(
    '0 1 * * *',
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`[WFATSEQ BACKFILL] Started at ${startedAt}`);
      try {
        const summary = await backfillMissingWorkflowSequences();
        console.log('[WFATSEQ BACKFILL] Completed:', summary);
      } catch (error) {
        console.error('[WFATSEQ BACKFILL] Fatal error:', error.message);
      }
    },
    {
      scheduled: true,
      timezone: 'Asia/Kolkata',
    },
  );

  console.log(
    `[CRON] WFAT sequence backfill scheduled daily at 1:00 AM IST (default step: ${DEFAULT_WF_STEP_ID}, seq: ${DEFAULT_SEQ_NO})`,
  );
  return wfAtSeqBackfillCronJob;
};

module.exports = {
  startWfAtSeqBackfillCron,
  backfillMissingWorkflowSequences,
};

