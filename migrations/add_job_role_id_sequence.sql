-- Add ID sequence for Job Role auto-generation
-- This enables automatic generation of Job Role IDs like JR001, JR002, etc.

-- Check if entry already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "tblIDSequences" WHERE table_key = 'job_role'
    ) THEN
        -- Insert new sequence entry
        INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
        VALUES ('job_role', 'JR', 0);
        
        RAISE NOTICE 'Added job_role to tblIDSequences with prefix JR';
    ELSE
        RAISE NOTICE 'job_role already exists in tblIDSequences';
    END IF;
END $$;

-- Verify the entry
SELECT * FROM "tblIDSequences" WHERE table_key = 'job_role';

