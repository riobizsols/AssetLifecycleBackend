-- Migration: Add last_gen_seq_no column to tblAssetTypes table
-- This column will store the last generated sequence number for each asset type

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    -- Check if the column already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'tblAssetTypes' 
        AND column_name = 'last_gen_seq_no'
    ) THEN
        -- Add the column
        ALTER TABLE "tblAssetTypes" 
        ADD COLUMN last_gen_seq_no INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added last_gen_seq_no column to tblAssetTypes table';
    ELSE
        RAISE NOTICE 'Column last_gen_seq_no already exists in tblAssetTypes table';
    END IF;
END $$;

-- Update existing records to have 0 as default value
UPDATE "tblAssetTypes" 
SET last_gen_seq_no = 0 
WHERE last_gen_seq_no IS NULL;

-- Add a comment to the column
COMMENT ON COLUMN "tblAssetTypes".last_gen_seq_no IS 'Last generated sequence number for serial number generation per asset type';
