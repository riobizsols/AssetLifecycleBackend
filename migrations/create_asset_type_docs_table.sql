-- Create tblATDocs table for Asset Type Documents
-- This table stores document metadata for documents related to Asset Types

CREATE TABLE IF NOT EXISTS "tblATDocs" (
    atd_id VARCHAR(50) PRIMARY KEY,
    asset_type_id VARCHAR(50) NOT NULL,
    doc_type VARCHAR(100),
    doc_type_name VARCHAR(255),
    doc_path TEXT NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_path TEXT,
    org_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tblatdocs_asset_type_id ON "tblATDocs"(asset_type_id);
CREATE INDEX IF NOT EXISTS idx_tblatdocs_org_id ON "tblATDocs"(org_id);
CREATE INDEX IF NOT EXISTS idx_tblatdocs_doc_type ON "tblATDocs"(doc_type);
CREATE INDEX IF NOT EXISTS idx_tblatdocs_is_archived ON "tblATDocs"(is_archived);

-- Add foreign key constraint to ensure asset_type_id exists in tblAssetTypes
ALTER TABLE "tblATDocs" 
ADD CONSTRAINT fk_tblatdocs_asset_type_id 
FOREIGN KEY (asset_type_id) REFERENCES "tblAssetTypes"(asset_type_id) 
ON DELETE CASCADE;

-- Add foreign key constraint to ensure org_id exists in tblOrganizations (if table exists)
-- Uncomment the following lines if tblOrganizations table exists
-- ALTER TABLE "tblATDocs" 
-- ADD CONSTRAINT fk_tblatdocs_org_id 
-- FOREIGN KEY (org_id) REFERENCES "tblOrganizations"(org_id) 
-- ON DELETE CASCADE;

-- Add comments to table and columns
COMMENT ON TABLE "tblATDocs" IS 'Stores document metadata for documents related to Asset Types';
COMMENT ON COLUMN "tblATDocs".atd_id IS 'Unique document identifier (format: ATD + timestamp + random)';
COMMENT ON COLUMN "tblATDocs".asset_type_id IS 'Reference to the asset type in tblAssetTypes';
COMMENT ON COLUMN "tblATDocs".doc_type IS 'Type of document (e.g., manual, warranty, invoice)';
COMMENT ON COLUMN "tblATDocs".doc_type_name IS 'Human-readable name for document type';
COMMENT ON COLUMN "tblATDocs".doc_path IS 'Full path to the document in MinIO storage';
COMMENT ON COLUMN "tblATDocs".is_archived IS 'Whether the document is archived';
COMMENT ON COLUMN "tblATDocs".archived_path IS 'Path where archived document is stored';
COMMENT ON COLUMN "tblATDocs".org_id IS 'Organization identifier';
COMMENT ON COLUMN "tblATDocs".created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN "tblATDocs".updated_at IS 'Timestamp when the record was last updated';

-- Create trigger to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tblatdocs_updated_at 
    BEFORE UPDATE ON "tblATDocs" 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
