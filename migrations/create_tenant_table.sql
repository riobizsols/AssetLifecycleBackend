-- Create tenant table to store organization database credentials
-- This table is stored in the tenant registry database (from TENANT_DATABASE_URL)
-- Each organization has its own database, and this table maps org_id to database credentials

CREATE TABLE IF NOT EXISTS "tenants" (
    org_id character varying(10) PRIMARY KEY,
    db_host character varying(255) NOT NULL,
    db_port integer NOT NULL DEFAULT 5432,
    db_name character varying(255) NOT NULL,
    db_user character varying(255) NOT NULL,
    db_password text NOT NULL, -- Encrypted password
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_org_id'
    ) THEN
        ALTER TABLE "tenants" ADD CONSTRAINT unique_org_id UNIQUE (org_id);
    END IF;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tenants_org_id ON "tenants"(org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON "tenants"(is_active);

-- Add comment
COMMENT ON TABLE "tenants" IS 'Stores database credentials for each organization in multi-tenant setup';
COMMENT ON COLUMN "tenants".org_id IS 'Organization ID (primary key)';
COMMENT ON COLUMN "tenants".db_host IS 'Database host address';
COMMENT ON COLUMN "tenants".db_port IS 'Database port number';
COMMENT ON COLUMN "tenants".db_name IS 'Database name for this organization';
COMMENT ON COLUMN "tenants".db_user IS 'Database username';
COMMENT ON COLUMN "tenants".db_password IS 'Encrypted database password';

