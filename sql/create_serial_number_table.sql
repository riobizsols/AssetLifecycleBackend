-- Create table for tracking serial numbers
CREATE TABLE IF NOT EXISTS tblAssetSerialNumbers (
    id SERIAL PRIMARY KEY,
    asset_type_id VARCHAR(50) NOT NULL,
    year VARCHAR(2) NOT NULL,
    month VARCHAR(2) NOT NULL,
    current_sequence INTEGER DEFAULT 0,
    last_used_serial VARCHAR(20),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    org_id VARCHAR(50),
    UNIQUE(asset_type_id, year, month, org_id)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_asset_serial_numbers_lookup 
ON tblAssetSerialNumbers(asset_type_id, year, month, org_id);

-- Insert some sample data for testing
INSERT INTO tblAssetSerialNumbers (asset_type_id, year, month, current_sequence, last_used_serial, org_id) 
VALUES 
('01', '25', '07', 300, '01250700300', 'ORG001'),
('02', '25', '07', 150, '02250700150', 'ORG001'),
('03', '25', '07', 75, '03250700075', 'ORG001')
ON CONFLICT (asset_type_id, year, month, org_id) DO NOTHING; 