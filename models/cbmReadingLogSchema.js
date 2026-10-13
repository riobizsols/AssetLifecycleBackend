// tblCbmReadingLog: one row per condition rule check. Shared by the migration and opcModel.
exports.STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "tblCbmReadingLog" (
     log_id        BIGSERIAL PRIMARY KEY,
     cbm_id        VARCHAR(50) NOT NULL,
     asset_id      VARCHAR(50),
     ct_id         VARCHAR(50),
     server_id     VARCHAR(50),
     tag_full_path TEXT,
     value         VARCHAR(100),
     is_met        BOOLEAN,
     outcome       VARCHAR(20),
     trigger_ref   VARCHAR(30),
     recorded_on   TIMESTAMP NOT NULL DEFAULT NOW(),
     org_id        VARCHAR(50) NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_cbm_reading_log_rule_time ON "tblCbmReadingLog" (cbm_id, recorded_on)`,
  `CREATE INDEX IF NOT EXISTS idx_cbm_reading_log_org_time ON "tblCbmReadingLog" (org_id, recorded_on)`,
];
