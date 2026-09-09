/**
 * Ensure tblAAT_Insp_Rec.ais_id exists so answer upserts can be schedule-scoped.
 *
 * Background: aatisch_id has FK → tblAAT_Insp_Freq.aatif_id, so we cannot store
 * ais_id in aatisch_id without breaking the FK. Adding a nullable ais_id column
 * allows (ais_id, insp_check_id) upserts while keeping online aatif_id writes intact.
 */
async function ensureInspRecAisIdSchema(dbPool) {
  if (!dbPool?.query) return { ensured: false };

  const tableExists = await dbPool.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblAAT_Insp_Rec'
    LIMIT 1
  `);
  if (!tableExists.rows.length) {
    return { ensured: false, reason: 'table_missing' };
  }

  await dbPool.query(`
    ALTER TABLE "tblAAT_Insp_Rec"
    ADD COLUMN IF NOT EXISTS ais_id character varying(50)
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_aatinsprec_ais_id
      ON "tblAAT_Insp_Rec" (ais_id)
  `);

  await dbPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_aatinsprec_ais_insp_check
      ON "tblAAT_Insp_Rec" (ais_id, insp_check_id)
      WHERE ais_id IS NOT NULL
  `);

  return { ensured: true };
}

module.exports = { ensureInspRecAisIdSchema };
