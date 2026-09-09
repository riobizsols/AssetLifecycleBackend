-- Spare parts naming / ID cleanup (hospitality + tenant DBs)
-- 1) tblSPModel → tblSPBMod, PK spm_id → spbm_id, IDs SPBM###
-- 2) tblSPBrand: fix SPBR### → SPB### (column remains spb_id)
-- 3) tblISPPartNumberSpec (+ map FKs): camelCase → snake_case
-- Also accept misnamed tblSPPartNumberSpec if present.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Model table rename
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPModel'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod'
  ) THEN
    ALTER TABLE "tblSPModel" RENAME TO "tblSPBMod";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod' AND column_name = 'spm_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod' AND column_name = 'spbm_id'
  ) THEN
    ALTER TABLE "tblSPBMod" RENAME COLUMN spm_id TO spbm_id;
  END IF;
END $$;

-- Remap legacy SPMD### model ids → SPBM### (next free number if suffix collides)
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
  next_num INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(
    CASE WHEN spbm_id ~ '^SPBM[0-9]+$' THEN CAST(substring(spbm_id from 5) AS INTEGER) ELSE 0 END
  ), 0) INTO next_num
  FROM "tblSPBMod";

  FOR r IN
    SELECT spbm_id AS old_id
    FROM "tblSPBMod"
    WHERE spbm_id ~ '^SPMD[0-9]+$'
    ORDER BY spbm_id
  LOOP
    new_id := 'SPBM' || substring(r.old_id from 5);
    IF EXISTS (SELECT 1 FROM "tblSPBMod" WHERE spbm_id = new_id) THEN
      LOOP
        next_num := next_num + 1;
        new_id := 'SPBM' || lpad(next_num::text, 3, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM "tblSPBMod" WHERE spbm_id = new_id);
      END LOOP;
    END IF;

    BEGIN
      UPDATE "tblSPCategory" SET spm_id = new_id WHERE spm_id = r.old_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;
    UPDATE "tblSPBMod" SET spbm_id = new_id WHERE spbm_id = r.old_id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBMod'
  ) THEN
    UPDATE "tblIDSequences"
    SET prefix = 'SPBM',
        last_number = GREATEST(
          last_number,
          COALESCE((
            SELECT MAX(
              CASE
                WHEN spbm_id ~ '^SPBM[0-9]+$' THEN CAST(substring(spbm_id from 5) AS INTEGER)
                WHEN spbm_id ~ '^SPMD[0-9]+$' THEN CAST(substring(spbm_id from 5) AS INTEGER)
                ELSE 0
              END
            )
            FROM "tblSPBMod"
          ), 0)
        )
    WHERE table_key = 'sp_model';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Brand IDs: SPBR### → SPB###
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  new_id TEXT;
  next_num INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBrand'
  ) THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(
    CASE WHEN spb_id ~ '^SPB[0-9]+$' THEN CAST(substring(spb_id from 4) AS INTEGER) ELSE 0 END
  ), 0) INTO next_num
  FROM "tblSPBrand";

  FOR r IN
    SELECT spb_id AS old_id
    FROM "tblSPBrand"
    WHERE spb_id ~ '^SPBR[0-9]+$'
    ORDER BY spb_id
  LOOP
    new_id := 'SPB' || substring(r.old_id from 5);
    IF EXISTS (SELECT 1 FROM "tblSPBrand" WHERE spb_id = new_id) THEN
      next_num := next_num + 1;
      new_id := 'SPB' || lpad(next_num::text, 3, '0');
    END IF;

    UPDATE "tblSPCategory" SET spb_id = new_id WHERE spb_id = r.old_id;
    BEGIN
      UPDATE "tblSPBMod" SET spb_id = new_id WHERE spb_id = r.old_id;
    EXCEPTION WHEN undefined_table THEN
      UPDATE "tblSPModel" SET spb_id = new_id WHERE spb_id = r.old_id;
    END;
    BEGIN
      UPDATE "tblSPLotDet" SET brand_id = new_id WHERE brand_id = r.old_id;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;
    UPDATE "tblSPBrand" SET spb_id = new_id WHERE spb_id = r.old_id;
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPBrand'
  ) THEN
    UPDATE "tblIDSequences"
    SET prefix = 'SPB',
        last_number = GREATEST(
          last_number,
          COALESCE((
            SELECT MAX(
              CASE WHEN spb_id ~ '^SPB[0-9]+$' THEN CAST(substring(spb_id from 4) AS INTEGER) ELSE 0 END
            )
            FROM "tblSPBrand"
          ), 0)
        )
    WHERE table_key = 'sp_brand';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Part number spec columns → snake_case (ISP table; optional SP alias)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- If a wrongly named tblSPPartNumberSpec exists, rename to ISP name first
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPPartNumberSpec'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblISPPartNumberSpec'
  ) THEN
    ALTER TABLE "tblSPPartNumberSpec" RENAME TO "tblISPPartNumberSpec";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblISPPartNumberSpec'
  ) THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tblISPPartNumberSpec' AND column_name = 'sppnsId') THEN
      ALTER TABLE "tblISPPartNumberSpec" RENAME COLUMN "sppnsId" TO sppns_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tblISPPartNumberSpec' AND column_name = 'sppartExtId') THEN
      ALTER TABLE "tblISPPartNumberSpec" RENAME COLUMN "sppartExtId" TO sppart_ext_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tblISPPartNumberSpec' AND column_name = 'sppdId') THEN
      ALTER TABLE "tblISPPartNumberSpec" RENAME COLUMN "sppdId" TO sppd_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tblISPPartNumberSpec' AND column_name = 'aplvId') THEN
      ALTER TABLE "tblISPPartNumberSpec" RENAME COLUMN "aplvId" TO aplv_id;
    END IF;
  END IF;
END $$;

-- FK column on vendor part map
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tblISPPNVPNMap' AND column_name = 'sppnsId'
  ) THEN
    ALTER TABLE "tblISPPNVPNMap" RENAME COLUMN "sppnsId" TO sppns_id;
  END IF;
END $$;

COMMIT;
