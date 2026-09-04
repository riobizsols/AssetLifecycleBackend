-- tblSPBModCat: maps spare-part brand models (tblSPBMod) to categories (tblSPCategory).
-- Replaces legacy tblISPModCat (camelCase / tblISPModel FK) with snake_case / tblSPBMod FK.

BEGIN;

CREATE TABLE IF NOT EXISTS "tblSPBMod" (
  spbm_id    character varying(20) PRIMARY KEY,
  spb_id     character varying(20) NOT NULL,
  text       character varying(100) NOT NULL,
  int_status integer NOT NULL DEFAULT 1,
  org_id     character varying(10) NOT NULL,
  branch_id  character varying(10),
  created_by character varying(50),
  created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  changed_by character varying(50),
  changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tblSPBModCat" (
  spbmc_id   character varying(20) PRIMARY KEY,
  spbm_id    character varying(20) NOT NULL,
  spc_id     character varying(20) NOT NULL,
  int_status integer NOT NULL DEFAULT 1,
  org_id     character varying(10) NOT NULL,
  branch_id  character varying(10),
  created_by character varying(50),
  created_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  changed_by character varying(50),
  changed_on timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spbmodcat_spbm_id ON "tblSPBModCat" (spbm_id);
CREATE INDEX IF NOT EXISTS idx_spbmodcat_spc_id ON "tblSPBModCat" (spc_id);
CREATE INDEX IF NOT EXISTS idx_spbmodcat_org_id ON "tblSPBModCat" (org_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_spbmodcat_model'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod'
  ) THEN
    ALTER TABLE "tblSPBModCat"
      ADD CONSTRAINT fk_spbmodcat_model
      FOREIGN KEY (spbm_id) REFERENCES "tblSPBMod"(spbm_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_spbmodcat_category'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPCategory'
  ) THEN
    ALTER TABLE "tblSPBModCat"
      ADD CONSTRAINT fk_spbmodcat_category
      FOREIGN KEY (spc_id) REFERENCES "tblSPCategory"(spc_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_spbmodcat_model_cat_org'
  ) THEN
    ALTER TABLE "tblSPBModCat"
      ADD CONSTRAINT uq_spbmodcat_model_cat_org
      UNIQUE (spbm_id, spc_id, org_id);
  END IF;
END $$;

-- Backfill tblSPBMod from tblISPModel when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblISPModel'
  ) THEN
    INSERT INTO "tblSPBMod" (
      spbm_id, spb_id, text, int_status, org_id, branch_id,
      created_by, created_on, changed_by, changed_on
    )
    SELECT
      i."spbmId",
      i."spbId",
      i."modelName",
      COALESCE(i.int_status, 1),
      i.org_id,
      i.branch_id,
      i.created_by,
      i.created_on,
      i.changed_by,
      i.changed_on
    FROM "tblISPModel" i
    WHERE i."spbmId" IS NOT NULL
      AND i."spbId" IS NOT NULL
      AND BTRIM(COALESCE(i."modelName", '')) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM "tblSPBMod" m WHERE m.spbm_id = i."spbmId"
      );
  END IF;
END $$;

-- Migrate rows from legacy tblISPModCat
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblISPModCat'
  ) THEN
    INSERT INTO "tblSPBModCat" (
      spbmc_id, spbm_id, spc_id, int_status, org_id, branch_id,
      created_by, created_on, changed_by, changed_on
    )
    SELECT
      mc."spbmcId",
      mc."spbmId",
      mc."spcId",
      COALESCE(mc.int_status, 1),
      mc.org_id,
      mc.branch_id,
      mc.created_by,
      mc.created_on,
      mc.changed_by,
      mc.changed_on
    FROM "tblISPModCat" mc
    WHERE mc."spbmcId" IS NOT NULL
      AND mc."spbmId" IS NOT NULL
      AND mc."spcId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "tblSPBModCat" c WHERE c.spbmc_id = mc."spbmcId"
      );
  END IF;
END $$;

COMMIT;
