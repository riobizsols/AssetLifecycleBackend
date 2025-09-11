-- Enhance tblPrintSerialNoQueue table to support asset management and label printing
-- This migration adds necessary fields for asset integration and print queue management

-- Add new columns to tblPrintSerialNoQueue
ALTER TABLE "tblPrintSerialNoQueue" 
ADD COLUMN IF NOT EXISTS asset_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS asset_type_id VARCHAR(20),
ADD COLUMN IF NOT EXISTS asset_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS asset_location VARCHAR(255),
ADD COLUMN IF NOT EXISTS reason VARCHAR(100) DEFAULT 'New',
ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium',
ADD COLUMN IF NOT EXISTS estimated_cost DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS department VARCHAR(100),
ADD COLUMN IF NOT EXISTS created_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS changed_by VARCHAR(20),
ADD COLUMN IF NOT EXISTS changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS int_status INTEGER DEFAULT 1;

-- Add foreign key constraints
ALTER TABLE "tblPrintSerialNoQueue" 
ADD CONSTRAINT fk_psnq_asset_id 
FOREIGN KEY (asset_id) REFERENCES "tblAssets"(asset_id) ON DELETE CASCADE;

ALTER TABLE "tblPrintSerialNoQueue" 
ADD CONSTRAINT fk_psnq_asset_type_id 
FOREIGN KEY (asset_type_id) REFERENCES "tblAssetTypes"(asset_type_id) ON DELETE CASCADE;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_psnq_asset_id ON "tblPrintSerialNoQueue"(asset_id);
CREATE INDEX IF NOT EXISTS idx_psnq_asset_type_id ON "tblPrintSerialNoQueue"(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_psnq_status ON "tblPrintSerialNoQueue"(status);
CREATE INDEX IF NOT EXISTS idx_psnq_org_id ON "tblPrintSerialNoQueue"(org_id);

-- Add comments
COMMENT ON TABLE "tblPrintSerialNoQueue" IS 'Enhanced print queue for asset serial number labels with asset integration';
COMMENT ON COLUMN "tblPrintSerialNoQueue".asset_id IS 'Reference to the asset that needs label printing';
COMMENT ON COLUMN "tblPrintSerialNoQueue".asset_type_id IS 'Reference to the asset type for template selection';
COMMENT ON COLUMN "tblPrintSerialNoQueue".asset_name IS 'Name of the asset for display purposes';
COMMENT ON COLUMN "tblPrintSerialNoQueue".asset_location IS 'Current location of the asset';
COMMENT ON COLUMN "tblPrintSerialNoQueue".reason IS 'Reason for printing (New, Replacement, etc.)';
COMMENT ON COLUMN "tblPrintSerialNoQueue".priority IS 'Print priority (Low, Medium, High, Critical)';
COMMENT ON COLUMN "tblPrintSerialNoQueue".estimated_cost IS 'Estimated cost of the asset';
COMMENT ON COLUMN "tblPrintSerialNoQueue".department IS 'Department responsible for the asset';
COMMENT ON COLUMN "tblPrintSerialNoQueue".int_status IS 'Internal status (1=Active, 0=Inactive)';
