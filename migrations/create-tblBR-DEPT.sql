-- Branch ↔ Department mapping (replaces tblDepartments.branch_id for ACM / header dropdown)

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
);

CREATE INDEX IF NOT EXISTS idx_tblbr_dept_dept_id ON "tblBR_DEPT" (dept_id);
CREATE INDEX IF NOT EXISTS idx_tblbr_dept_org_id ON "tblBR_DEPT" (org_id);

INSERT INTO "tblBR_DEPT" (branch_id, dept_id, org_id, int_status, created_on)
SELECT d.branch_id, d.dept_id, d.org_id, COALESCE(d.int_status, 1), CURRENT_TIMESTAMP
FROM "tblDepartments" d
WHERE d.branch_id IS NOT NULL
  AND BTRIM(d.branch_id) <> ''
ON CONFLICT (branch_id, dept_id) DO NOTHING;
