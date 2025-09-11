-- Migration: Create tblPrinters table for printer management
-- This table stores printer information for label printing

CREATE TABLE IF NOT EXISTS "tblPrinters" (
    printer_id VARCHAR(20) PRIMARY KEY,
    org_id VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    ip_address VARCHAR(15),
    status VARCHAR(20) DEFAULT 'Online',
    printer_type VARCHAR(50) NOT NULL, -- Laser, Inkjet, Label, Industrial, Multifunction
    paper_size VARCHAR(20), -- A4, A3, A2, 4x6, 3x2, etc.
    paper_type VARCHAR(50), -- Paper, Vinyl, Metal
    paper_quality VARCHAR(20), -- Normal, High
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by VARCHAR(20),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(20),
    changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    int_status INTEGER DEFAULT 1
);

-- Add comments
COMMENT ON TABLE "tblPrinters" IS 'Printer configuration for label printing';
COMMENT ON COLUMN "tblPrinters".printer_type IS 'Type of printer: Laser, Inkjet, Label, Industrial, Multifunction';
COMMENT ON COLUMN "tblPrinters".paper_size IS 'Supported paper size: A4, A3, A2, 4x6, 3x2, etc.';
COMMENT ON COLUMN "tblPrinters".paper_type IS 'Type of paper supported: Paper, Vinyl, Metal';
COMMENT ON COLUMN "tblPrinters".status IS 'Printer status: Online, Offline, Maintenance';

-- Insert sample printers
INSERT INTO "tblPrinters" (printer_id, org_id, name, location, ip_address, status, printer_type, paper_size, paper_type, paper_quality, description, created_by) VALUES
('PRT001', 'ORG001', 'Main Office Laser Printer', 'Main Office - Floor 1', '192.168.1.100', 'Online', 'Laser', 'A4', 'Paper', 'High', 'High-quality laser printer for standard labels', 'admin'),
('PRT002', 'ORG001', 'Warehouse Label Printer', 'Warehouse A - Storage', '192.168.1.101', 'Online', 'Label', '4x6', 'Vinyl', 'High', 'Industrial label printer for vinyl labels', 'admin'),
('PRT003', 'ORG001', 'Production Floor Printer', 'Production Floor - Line 1', '192.168.1.102', 'Offline', 'Industrial', 'A3', 'Metal', 'High', 'Heavy-duty industrial printer for metal labels', 'admin'),
('PRT004', 'ORG001', 'Admin Office Printer', 'Admin Office - HR', '192.168.1.103', 'Online', 'Multifunction', 'A4', 'Paper', 'Normal', 'Multifunction printer for various document types', 'admin'),
('PRT005', 'ORG001', 'IT Department Printer', 'Admin Office - IT', '192.168.1.104', 'Online', 'Laser', 'A4', 'Paper', 'High', 'IT department laser printer', 'admin'),
('PRT006', 'ORG001', 'Conference Room Printer', 'Conference Room A', '192.168.1.105', 'Online', 'Inkjet', 'A4', 'Paper', 'Normal', 'Conference room inkjet printer', 'admin'),
('PRT007', 'ORG001', 'Lab Printer', 'Lab - Testing', '192.168.1.106', 'Online', 'Laser', 'A4', 'Paper', 'High', 'Laboratory testing printer', 'admin'),
('PRT008', 'ORG001', 'Security Office Printer', 'Security Office', '192.168.1.107', 'Maintenance', 'Laser', 'A4', 'Paper', 'Normal', 'Security office printer', 'admin'),
('PRT009', 'ORG001', 'Warehouse B Printer', 'Warehouse B - Receiving', '192.168.1.108', 'Online', 'Label', '3x2', 'Paper', 'Normal', 'Warehouse B label printer', 'admin'),
('PRT010', 'ORG001', 'Production Line 2 Printer', 'Production Floor - Line 2', '192.168.1.109', 'Online', 'Industrial', 'A2', 'Metal', 'High', 'Production line 2 industrial printer', 'admin');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tblPrinters_org_id ON "tblPrinters"(org_id);
CREATE INDEX IF NOT EXISTS idx_tblPrinters_printer_type ON "tblPrinters"(printer_type);
CREATE INDEX IF NOT EXISTS idx_tblPrinters_status ON "tblPrinters"(status);
CREATE INDEX IF NOT EXISTS idx_tblPrinters_is_active ON "tblPrinters"(is_active);
