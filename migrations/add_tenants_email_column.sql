-- Organization contact email on tenants registry (for account deletion lookup)
-- Lives in TENANT_DATABASE_URL registry DB

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'email'
  ) THEN
    ALTER TABLE "tenants" ADD COLUMN email character varying(320);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_email_lower
  ON "tenants" (LOWER(email))
  WHERE email IS NOT NULL;

COMMENT ON COLUMN "tenants".email IS 'Organization admin / registered contact email for tenant account deletion lookup';
