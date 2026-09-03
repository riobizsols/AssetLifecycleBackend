/**
 * Ensure tblBR_DEPT exists (branch ↔ department mapping).
 * Safe to call on startup — uses CREATE IF NOT EXISTS + idempotent backfill.
 */
async function ensureBrDeptSchema(dbPool) {
  if (!dbPool?.query) return { created: false, backfilled: 0 };

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS "tblBR_DEPT" (
      branch_id   character varying(20) NOT NULL,
      dept_id     character varying(20) NOT NULL,
      org_id      character varying(20),
      int_status  integer DEFAULT 1,
      created_by  character varying(20),
      created_on  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by  character varying(20),
      changed_on  timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (branch_id, dept_id)
    )
  `);

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblbr_dept_dept_id ON "tblBR_DEPT" (dept_id)
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblbr_dept_org_id ON "tblBR_DEPT" (org_id)
  `);

  const deptBranchCol = await dbPool.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblDepartments'
      AND column_name = 'branch_id'
    LIMIT 1
  `);

  let backfilled = 0;
  if (deptBranchCol.rows.length) {
    const ins = await dbPool.query(`
      INSERT INTO "tblBR_DEPT" (branch_id, dept_id, org_id, int_status, created_on)
      SELECT d.branch_id, d.dept_id, d.org_id, COALESCE(d.int_status, 1), CURRENT_TIMESTAMP
      FROM "tblDepartments" d
      WHERE d.branch_id IS NOT NULL
        AND BTRIM(d.branch_id) <> ''
      ON CONFLICT (branch_id, dept_id) DO NOTHING
    `);
    backfilled = ins.rowCount || 0;
  }

  return { created: true, backfilled };
}

module.exports = { ensureBrDeptSchema };
