-- tblAssetTypes: maintenance / spare-parts requirement flags
-- tblATMaintCheckList: per-checklist spare part requirement + category mapping link

BEGIN;

ALTER TABLE "tblAssetTypes"
  ADD COLUMN IF NOT EXISTS required_maint BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tblAssetTypes"
  ADD COLUMN IF NOT EXISTS required_spare_parts BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tblATMaintCheckList"
  ADD COLUMN IF NOT EXISTS required_spare_part BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tblATMaintCheckList"
  ADD COLUMN IF NOT EXISTS spcatm_id character varying(20);

CREATE INDEX IF NOT EXISTS idx_atmaintchecklist_spcatm_id
  ON "tblATMaintCheckList" (spcatm_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tblSPCatATMap'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_atmaintchecklist_spcatm'
  ) THEN
    ALTER TABLE "tblATMaintCheckList"
      ADD CONSTRAINT fk_atmaintchecklist_spcatm
      FOREIGN KEY (spcatm_id) REFERENCES "tblSPCatATMap"(spcatm_id)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
