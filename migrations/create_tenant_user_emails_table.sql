-- Universal tenant email registry (postgres / TENANT_DATABASE_URL)
-- Maps user/employee emails -> tenant subdomain + org_id for ALM app login (no subdomain in URL)

CREATE TABLE IF NOT EXISTS "tenant_user_emails" (
    email_normalized character varying(320) PRIMARY KEY,
    email_display character varying(320) NOT NULL,
    org_id character varying(10) NOT NULL,
    subdomain character varying(63) NOT NULL,
    user_id character varying(50),
    employee_id character varying(50),
    source character varying(64) NOT NULL DEFAULT 'unknown',
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenant_user_emails_org_id
    ON "tenant_user_emails"(org_id);

CREATE INDEX IF NOT EXISTS idx_tenant_user_emails_subdomain
    ON "tenant_user_emails"(subdomain);

COMMENT ON TABLE "tenant_user_emails" IS 'Maps login emails to tenant subdomain/org_id for mobile (ALM) login without URL subdomain';
COMMENT ON COLUMN "tenant_user_emails".email_normalized IS 'Lowercase trimmed email — primary lookup key';
COMMENT ON COLUMN "tenant_user_emails".subdomain IS 'Tenant subdomain used to resolve credentials in tenants table';
