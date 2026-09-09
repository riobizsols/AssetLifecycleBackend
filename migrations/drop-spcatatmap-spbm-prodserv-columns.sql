-- Remove spbm_id and prod_serv_id from tblSPCatATMap.
-- Mapping is now category (spc_id) + asset type only.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPCatATMap'
  ) THEN
    ALTER TABLE "tblSPCatATMap" DROP CONSTRAINT IF EXISTS fk_spcatatmap_spbm;
    ALTER TABLE "tblSPCatATMap" DROP CONSTRAINT IF EXISTS fk_spcatatmap_prod_serv;
    ALTER TABLE "tblSPCatATMap" DROP CONSTRAINT IF EXISTS uq_spcatatmap_spc_at_spbm_prodserv;
    DROP INDEX IF EXISTS idx_spcatatmap_spbm;
    DROP INDEX IF EXISTS idx_spcatatmap_prod_serv;

    ALTER TABLE "tblSPCatATMap" DROP COLUMN IF EXISTS spbm_id;
    ALTER TABLE "tblSPCatATMap" DROP COLUMN IF EXISTS prod_serv_id;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'uq_spcatatmap_spc_at_org'
    ) THEN
      ALTER TABLE "tblSPCatATMap"
        ADD CONSTRAINT uq_spcatatmap_spc_at_org
        UNIQUE (spc_id, asset_type_id, org_id);
    END IF;
  END IF;
END $$;

COMMIT;
