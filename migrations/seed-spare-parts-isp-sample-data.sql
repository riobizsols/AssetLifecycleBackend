-- Sample seed: ISP spare-spec tables + spare category / mapping / lot (4 rows each)
-- Safe to re-run: uses fixed primary keys with ON CONFLICT DO NOTHING

BEGIN;

-- 1) Brands
INSERT INTO "tblISPBrand" ("spbId", "brandName", int_status, org_id, branch_id, created_by, changed_by)
VALUES
  ('SPB001', 'Lenovo', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPB002', 'Dell', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPB003', 'HP', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPB004', 'Samsung', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT ("spbId") DO NOTHING;

-- 2) Models
INSERT INTO "tblISPModel" ("spbmId", "spbId", "modelName", int_status, org_id, branch_id, created_by, changed_by)
VALUES
  ('SPBM001', 'SPB001', 'ThinkPad T480', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBM002', 'SPB002', 'Latitude 7440', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBM003', 'SPB003', 'EliteBook 845', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBM004', 'SPB004', 'Galaxy Tab S9', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT ("spbmId") DO NOTHING;

-- 3) Spare part categories (4 rows) with default model link
INSERT INTO "tblSPCategory" (
  spc_id, text, uom, minimum_stock, re_order_level, int_status,
  org_id, branch_id, created_by, changed_by, spbm_id
)
VALUES
  ('SPC008', 'Keyboard', 'piece', 2, 5, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'SPBM001'),
  ('SPC009', 'Mouse', 'piece', 2, 8, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'SPBM002'),
  ('SPC010', 'Laptop Battery', 'piece', 1, 3, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'SPBM003'),
  ('SPC011', 'Display Panel', 'piece', 1, 2, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'SPBM004')
ON CONFLICT (spc_id) DO NOTHING;

-- 4) Model ↔ category map
INSERT INTO "tblISPModCat" ("spbmcId", "spbmId", "spcId", int_status, org_id, branch_id, created_by, changed_by)
VALUES
  ('SPBMC001', 'SPBM001', 'SPC008', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBMC002', 'SPBM002', 'SPC009', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBMC003', 'SPBM003', 'SPC010', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPBMC004', 'SPBM004', 'SPC011', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT ("spbmcId") DO NOTHING;

-- 5) Property details per model
INSERT INTO "tblISPPropDet" ("sppdId", "spbmId", "propId", "propName", int_status, org_id, branch_id, created_by, changed_by)
VALUES
  ('SPPD001', 'SPBM001', 'PROP001', 'Layout', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPD002', 'SPBM002', 'PROP002', 'Connector', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPD003', 'SPBM003', 'PROP003', 'Voltage', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPD004', 'SPBM004', 'PROP004', 'Screen Size', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT ("sppdId") DO NOTHING;

-- 6) Part number specs
INSERT INTO "tblISPPartNumberSpec" (
  sppns_id, sppart_ext_id, sppd_id, aplv_id, int_status, org_id, branch_id, created_by, changed_by
)
VALUES
  ('SPPNS001', 'KB-LNV-T480-US', 'SPPD001', 'US-ANSI', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPNS002', 'MS-DEL-7440', 'SPPD002', 'USB-A', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPNS003', 'BAT-HP-845-6C', 'SPPD003', '11.55V', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPPNS004', 'DSP-SAM-S9-11', 'SPPD004', '11 inch', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT (sppns_id) DO NOTHING;

-- 7) Vendor part number map (uses existing vendors)
INSERT INTO "tblISPPNVPNMap" (
  "spvpnId", sppns_id, "vendorPartNumber", "vendorId", int_status, org_id, branch_id, created_by, changed_by
)
VALUES
  ('SPVPN001', 'SPPNS001', 'V-KB-001', 'V001', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPVPN002', 'SPPNS002', 'V-MS-002', 'V007', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPVPN003', 'SPPNS003', 'V-BAT-003', 'V015', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPVPN004', 'SPPNS004', 'V-DSP-004', 'V021', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT ("spvpnId") DO NOTHING;

-- 8) Category ↔ asset type map (new columns spbm_id, prod_serv_id)
INSERT INTO "tblSPCatATMap" (
  spcatm_id, spc_id, asset_type_id, spbm_id, prod_serv_id, int_status,
  org_id, branch_id, created_by, changed_by
)
VALUES
  ('SPCATM009', 'SPC008', 'AT005', 'SPBM001', 'PS001', 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPCATM010', 'SPC009', 'AT005', 'SPBM002', NULL, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPCATM011', 'SPC010', 'AT053', 'SPBM003', NULL, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM'),
  ('SPCATM012', 'SPC011', 'AT030', 'SPBM004', NULL, 1, 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM')
ON CONFLICT (spcatm_id) DO NOTHING;

-- 9) Lot details (new columns part_number, vendor_id, brand_id, model_id)
INSERT INTO "tblSPLotDet" (
  spld_id, spc_id, unit_price, lot_purchase_date, invoice_no, invoice_item_no,
  quantity, remarks, org_id, branch_id, created_by, changed_by,
  part_number, vendor_id, brand_id, model_id
)
VALUES
  ('SPLD008', 'SPC008', 45.00, '2026-08-10', 'INV-SP-1001', '1', 10, 'Keyboard lot', 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'KB-LNV-T480-US', 'V001', 'SPB001', 'SPBM001'),
  ('SPLD009', 'SPC009', 18.50, '2026-08-11', 'INV-SP-1002', '1', 25, 'Mouse lot', 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'MS-DEL-7440', 'V007', 'SPB002', 'SPBM002'),
  ('SPLD010', 'SPC010', 62.00, '2026-08-12', 'INV-SP-1003', '1', 6, 'Battery lot', 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'BAT-HP-845-6C', 'V015', 'SPB003', 'SPBM003'),
  ('SPLD011', 'SPC011', 120.00, '2026-08-13', 'INV-SP-1004', '1', 4, 'Display lot', 'ORG001', 'BR002', 'SYSTEM', 'SYSTEM', 'DSP-SAM-S9-11', 'V021', 'SPB004', 'SPBM004')
ON CONFLICT (spld_id) DO NOTHING;

COMMIT;
