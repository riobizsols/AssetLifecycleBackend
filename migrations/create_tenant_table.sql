-- Create tenant table to store organization database credentials
-- This table is stored in the tenant registry database (from TENANT_DATABASE_URL)
-- Each organization has its own database; grouped_org_id maps to credentials

CREATE TABLE IF NOT EXISTS "tenants" (
    grouped_org_id character varying(10) PRIMARY KEY,
    org_name character varying(255),
    db_host character varying(255) NOT NULL,
    db_port integer NOT NULL DEFAULT 5432,
    db_name character varying(255) NOT NULL,
    db_user character varying(255) NOT NULL,
    db_password text NOT NULL, -- Encrypted password
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    subdomain character varying(63) UNIQUE,
    email character varying(320)
);

-- Upgrade path: rename legacy org_id → grouped_org_id
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

-- Upgrade: add org_name
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

-- Upgrade: add subdomain if table was created from an older migration without this column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenants'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'subdomain'
    ) THEN
        ALTER TABLE "tenants" ADD COLUMN subdomain character varying(63) UNIQUE;
    END IF;
END $$;

-- Upgrade: add organization contact email for account-deletion lookup
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_grouped_org_id'
    ) THEN
        BEGIN
            ALTER TABLE "tenants" ADD CONSTRAINT unique_grouped_org_id UNIQUE (grouped_org_id);
        EXCEPTION
            WHEN others THEN NULL;
        END;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenants_grouped_org_id ON "tenants"(grouped_org_id);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON "tenants"(is_active);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON "tenants"(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_org_name ON "tenants"(org_name);
CREATE INDEX IF NOT EXISTS idx_tenants_email_lower ON "tenants"(LOWER(email)) WHERE email IS NOT NULL;

COMMENT ON TABLE "tenants" IS 'Stores database credentials for each organization in multi-tenant setup';
COMMENT ON COLUMN "tenants".grouped_org_id IS 'Internally generated organization id (ORG###); primary key';
COMMENT ON COLUMN "tenants".org_name IS 'Organization display name from tenant setup';
COMMENT ON COLUMN "tenants".db_host IS 'Database host address';
COMMENT ON COLUMN "tenants".db_port IS 'Database port number';
COMMENT ON COLUMN "tenants".db_name IS 'Database name for this organization';
COMMENT ON COLUMN "tenants".db_user IS 'Database username';
COMMENT ON COLUMN "tenants".db_password IS 'Encrypted database password';
COMMENT ON COLUMN "tenants".subdomain IS 'Subdomain for tenant URL (e.g., orgname.example.com)';
COMMENT ON COLUMN "tenants".email IS 'Organization admin / registered contact email for account deletion lookup';
