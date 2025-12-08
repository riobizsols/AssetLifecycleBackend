-- =============================================================================
-- CREATE VENDOR RENEWAL TABLE
-- =============================================================================
-- This script creates the tblVendorRenewal table for tracking vendor contract
-- renewals when MT005 (Vendor Contract Renewal) workflows are approved.
--
-- Run this in your PostgreSQL database client (pgAdmin, DBeaver, etc.)
-- =============================================================================

-- Step 1: Create the main table
CREATE TABLE IF NOT EXISTS "tblVendorRenewal" (
    vr_id VARCHAR(50) PRIMARY KEY,
    wfamsh_id VARCHAR(50) NOT NULL,
    vendor_id VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(255),
    contract_start_date DATE,
    contract_end_date DATE,
    previous_contract_end_date DATE,
    renewal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    renewal_approved_by VARCHAR(50),
    renewal_notes TEXT,
    status VARCHAR(10) DEFAULT 'CO',
    org_id VARCHAR(50) NOT NULL,
    branch_code VARCHAR(50),
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50),
    changed_on TIMESTAMP
);

-- Step 2: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_renewal_vendor_id 
    ON "tblVendorRenewal" (vendor_id);

CREATE INDEX IF NOT EXISTS idx_vendor_renewal_wfamsh_id 
    ON "tblVendorRenewal" (wfamsh_id);

CREATE INDEX IF NOT EXISTS idx_vendor_renewal_org_id 
    ON "tblVendorRenewal" (org_id);

CREATE INDEX IF NOT EXISTS idx_vendor_renewal_renewal_date 
    ON "tblVendorRenewal" (renewal_date);

-- Step 3: Add foreign key constraints (optional - comment out if tables don't exist yet)
-- Uncomment these if you want foreign key constraints:

/*
ALTER TABLE "tblVendorRenewal" 
    ADD CONSTRAINT fk_vendor_renewal_vendor 
    FOREIGN KEY (vendor_id) 
    REFERENCES "tblVendors" (vendor_id) 
    ON DELETE CASCADE;

ALTER TABLE "tblVendorRenewal" 
    ADD CONSTRAINT fk_vendor_renewal_workflow 
    FOREIGN KEY (wfamsh_id) 
    REFERENCES "tblWFAssetMaintSch_H" (wfamsh_id) 
    ON DELETE CASCADE;
*/

-- Step 4: Verify the table was created
SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'tblVendorRenewal') as column_count
FROM information_schema.tables 
WHERE table_name = 'tblVendorRenewal';

-- Step 5: View the table structure
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'tblVendorRenewal'
ORDER BY ordinal_position;

-- =============================================================================
-- SUCCESS! Table tblVendorRenewal is now ready
-- =============================================================================
-- The system will now automatically create records in this table when:
-- 1. A vendor contract renewal workflow (MT005) is created
-- 2. All approvers approve the workflow
-- 3. The workflow status becomes 'CO' (Completed)
-- =============================================================================
