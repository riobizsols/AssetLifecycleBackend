-- Migration: Create Technical Log Configuration Table
-- Description: Stores configuration for technical event logging system
-- Created: 2025-10-14

-- Create the technical log configuration table
CREATE TABLE IF NOT EXISTS "tblTechnicalLogConfig" (
    id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL DEFAULT 'ERROR',
    enabled BOOLEAN DEFAULT TRUE,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_app_log_config UNIQUE(app_id),
    CONSTRAINT check_log_level CHECK (log_level IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL', 'NONE'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_technical_log_config_app_id ON "tblTechnicalLogConfig"(app_id);
CREATE INDEX IF NOT EXISTS idx_technical_log_config_enabled ON "tblTechnicalLogConfig"(enabled);

-- Insert configurations for main app IDs from database sidebar
-- Only main page app IDs, not sub-screens
INSERT INTO "tblTechnicalLogConfig" (app_id, log_level, enabled)
VALUES 
    ('DASHBOARD', 'ERROR', true),
    ('ASSETS', 'ERROR', true),
    ('ASSETASSIGNMENT', 'ERROR', true),
    ('VENDORS', 'ERROR', true),
    ('DEPTASSIGNMENT', 'ERROR', true),
    ('EMPASSIGNMENT', 'ERROR', true),
    ('WORKORDERMANAGEMENT', 'ERROR', true),
    ('INSPECTION', 'ERROR', true),
    ('MAINTENANCEAPPROVAL', 'ERROR', true),
    ('SUPERVISORAPPROVAL', 'ERROR', true),
    ('REPORTBREAKDOWN', 'ERROR', true),
    ('ASSETLIFECYCLEREPORT', 'ERROR', true),
    ('ASSETREPORT', 'ERROR', true),
    ('MAINTENANCEHISTORY', 'ERROR', true),
    ('ASSETVALUATION', 'ERROR', true),
    ('ASSETWORKFLOWHISTORY', 'ERROR', true),
    ('BREAKDOWNHISTORY', 'ERROR', true),
    ('ADMINSETTINGS', 'ERROR', true),
    ('MASTERDATA', 'ERROR', true),
    ('ORGANIZATIONS', 'ERROR', true),
    ('ASSETTYPES', 'ERROR', true),
    ('DEPARTMENTS', 'ERROR', true),
    ('BRANCHES', 'ERROR', true),
    ('USERS', 'ERROR', true),
    ('MAINTENANCESCHEDULE', 'ERROR', true),
    ('AUDITLOGS', 'ERROR', true),
    ('AUDITLOGCONFIG', 'ERROR', true),
    ('GROUPASSET', 'ERROR', true),
    ('SCRAPSALES', 'ERROR', true),
    ('SCRAPASSETS', 'ERROR', true),
    ('LOGIN', 'INFO', true)
ON CONFLICT (app_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE "tblTechnicalLogConfig" IS 'Configuration table for technical event logging system';
COMMENT ON COLUMN "tblTechnicalLogConfig".app_id IS 'Application/module identifier';
COMMENT ON COLUMN "tblTechnicalLogConfig".log_level IS 'Log level name: INFO, WARNING, ERROR, CRITICAL, NONE (numeric code derived when needed)';

-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_technical_log_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
DROP TRIGGER IF EXISTS trigger_update_technical_log_config_timestamp ON "tblTechnicalLogConfig";
CREATE TRIGGER trigger_update_technical_log_config_timestamp
    BEFORE UPDATE ON "tblTechnicalLogConfig"
    FOR EACH ROW
    EXECUTE FUNCTION update_technical_log_config_timestamp();
