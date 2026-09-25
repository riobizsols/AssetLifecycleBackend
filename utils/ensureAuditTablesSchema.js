/**
 * Ensure audit master + asset-type mapping tables exist.
 * Safe to call during tenant align / login — CREATE IF NOT EXISTS + idempotent indexes/FKs.
 *
 * Spreadsheet fields + EAM conventions (Task 1/2/3):
 *   tblAuditType:       audtp_id (PK), description, is_internal, audit cols, org/branch/dept, int_status
 *   tblAuditATMapping:  audatm_id (PK), assettype_id, audtp_id (FK), audit cols, org/branch/dept, int_status
 */
async function ensureAuditTablesSchema(dbPool) {
  if (!dbPool?.query) return { created: false };

  await dbPool.query(`
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
    )
  `);

  await dbPool.query(`
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
      int_status    integer NOT NULL DEFAULT 1
    )
  `);

  // Idempotent column adds for DBs created before full convention set
  const alterCols = [
    ['tblAuditType', 'is_internal', 'boolean NOT NULL DEFAULT true'],
    ['tblAuditType', 'org_id', 'character varying(50)'],
    ['tblAuditType', 'branch_id', 'character varying(50)'],
    ['tblAuditType', 'dept_id', 'character varying(50)'],
    ['tblAuditType', 'int_status', 'integer NOT NULL DEFAULT 1'],
    ['tblAuditATMapping', 'org_id', 'character varying(50)'],
    ['tblAuditATMapping', 'branch_id', 'character varying(50)'],
    ['tblAuditATMapping', 'dept_id', 'character varying(50)'],
    ['tblAuditATMapping', 'int_status', 'integer NOT NULL DEFAULT 1'],
  ];
  for (const [table, col, ddl] of alterCols) {
    await dbPool.query(
      `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" ${ddl}`
    );
  }

  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblAuditType_org_id
      ON "tblAuditType" (org_id)
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblAuditType_int_status
      ON "tblAuditType" (int_status)
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_org_id
      ON "tblAuditATMapping" (org_id)
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_assettype_id
      ON "tblAuditATMapping" (assettype_id)
  `);
  await dbPool.query(`
    CREATE INDEX IF NOT EXISTS idx_tblAuditATMapping_audtp_id
      ON "tblAuditATMapping" (audtp_id)
  `);

  // Unique mapping per org + asset type + audit type
  await dbPool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblAuditATMapping_org_at_audtp
      ON "tblAuditATMapping" (org_id, assettype_id, audtp_id)
  `);

  // FK: mapping → audit type
  await dbPool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE lower(conname) = lower('fk_tblAuditATMapping_audtp_id')
      ) THEN
        ALTER TABLE "tblAuditATMapping"
          ADD CONSTRAINT fk_tblAuditATMapping_audtp_id
          FOREIGN KEY (audtp_id)
          REFERENCES "tblAuditType" (audtp_id)
          ON UPDATE CASCADE
          ON DELETE RESTRICT;
      END IF;
    END $$;
  `);

  // FK: mapping → asset types (column name assettype_id → tblAssetTypes.asset_type_id)
  const hasAssetTypes = await dbPool.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblAssetTypes'
    LIMIT 1
  `);
  if (hasAssetTypes.rows.length) {
    await dbPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE lower(conname) = lower('fk_tblAuditATMapping_assettype_id')
        ) THEN
          ALTER TABLE "tblAuditATMapping"
            ADD CONSTRAINT fk_tblAuditATMapping_assettype_id
            FOREIGN KEY (assettype_id)
            REFERENCES "tblAssetTypes" (asset_type_id)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
        END IF;
      EXCEPTION
        WHEN others THEN
          -- Skip if asset type PK/type mismatch on legacy DBs
          RAISE NOTICE 'fk_tblAuditATMapping_assettype_id skipped: %', SQLERRM;
      END $$;
    `);
  }

  // ID sequences for generators
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS "tblIDSequences" (
      table_key character varying(100) PRIMARY KEY,
      prefix character varying(50),
      last_number integer DEFAULT 0
    )
  `);
  await dbPool.query(`
    INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
    VALUES
      ('audit_type', 'AUDTP', 0),
      ('audit_at_mapping', 'AUDATM', 0)
    ON CONFLICT (table_key) DO UPDATE
    SET prefix = EXCLUDED.prefix
  `);

  // Keep sequences ahead of any seeded / manually inserted IDs
  await dbPool.query(`
    UPDATE "tblIDSequences" AS s
    SET last_number = GREATEST(
      s.last_number,
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(t.audtp_id FROM 6) AS INTEGER))
        FROM "tblAuditType" t
        WHERE t.audtp_id ~ '^AUDTP[0-9]+$'
      ), 0)
    )
    WHERE s.table_key = 'audit_type'
  `);
  await dbPool.query(`
    UPDATE "tblIDSequences" AS s
    SET last_number = GREATEST(
      s.last_number,
      COALESCE((
        SELECT MAX(CAST(SUBSTRING(t.audatm_id FROM 7) AS INTEGER))
        FROM "tblAuditATMapping" t
        WHERE t.audatm_id ~ '^AUDATM[0-9]+$'
      ), 0)
    )
    WHERE s.table_key = 'audit_at_mapping'
  `);

  // Soft CHECK for ID shape (skip if legacy bad rows somehow present)
  for (const { table, column, cname } of [
    { table: 'tblAuditType', column: 'audtp_id', cname: 'chk_tblAuditType_audtp_id_idfmt' },
    { table: 'tblAuditATMapping', column: 'audatm_id', cname: 'chk_tblAuditATMapping_audatm_id_idfmt' },
  ]) {
    await dbPool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${cname}') THEN
          IF NOT EXISTS (
            SELECT 1 FROM "${table}"
            WHERE "${column}" IS NOT NULL
              AND "${column}"::text !~ '^[A-Za-z][A-Za-z0-9_]*[0-9]{3,}$'
          ) THEN
            ALTER TABLE "${table}"
              ADD CONSTRAINT "${cname}"
              CHECK (
                "${column}" IS NULL
                OR "${column}"::text ~ '^[A-Za-z][A-Za-z0-9_]*[0-9]{3,}$'
              );
          END IF;
        END IF;
      END $$;
    `);
  }

  return { created: true };
}

module.exports = { ensureAuditTablesSchema };
