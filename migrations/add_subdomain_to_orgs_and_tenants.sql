-- Migration: Add subdomain column to organizations and tenants tables
-- This enables subdomain-based multi-tenant access

-- Add subdomain column to tblOrgs table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tblOrgs' AND column_name = 'subdomain'
    ) THEN
        ALTER TABLE "tblOrgs" ADD COLUMN subdomain VARCHAR(63) UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_tblorgs_subdomain ON "tblOrgs"(subdomain);
        COMMENT ON COLUMN "tblOrgs".subdomain IS 'Subdomain for organization URL (e.g., orgname.example.com)';
    END IF;
END $$;

-- Add subdomain column to tenants table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tenants' AND column_name = 'subdomain'
    ) THEN
        ALTER TABLE "tenants" ADD COLUMN subdomain VARCHAR(63) UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON "tenants"(subdomain);
        COMMENT ON COLUMN "tenants".subdomain IS 'Subdomain for tenant URL (e.g., orgname.example.com)';
    END IF;
END $$;

-- Update existing organizations with generated subdomains (optional)
-- This will generate subdomains for existing organizations based on their name
DO $$
DECLARE
    org_record RECORD;
    generated_subdomain VARCHAR(63);
BEGIN
    FOR org_record IN 
        SELECT org_id, text, COALESCE(subdomain, '') as current_subdomain 
        FROM "tblOrgs" 
        WHERE (subdomain IS NULL OR subdomain = '') AND int_status = 1
    LOOP
        -- Generate subdomain from org name
        generated_subdomain := LOWER(REGEXP_REPLACE(org_record.text, '[^a-z0-9-]', '-', 'g'));
        generated_subdomain := REGEXP_REPLACE(generated_subdomain, '-+', '-', 'g');
        generated_subdomain := TRIM(BOTH '-' FROM generated_subdomain);
        
        -- Limit to 63 characters
        IF LENGTH(generated_subdomain) > 63 THEN
            generated_subdomain := SUBSTRING(generated_subdomain, 1, 63);
            generated_subdomain := RTRIM(generated_subdomain, '-');
        END IF;
        
        -- Ensure it doesn't start with a number
        IF generated_subdomain ~ '^[0-9]' THEN
            generated_subdomain := 'org-' || generated_subdomain;
        END IF;
        
        -- Make it unique by appending org_id if needed
        WHILE EXISTS (SELECT 1 FROM "tblOrgs" WHERE subdomain = generated_subdomain AND org_id != org_record.org_id) LOOP
            generated_subdomain := generated_subdomain || '-' || SUBSTRING(org_record.org_id, -3);
        END LOOP;
        
        -- Update the organization
        UPDATE "tblOrgs" 
        SET subdomain = generated_subdomain 
        WHERE org_id = org_record.org_id;
        
        RAISE NOTICE 'Generated subdomain % for organization %', generated_subdomain, org_record.org_id;
    END LOOP;
END $$;

