-- Audit type master + asset-type mapping (EAM)
-- Spreadsheet: tblAuditType / tblAuditATMapping
-- Plus org_id / branch_id / dept_id / int_status per EAM conventions

CREATE TABLE IF NOT EXISTS "tblAuditType" (
  audtp_id      character varying(50) PRIMARY KEY,
  description   text,
  is_internal   boolean NOT NULL DEFAULT true,
  created_by    character varying(50),
  created_on    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  changed_by    character varying(50),
  changed_on    timestamp without time zone,
  org_id        character varying(50),
  branch_id     character varying(50),
  dept_id       character varying(50),
  int_status    integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "tblAuditATMapping" (
  audatm_id     character varying(50) PRIMARY KEY,
  assettype_id  character varying(50) NOT NULL,
  audtp_id      character varying(50) NOT NULL,
  created_by    character varying(50),
  created_on    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  changed_by    character varying(50),
  changed_on    timestamp without time zone,
  org_id        character varying(50),
  branch_id     character varying(50),
  dept_id       character varying(50),
  int_status    integer NOT NULL DEFAULT 1,
  CONSTRAINT fk_tblAuditATMapping_audtp_id
    FOREIGN KEY (audtp_id) REFERENCES "tblAuditType" (audtp_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_tblAuditType_org_id ON "tblAuditType" (org_id);
CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_org_id ON "tblAuditATMapping" (org_id);
CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_assettype_id ON "tblAuditATMapping" (assettype_id);
CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_audtp_id ON "tblAuditATMapping" (audtp_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tblAuditATMapping_org_at_audtp
  ON "tblAuditATMapping" (org_id, assettype_id, audtp_id);
