-- Add ID sequence for Job Role Navigation auto-generation
-- This enables automatic generation of Navigation IDs like JRN001, JRN002, etc.

-- Check if entry already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "tblIDSequences" WHERE table_key = 'job_role_nav'
    ) THEN
        -- Insert new sequence entry
        INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
        VALUES ('job_role_nav', 'JRN', 0);
        
        RAISE NOTICE 'Added job_role_nav to tblIDSequences with prefix JRN';
    ELSE
        RAISE NOTICE 'job_role_nav already exists in tblIDSequences';
    END IF;
END $$;

-- Verify the entry
SELECT * FROM "tblIDSequences" WHERE table_key = 'job_role_nav';

