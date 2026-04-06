const cron = require("node-cron");
const { getDb } = require("../utils/dbContext");
const { generateCustomId } = require("../utils/idGenerator");

let wfScrapSeqBackfillCronJob = null;

/** Default scrap approval step (one level). Override via env if needed. */
const DEFAULT_WF_STEP_ID =
  process.env.WFSCRAPSEQ_DEFAULT_WF_STEP_ID || "WFS-02";
const DEFAULT_SEQ_NO = Number(process.env.WFSCRAPSEQ_DEFAULT_SEQ_NO || 10);

const getEligibleAssetTypesWithoutScrapSeq = async () => {
  const query = `
    SELECT at.asset_type_id, at.org_id
    FROM "tblAssetTypes" at
    WHERE COALESCE(TRIM(at.org_id), '') <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM "tblWFScrapSeq" s
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

const backfillMissingScrapWorkflowSequences = async () => {
  const result = {
    scanned: 0,
    inserted: 0,
    skipped: 0,
    skippedMissingWfStep: 0,
    skippedAlreadyHasSeq: 0,
    errors: 0,
  };

  const eligibleResult = await getEligibleAssetTypesWithoutScrapSeq();
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
          `[WFSCRAPSEQ BACKFILL] Skipping ${asset_type_id}/${org_id}: wf_steps_id ${DEFAULT_WF_STEP_ID} not found`,
        );
        continue;
      }

      const scrapSeqId = await generateCustomId("wfscrapseq", 3);
      const insertRes = await getDb().query(
        `
          INSERT INTO "tblWFScrapSeq" (id, asset_type_id, wf_steps_id, seq_no, org_id)
          SELECT $1, $2, $3, $4, $5
          WHERE NOT EXISTS (
            SELECT 1
            FROM "tblWFScrapSeq" s
            WHERE s.asset_type_id = $6
              AND s.org_id = $7
          )
          RETURNING id
        `,
        [
          scrapSeqId,
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
          `[WFSCRAPSEQ BACKFILL] Skipped ${asset_type_id}/${org_id}: scrap sequence already present`,
        );
        continue;
      }

      result.inserted += 1;
      console.log(
        `[WFSCRAPSEQ BACKFILL] Inserted default scrap sequence for ${asset_type_id}/${org_id}: ${scrapSeqId}`,
      );
    } catch (error) {
      result.errors += 1;
      console.error(
        `[WFSCRAPSEQ BACKFILL] Failed for ${asset_type_id}/${org_id}:`,
        error.message,
      );
    }
  }

  return result;
};

const startWfScrapSeqBackfillCron = () => {
  if (wfScrapSeqBackfillCronJob) {
    wfScrapSeqBackfillCronJob.stop();
  }

  // Daily at 3:30 AM IST — staggered from WFAT backfill (1:00 AM IST).
  wfScrapSeqBackfillCronJob = cron.schedule(
    "30 3 * * *",
    async () => {
      const startedAt = new Date().toISOString();
      console.log(`[WFSCRAPSEQ BACKFILL] Started at ${startedAt}`);
      try {
        const summary = await backfillMissingScrapWorkflowSequences();
        console.log("[WFSCRAPSEQ BACKFILL] Completed:", summary);
      } catch (error) {
        console.error("[WFSCRAPSEQ BACKFILL] Fatal error:", error.message);
      }
    },
    {
      scheduled: true,
      timezone: "Asia/Kolkata",
    },
  );

  console.log(
    `[CRON] WF Scrap sequence backfill scheduled daily at 3:30 AM IST (default step: ${DEFAULT_WF_STEP_ID}, seq: ${DEFAULT_SEQ_NO})`,
  );
  return wfScrapSeqBackfillCronJob;
};

module.exports = {
  startWfScrapSeqBackfillCron,
  backfillMissingScrapWorkflowSequences,
};
