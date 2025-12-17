-- Create table for column access configuration
CREATE TABLE IF NOT EXISTS "tblColumnAccessConfig" (
    column_access_id VARCHAR(50) PRIMARY KEY,
    job_role_id VARCHAR(50) NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('DISPLAY', 'NONE')),
    org_id VARCHAR(20) NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    changed_on TIMESTAMP,
    changed_by VARCHAR(50),
    UNIQUE(job_role_id, table_name, field_name, org_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_column_access_job_role ON "tblColumnAccessConfig"(job_role_id, org_id);
CREATE INDEX IF NOT EXISTS idx_column_access_table ON "tblColumnAccessConfig"(table_name, org_id);

COMMENT ON TABLE "tblColumnAccessConfig" IS 'Stores column-level access configuration for different job roles. AUTH access is full access and does not need to be stored. Only DISPLAY and NONE need to be configured.';

