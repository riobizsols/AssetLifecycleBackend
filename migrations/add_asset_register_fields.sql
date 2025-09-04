-- Migration to add missing fields for Asset Register Report
-- Run this script to add the required fields to tblAssets table

-- Add PO Number field
ALTER TABLE "tblAssets" 
ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);

-- Add Invoice Number field  
ALTER TABLE "tblAssets" 
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100);

-- Add Commissioned Date field
ALTER TABLE "tblAssets" 
ADD COLUMN IF NOT EXISTS commissioned_date DATE;

-- Add Status field (separate from current_status for report purposes)
ALTER TABLE "tblAssets" 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';

-- Add comments to document the new fields
COMMENT ON COLUMN "tblAssets".po_number IS 'Purchase Order Number';
COMMENT ON COLUMN "tblAssets".invoice_number IS 'Invoice Number';
COMMENT ON COLUMN "tblAssets".commissioned_date IS 'Date when asset was commissioned/put into service';
COMMENT ON COLUMN "tblAssets".status IS 'Asset status for reporting purposes (Active, In Use, Under Maintenance, Disposed)';

-- Update existing records to have default values
UPDATE "tblAssets" 
SET status = COALESCE(current_status, 'Active')
WHERE status IS NULL;

-- Set commissioned_date to purchased_on for existing records if not set
UPDATE "tblAssets" 
SET commissioned_date = purchased_on
WHERE commissioned_date IS NULL AND purchased_on IS NOT NULL;
