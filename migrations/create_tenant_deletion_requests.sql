-- Organization / tenant account deletion requests (Apple Guideline 5.1.1(v))
-- Lives in the tenant registry database (TENANT_DATABASE_URL)

CREATE TABLE IF NOT EXISTS "tenant_deletion_requests" (
    request_id character varying(64) PRIMARY KEY,
    confirmation_token_hash text NOT NULL,
    org_id character varying(10) NOT NULL,
    subdomain character varying(63),
    db_name character varying(255) NOT NULL,
    org_email character varying(320) NOT NULL,
    org_name character varying(255),
    status character varying(32) NOT NULL DEFAULT 'pending',
    -- pending | statement_ok | warning_ok | otp_sent | otp_verified | deleting | completed | failed | expired | cancelled
    statement_confirmed_at timestamp with time zone,
    warning_acknowledged_at timestamp with time zone,
    otp_hash text,
    otp_expires_at timestamp with time zone,
    otp_sent_at timestamp with time zone,
    otp_attempts integer NOT NULL DEFAULT 0,
    otp_verified_at timestamp with time zone,
    resend_count integer NOT NULL DEFAULT 0,
    ip_address character varying(64),
    user_agent text,
    error_message text,
    audit_payload jsonb,
    progress_percent integer NOT NULL DEFAULT 0,
    progress_stage character varying(64),
    progress_message text,
    deletion_started_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone
);

-- Upgrade existing tables with progress tracking columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tenant_deletion_requests'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenant_deletion_requests' AND column_name = 'progress_percent'
        ) THEN
            ALTER TABLE "tenant_deletion_requests" ADD COLUMN progress_percent integer NOT NULL DEFAULT 0;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenant_deletion_requests' AND column_name = 'progress_stage'
        ) THEN
            ALTER TABLE "tenant_deletion_requests" ADD COLUMN progress_stage character varying(64);
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenant_deletion_requests' AND column_name = 'progress_message'
        ) THEN
            ALTER TABLE "tenant_deletion_requests" ADD COLUMN progress_message text;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'tenant_deletion_requests' AND column_name = 'deletion_started_at'
        ) THEN
            ALTER TABLE "tenant_deletion_requests" ADD COLUMN deletion_started_at timestamp with time zone;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tenant_deletion_requests_org_id
    ON "tenant_deletion_requests"(org_id);

CREATE INDEX IF NOT EXISTS idx_tenant_deletion_requests_status
    ON "tenant_deletion_requests"(status);

CREATE INDEX IF NOT EXISTS idx_tenant_deletion_requests_created
    ON "tenant_deletion_requests"(created_at);

COMMENT ON TABLE "tenant_deletion_requests" IS 'Multi-step organization account deletion workflow (OTP + confirmations)';
COMMENT ON COLUMN "tenant_deletion_requests".progress_percent IS 'Live deletion job progress 0-100';
COMMENT ON COLUMN "tenant_deletion_requests".progress_stage IS 'Current deletion stage key';
COMMENT ON COLUMN "tenant_deletion_requests".progress_message IS 'Human-readable progress message for UI';
