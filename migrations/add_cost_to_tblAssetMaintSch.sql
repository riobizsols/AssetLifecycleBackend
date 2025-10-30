-- Add cost column to tblAssetMaintSch table
-- This migration adds a cost field to store maintenance costs

-- Add cost column to tblAssetMaintSch
ALTER TABLE "tblAssetMaintSch" 
ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2);

-- Add comment to the column
COMMENT ON COLUMN "tblAssetMaintSch".cost IS 'Maintenance cost in decimal format';

-- Update existing records to have cost as 0.00 if NULL
UPDATE "tblAssetMaintSch" 
SET cost = 0.00 
WHERE cost IS NULL;
