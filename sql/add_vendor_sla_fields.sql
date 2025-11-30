-- SQL Queries to add new fields to tblVendors table
-- Run these queries in your PostgreSQL database

-- Add 10 SLA fields (storing the SLA description text values)
ALTER TABLE public."tblVendors" 
ADD COLUMN IF NOT EXISTS sla_1 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_2 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_3 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_4 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_5 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_6 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_7 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_8 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_9 VARCHAR(255),
ADD COLUMN IF NOT EXISTS sla_10 VARCHAR(255);

-- Add Contract Start Date and Contract End Date
ALTER TABLE public."tblVendors" 
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Add comments to columns for documentation
COMMENT ON COLUMN public."tblVendors".sla_1 IS 'SLA Description 1 (e.g., First response)';
COMMENT ON COLUMN public."tblVendors".sla_2 IS 'SLA Description 2 (e.g., Site Visit)';
COMMENT ON COLUMN public."tblVendors".sla_3 IS 'SLA Description 3 (e.g., Resolution)';
COMMENT ON COLUMN public."tblVendors".sla_4 IS 'SLA Description 4 (e.g., Invoice Clearance)';
COMMENT ON COLUMN public."tblVendors".sla_5 IS 'SLA Description 5';
COMMENT ON COLUMN public."tblVendors".sla_6 IS 'SLA Description 6';
COMMENT ON COLUMN public."tblVendors".sla_7 IS 'SLA Description 7';
COMMENT ON COLUMN public."tblVendors".sla_8 IS 'SLA Description 8';
COMMENT ON COLUMN public."tblVendors".sla_9 IS 'SLA Description 9';
COMMENT ON COLUMN public."tblVendors".sla_10 IS 'SLA Description 10';
COMMENT ON COLUMN public."tblVendors".contract_start_date IS 'Contract Start Date';
COMMENT ON COLUMN public."tblVendors".contract_end_date IS 'Contract End Date';

