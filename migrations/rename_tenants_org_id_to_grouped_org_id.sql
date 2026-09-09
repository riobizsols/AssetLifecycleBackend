-- Rename tenants.org_id → grouped_org_id and add org_name.
-- Registry PK stores the internally generated ORG###; org_name stores the UI organization name.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'org_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'grouped_org_id'
  ) THEN
    ALTER TABLE "tenants" RENAME COLUMN org_id TO grouped_org_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'org_name'
  ) THEN
    ALTER TABLE "tenants" ADD COLUMN org_name character varying(255);
  END IF;
END $$;

-- Rename legacy constraints / indexes when present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_id') THEN
    ALTER TABLE "tenants" RENAME CONSTRAINT unique_org_id TO unique_grouped_org_id;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

ALTER INDEX IF EXISTS idx_tenants_org_id RENAME TO idx_tenants_grouped_org_id;

CREATE INDEX IF NOT EXISTS idx_tenants_grouped_org_id ON "tenants"(grouped_org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_org_name ON "tenants"(org_name);

COMMENT ON COLUMN "tenants".grouped_org_id IS 'Internally generated organization id (ORG###); primary key for tenant registry';
COMMENT ON COLUMN "tenants".org_name IS 'Organization display name entered during tenant setup';
