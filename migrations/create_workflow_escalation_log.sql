-- Migration: Create Workflow Escalation Log Table
-- Description: This table logs all workflow escalations when cutoff dates are exceeded
-- Created: 2025-10-15

-- Create the escalation log table
CREATE TABLE IF NOT EXISTS "tblWorkflowEscalationLog" (
    escalation_log_id SERIAL PRIMARY KEY,
    wfamsh_id VARCHAR(50) NOT NULL,
    from_wfamsd_id VARCHAR(50) NOT NULL,
    to_wfamsd_id VARCHAR(50) NOT NULL,
    escalation_reason TEXT,
    escalated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    org_id VARCHAR(50) NOT NULL DEFAULT 'ORG001',
    created_by VARCHAR(255) DEFAULT 'SYSTEM',
    
    -- Foreign key constraints
    CONSTRAINT fk_wfamsh
        FOREIGN KEY (wfamsh_id) 
        REFERENCES "tblWFAssetMaintSch_H"(wfamsh_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_from_wfamsd
        FOREIGN KEY (from_wfamsd_id) 
        REFERENCES "tblWFAssetMaintSch_D"(wfamsd_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_to_wfamsd
        FOREIGN KEY (to_wfamsd_id) 
        REFERENCES "tblWFAssetMaintSch_D"(wfamsd_id)
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_escalation_log_wfamsh_id 
    ON "tblWorkflowEscalationLog"(wfamsh_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_from_wfamsd 
    ON "tblWorkflowEscalationLog"(from_wfamsd_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_to_wfamsd 
    ON "tblWorkflowEscalationLog"(to_wfamsd_id);

CREATE INDEX IF NOT EXISTS idx_escalation_log_date 
    ON "tblWorkflowEscalationLog"(escalated_on);

CREATE INDEX IF NOT EXISTS idx_escalation_log_org_id 
    ON "tblWorkflowEscalationLog"(org_id);

-- Add comments to the table and columns
COMMENT ON TABLE "tblWorkflowEscalationLog" IS 'Logs all workflow escalations when cutoff dates are exceeded';
COMMENT ON COLUMN "tblWorkflowEscalationLog".escalation_log_id IS 'Primary key - auto-incrementing ID';
COMMENT ON COLUMN "tblWorkflowEscalationLog".wfamsh_id IS 'Workflow header ID';
COMMENT ON COLUMN "tblWorkflowEscalationLog".from_wfamsd_id IS 'Workflow detail ID of the approver who missed the deadline';
COMMENT ON COLUMN "tblWorkflowEscalationLog".to_wfamsd_id IS 'Workflow detail ID of the next approver';
COMMENT ON COLUMN "tblWorkflowEscalationLog".escalation_reason IS 'Reason for escalation (e.g., Cutoff date exceeded)';
COMMENT ON COLUMN "tblWorkflowEscalationLog".escalated_on IS 'Timestamp when the escalation occurred';
COMMENT ON COLUMN "tblWorkflowEscalationLog".org_id IS 'Organization ID';

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON "tblWorkflowEscalationLog" TO your_app_user;
-- GRANT USAGE, SELECT ON SEQUENCE "tblWorkflowEscalationLog_escalation_log_id_seq" TO your_app_user;

-- Sample query to view escalation history
-- SELECT 
--     wel.escalation_log_id,
--     wel.wfamsh_id,
--     wel.escalation_reason,
--     wel.escalated_on,
--     wfh.asset_id,
--     a.asset_type_id,
--     at.text as asset_type_name,
--     u_from.full_name as from_approver,
--     u_to.full_name as to_approver
-- FROM "tblWorkflowEscalationLog" wel
-- JOIN "tblWFAssetMaintSch_H" wfh ON wel.wfamsh_id = wfh.wfamsh_id
-- JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
-- JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
-- JOIN "tblWFAssetMaintSch_D" wfd_from ON wel.from_wfamsd_id = wfd_from.wfamsd_id
-- JOIN "tblWFAssetMaintSch_D" wfd_to ON wel.to_wfamsd_id = wfd_to.wfamsd_id
-- LEFT JOIN "tblUsers" u_from ON wfd_from.user_id = u_from.user_id
-- LEFT JOIN "tblUsers" u_to ON wfd_to.user_id = u_to.user_id
-- ORDER BY wel.escalated_on DESC;

