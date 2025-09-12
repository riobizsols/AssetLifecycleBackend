-- Create tblApps table
CREATE TABLE IF NOT EXISTS "tblApps" (
    app_id VARCHAR PRIMARY KEY,
    app_name VARCHAR NOT NULL,
    description TEXT,
    created_by VARCHAR NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    int_status INTEGER DEFAULT 1
);

-- Create tblEvents table
CREATE TABLE IF NOT EXISTS "tblEvents" (
    event_id VARCHAR PRIMARY KEY,
    event_name VARCHAR NOT NULL,
    text VARCHAR NOT NULL,
    description TEXT,
    created_by VARCHAR NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    int_status INTEGER DEFAULT 1
);

-- Create tblAuditLogConfig table
CREATE TABLE IF NOT EXISTS "tblAuditLogConfig" (
    config_id VARCHAR PRIMARY KEY,
    app_id VARCHAR NOT NULL,
    event_id VARCHAR NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_by VARCHAR NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    int_status INTEGER DEFAULT 1,
    FOREIGN KEY (app_id) REFERENCES "tblApps"(app_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES "tblEvents"(event_id) ON DELETE CASCADE,
    UNIQUE(app_id, event_id)
);

-- Insert sample apps data
INSERT INTO "tblApps" (app_id, app_name, description, created_by) VALUES
('DASHBOARD', 'Dashboard', 'Main dashboard application', 'SYSTEM'),
('ASSETS', 'Assets', 'Asset management application', 'SYSTEM'),
('ASSETASSIGNMENT', 'Asset Assignment', 'Asset assignment management', 'SYSTEM'),
('MAINTENANCE', 'Maintenance', 'Maintenance management application', 'SYSTEM'),
('REPORTS', 'Reports', 'Reports and analytics application', 'SYSTEM'),
('ADMINSETTINGS', 'Admin Settings', 'Administrative settings application', 'SYSTEM'),
('AUDITLOGS', 'Audit Logs', 'Audit logs management application', 'SYSTEM')
ON CONFLICT (app_id) DO NOTHING;

-- Insert sample events data
INSERT INTO "tblEvents" (event_id, event_name, text, description, created_by) VALUES
('EVT001', 'CREATE', 'Create', 'Create new record event', 'SYSTEM'),
('EVT002', 'UPDATE', 'Update', 'Update existing record event', 'SYSTEM'),
('EVT003', 'DELETE', 'Delete', 'Delete record event', 'SYSTEM'),
('EVT004', 'VIEW', 'View', 'View record event', 'SYSTEM'),
('EVT005', 'EXPORT', 'Export', 'Export data event', 'SYSTEM'),
('EVT006', 'IMPORT', 'Import', 'Import data event', 'SYSTEM'),
('EVT007', 'APPROVE', 'Approve', 'Approve record event', 'SYSTEM'),
('EVT008', 'REJECT', 'Reject', 'Reject record event', 'SYSTEM'),
('EVT009', 'ASSIGN', 'Assign', 'Assign asset event', 'SYSTEM'),
('EVT010', 'UNASSIGN', 'Unassign', 'Unassign asset event', 'SYSTEM'),
('EVT011', 'MAINTENANCE', 'Maintenance', 'Maintenance event', 'SYSTEM'),
('EVT012', 'SCRAP', 'Scrap', 'Scrap asset event', 'SYSTEM'),
('EVT013', 'TRANSFER', 'Transfer', 'Transfer asset event', 'SYSTEM'),
('EVT014', 'VALUATION', 'Valuation', 'Asset valuation event', 'SYSTEM'),
('EVT015', 'DEPRECIATION', 'Depreciation', 'Asset depreciation event', 'SYSTEM')
ON CONFLICT (event_id) DO NOTHING;

-- Insert sample audit log configuration data
INSERT INTO "tblAuditLogConfig" (config_id, app_id, event_id, is_enabled, created_by) VALUES
-- Dashboard events
('CFG001', 'DASHBOARD', 'EVT004', TRUE, 'SYSTEM'),
('CFG002', 'DASHBOARD', 'EVT005', TRUE, 'SYSTEM'),

-- Assets events
('CFG003', 'ASSETS', 'EVT001', TRUE, 'SYSTEM'),
('CFG004', 'ASSETS', 'EVT002', TRUE, 'SYSTEM'),
('CFG005', 'ASSETS', 'EVT003', TRUE, 'SYSTEM'),
('CFG006', 'ASSETS', 'EVT004', TRUE, 'SYSTEM'),
('CFG007', 'ASSETS', 'EVT005', TRUE, 'SYSTEM'),
('CFG008', 'ASSETS', 'EVT006', TRUE, 'SYSTEM'),

-- Asset Assignment events
('CFG009', 'ASSETASSIGNMENT', 'EVT009', TRUE, 'SYSTEM'),
('CFG010', 'ASSETASSIGNMENT', 'EVT010', TRUE, 'SYSTEM'),
('CFG011', 'ASSETASSIGNMENT', 'EVT004', TRUE, 'SYSTEM'),

-- Maintenance events
('CFG012', 'MAINTENANCE', 'EVT011', TRUE, 'SYSTEM'),
('CFG013', 'MAINTENANCE', 'EVT001', TRUE, 'SYSTEM'),
('CFG014', 'MAINTENANCE', 'EVT002', TRUE, 'SYSTEM'),
('CFG015', 'MAINTENANCE', 'EVT004', TRUE, 'SYSTEM'),
('CFG016', 'MAINTENANCE', 'EVT007', TRUE, 'SYSTEM'),
('CFG017', 'MAINTENANCE', 'EVT008', TRUE, 'SYSTEM'),

-- Reports events
('CFG018', 'REPORTS', 'EVT004', TRUE, 'SYSTEM'),
('CFG019', 'REPORTS', 'EVT005', TRUE, 'SYSTEM'),

-- Admin Settings events
('CFG020', 'ADMINSETTINGS', 'EVT001', TRUE, 'SYSTEM'),
('CFG021', 'ADMINSETTINGS', 'EVT002', TRUE, 'SYSTEM'),
('CFG022', 'ADMINSETTINGS', 'EVT003', TRUE, 'SYSTEM'),
('CFG023', 'ADMINSETTINGS', 'EVT004', TRUE, 'SYSTEM'),

-- Audit Logs events
('CFG024', 'AUDITLOGS', 'EVT004', TRUE, 'SYSTEM'),
('CFG025', 'AUDITLOGS', 'EVT005', TRUE, 'SYSTEM')
ON CONFLICT (config_id) DO NOTHING;
