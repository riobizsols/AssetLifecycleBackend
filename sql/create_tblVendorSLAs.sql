-- SQL Query to create tblVendorSLAs table
-- This table stores vendor SLA values (in hours) - one row per vendor with 10 SLA columns

CREATE TABLE IF NOT EXISTS public."tblVendorSLAs" (
    vsla_id VARCHAR(50) PRIMARY KEY,
    vendor_id VARCHAR(50) NOT NULL UNIQUE,
    "SLA-1" VARCHAR(255),
    "SLA-2" VARCHAR(255),
    "SLA-3" VARCHAR(255),
    "SLA-4" VARCHAR(255),
    "SLA-5" VARCHAR(255),
    "SLA-6" VARCHAR(255),
    "SLA-7" VARCHAR(255),
    "SLA-8" VARCHAR(255),
    "SLA-9" VARCHAR(255),
    "SLA-10" VARCHAR(255),
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50),
    changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    int_status INTEGER DEFAULT 1,
    
    -- Foreign key constraint
    CONSTRAINT fk_vendor_sla_vendor 
        FOREIGN KEY (vendor_id) 
        REFERENCES public."tblVendors"(vendor_id) 
        ON DELETE CASCADE
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_slas_vendor_id 
    ON public."tblVendorSLAs"(vendor_id);

-- Add comments
COMMENT ON TABLE public."tblVendorSLAs" IS 'Stores vendor SLA values (in hours) - one row per vendor with 10 SLA columns';
COMMENT ON COLUMN public."tblVendorSLAs".vsla_id IS 'Primary key - generated using id generator';
COMMENT ON COLUMN public."tblVendorSLAs".vendor_id IS 'Foreign key to tblVendors (unique - one row per vendor)';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-1" IS 'SLA-1 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-2" IS 'SLA-2 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-3" IS 'SLA-3 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-4" IS 'SLA-4 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-5" IS 'SLA-5 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-6" IS 'SLA-6 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-7" IS 'SLA-7 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-8" IS 'SLA-8 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-9" IS 'SLA-9 value in hours';
COMMENT ON COLUMN public."tblVendorSLAs"."SLA-10" IS 'SLA-10 value in hours';

-- Add entry to tblIDSequences for vsla_id generation
-- Note: This assumes tblIDSequences table exists with columns: table_key, last_number, prefix
INSERT INTO public."tblIDSequences" (table_key, last_number, prefix)
VALUES ('vendor_sla', 0, 'VSLA')
ON CONFLICT (table_key) DO NOTHING;
