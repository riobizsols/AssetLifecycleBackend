-- SQL Query to add contract_start_date and contract_end_date columns to tblVendors
-- This should be run on tenant databases that don't have these columns

-- Add contract date columns if they don't exist
ALTER TABLE public."tblVendors" 
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Add comments
COMMENT ON COLUMN public."tblVendors".contract_start_date IS 'Contract start date for vendor';
COMMENT ON COLUMN public."tblVendors".contract_end_date IS 'Contract end date for vendor';

