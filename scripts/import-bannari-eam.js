#!/usr/bin/env node

/**
 * Import the Bannari EAM hierarchy and generated asset-domain data.
 *
 * This script is intentionally self-contained so the import can be repeated
 * from the same workbook. It refuses to run against any database other than
 * bannari_db and writes a logical JSON backup before the reset transaction.
 */

require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const XLSX = require('xlsx');
const { Client } = require('pg');

const TARGET_DATABASE = 'bannari_db';
const WORKBOOK_PATH =
  process.argv.find((arg) => arg.startsWith('--workbook='))
    ?.slice('--workbook='.length) ||
  process.env.BANNARI_EAM_WORKBOOK ||
  'F:\\Bannari_Amman_EAM_Structure_Updated.xlsx';

const SYSTEM_USER = 'SYSTEM';
const TODAY = new Date();

const DOMAIN_TABLES = [
  'tblAssetGroup_D',
  'tblAssetGroup_H',
  'tblVendorProdService',
  'tblAssets',
  'tblProdServs',
  'tblVendors',
  'tblAssetTypes',
  'tblBR_DEPT',
  'tblDepartments',
  'tblBranches',
  'tblOrgs',
];

// These tables contain data tied to the reset domain. The runtime FK graph
// determines the child-first delete order, so this list can safely include
// tables that are empty or absent in a particular schema revision.
const OPERATIONAL_TABLES = [
  'tblAATInspCheckList',
  'tblAAT_Insp_Freq',
  'tblAAT_Insp_Rec',
  'tblAAT_Insp_Sch',
  'tblATBRReasonCodes',
  'tblATDocs',
  'tblATInspCert',
  'tblATInspCerts',
  'tblATMaintCert',
  'tblATMaintCheckList',
  'tblATMaintFreq',
  'tblAssetAssignments',
  'tblAssetBRDet',
  'tblAssetDepHist',
  'tblAssetDocs',
  'tblAssetExpiryNotify',
  'tblAssetGroupDocs',
  'tblAssetMaintDocs',
  'tblAssetMaintSch',
  'tblAssetPropListValues',
  'tblAssetPropValues',
  'tblAssetScrap',
  'tblAssetScrapDet',
  'tblAssetTypeProps',
  'tblAssetUsageReg',
  'tblAssetWarrantyNotify',
  'tblApps',
  'tblAuditLogConfig',
  'tblAuditLogs',
  'tblBranchCostCenter',
  'tblCCTransfer',
  'tblColumnAccessConfig',
  'tblDeptAdmins',
  'tblDeptAssetTypes',
  'tblEmpTechCert',
  'tblEmployees',
  'tblInspCheckList',
  'tblInspResTypeDet',
  'tblJobRoleNav',
  'tblJobRoles',
  'tblOrgSettings',
  'tblPrintSerialNoQueue',
  'tblScrapAssetHist',
  'tblScrapSales_D',
  'tblScrapSalesDocs',
  'tblScrapSales_H',
  'tblVendorDocs',
  'tblVendorRenewal',
  'tblVendorSLAs',
  'tblWFAATInspHist',
  'tblWFAATInspSch_D',
  'tblWFAATInspSch_H',
  'tblWFATInspSeqs',
  'tblWFATSeqs',
  'tblWFAssetMaintHist',
  'tblWFAssetMaintSch_D',
  'tblWFAssetMaintSch_H',
  'tblWFInspJobRole',
  'tblWFInspSteps',
  'tblWFJobRole',
  'tblWFScrapSeq',
  'tblWFScrap_D',
  'tblWFSteps',
  'tblWFScrap_H',
  'tblUserJobRoles',
];

// Keep authentication and audit/configuration data. Authentication rows are
// handled specially because their org_id is NOT NULL and cannot be SET NULL
// when the old organizations are removed.
const PRESERVED_TABLES = [
  'tblProps',
  'tblUom',
  'tblStatusCodes',
  'tblTextMessagesDefault',
  'tblTextMessagesOtherLangs',
  'tblACM',
];

const PROFILE_SPECS = {
  education: {
    label: 'Education Technology',
    assets: [
      'Laboratory Workstation',
      'Network Switch',
      'Multimedia Projector',
      'Laser Printer',
      'UPS System',
      'Smart Display',
      'CCTV Camera',
    ],
  },
  sugar: {
    label: 'Sugar Process Equipment',
    assets: [
      'Cane Feeder',
      'Mill Drive Motor',
      'Steam Boiler',
      'Juice Clarifier',
      'Evaporator Pump',
      'Sugar Centrifuge',
      'Process Control Panel',
    ],
  },
  distillery: {
    label: 'Distillery Process Equipment',
    assets: [
      'Fermentation Tank',
      'Distillation Column',
      'Alcohol Storage Tank',
      'Ethanol Transfer Pump',
      'Boiler Feed Pump',
      'Process Analyzer',
      'Safety Interlock Panel',
    ],
  },
  granite: {
    label: 'Granite Processing Equipment',
    assets: [
      'Wire Saw Machine',
      'Block Cutter',
      'Slab Polisher',
      'Bridge Crane',
      'Air Compressor',
      'Dust Collector',
      'Forklift',
    ],
  },
  logistics: {
    label: 'Export Logistics Equipment',
    assets: [
      'Warehouse Barcode Scanner',
      'Pallet Forklift',
      'Shipping Label Printer',
      'Office Workstation',
      'Network Router',
      'Industrial Weighing Scale',
      'CCTV Camera',
    ],
  },
  quality: {
    label: 'Quality Laboratory Equipment',
    assets: [
      'Laboratory Spectrometer',
      'Digital pH Meter',
      'Moisture Analyzer',
      'Precision Balance',
      'Sample Refrigerator',
      'Laboratory Workstation',
      'Calibration Kit',
    ],
  },
  maintenance: {
    label: 'Industrial Maintenance Equipment',
    assets: [
      'Maintenance Workstation',
      'Welding Machine',
      'Air Compressor',
      'Hydraulic Jack',
      'Portable Generator',
      'Vibration Meter',
      'Tool Cabinet',
    ],
  },
  safety: {
    label: 'Safety and EHS Equipment',
    assets: [
      'Fire Alarm Panel',
      'Gas Detector',
      'Emergency Shower',
      'PPE Locker',
      'Safety Camera',
      'Environmental Meter',
      'First Aid Cabinet',
    ],
  },
  office: {
    label: 'Office Administration Equipment',
    assets: [
      'Desktop Workstation',
      'Multifunction Printer',
      'Document Scanner',
      'Network Switch',
      'UPS System',
      'Video Conference Unit',
      'Access Control Panel',
    ],
  },
  general: {
    label: 'General Facility Equipment',
    assets: [
      'Workstation',
      'Laser Printer',
      'UPS System',
      'Network Switch',
      'Barcode Scanner',
      'CCTV Camera',
      'Backup Power Unit',
    ],
  },
};

const PRODUCT_CATALOG = {
  'Laboratory Workstation': { brand: 'Lenovo', model: 'ThinkCentre M70q Gen 3' },
  'Network Switch': { brand: 'Cisco', model: 'CBS250-24T-4G' },
  'Multimedia Projector': { brand: 'Epson', model: 'EB-X49' },
  'Laser Printer': { brand: 'HP', model: 'LaserJet Pro M404dn' },
  'UPS System': { brand: 'APC', model: 'Smart-UPS SMT1000IC' },
  'Smart Display': { brand: 'BenQ', model: 'Board RE8604' },
  'CCTV Camera': { brand: 'Hikvision', model: 'DS-2CD2143G2-I' },
  'Cane Feeder': { brand: 'Fives Cail', model: 'CFC-1200' },
  'Mill Drive Motor': { brand: 'Siemens', model: '1LE1 355-4AA' },
  'Steam Boiler': { brand: 'Thermax', model: 'Revomax 10 TPH' },
  'Juice Clarifier': { brand: 'Fives Cail', model: 'RapiPol' },
  'Evaporator Pump': { brand: 'KSB', model: 'Etanorm 100-080-200' },
  'Sugar Centrifuge': { brand: 'BMA', model: 'K3300' },
  'Process Control Panel': { brand: 'Siemens', model: 'S7-1500' },
  'Fermentation Tank': { brand: 'GEA', model: 'VARITANK 50 m3' },
  'Distillation Column': { brand: 'Alfa Laval', model: 'PlatePak 300' },
  'Alcohol Storage Tank': { brand: 'CIMC', model: '100 m3 SS' },
  'Ethanol Transfer Pump': { brand: 'Grundfos', model: 'CR 32-4' },
  'Boiler Feed Pump': { brand: 'Sulzer', model: 'AHLSTAR APT' },
  'Process Analyzer': { brand: 'Anton Paar', model: 'Alcolyzer 3001' },
  'Safety Interlock Panel': { brand: 'Siemens', model: 'S7-1200' },
  'Wire Saw Machine': { brand: 'Breton', model: 'Wiresaw 800' },
  'Block Cutter': { brand: 'Pedrini', model: 'MTS 2000' },
  'Slab Polisher': { brand: 'Breton', model: 'Kappa 1500' },
  'Bridge Crane': { brand: 'Demag', model: 'DC-Com 5' },
  'Air Compressor': { brand: 'Atlas Copco', model: 'GA 30' },
  'Dust Collector': { brand: 'Donaldson Torit', model: 'DFO 3-6' },
  Forklift: { brand: 'Toyota', model: '8FG25' },
  'Warehouse Barcode Scanner': { brand: 'Zebra', model: 'DS3678' },
  'Pallet Forklift': { brand: 'Toyota', model: '8FG25' },
  'Shipping Label Printer': { brand: 'Zebra', model: 'ZT411' },
  'Office Workstation': { brand: 'Dell', model: 'OptiPlex 7010' },
  'Network Router': { brand: 'Cisco', model: 'ISR 4331' },
  'Industrial Weighing Scale': { brand: 'Avery Weigh-Tronix', model: 'ZM303' },
  'Laboratory Spectrometer': { brand: 'Thermo Scientific', model: 'GENESYS 180' },
  'Digital pH Meter': { brand: 'Mettler Toledo', model: 'SevenCompact S220' },
  'Moisture Analyzer': { brand: 'Sartorius', model: 'MA160' },
  'Precision Balance': { brand: 'Mettler Toledo', model: 'XPR205' },
  'Sample Refrigerator': { brand: 'Thermo Scientific', model: 'TSX Series' },
  'Calibration Kit': { brand: 'Fluke', model: '724' },
  'Maintenance Workstation': { brand: 'Dell', model: 'OptiPlex 7010' },
  'Welding Machine': { brand: 'Lincoln Electric', model: 'Power MIG 210 MP' },
  'Hydraulic Jack': { brand: 'Enerpac', model: 'RC-106' },
  'Portable Generator': { brand: 'Cummins', model: 'C20D5' },
  'Vibration Meter': { brand: 'Fluke', model: '805 FC' },
  'Tool Cabinet': { brand: 'Stanley', model: 'STST97595' },
  'Fire Alarm Panel': { brand: 'Honeywell NOTIFIER', model: 'NFS2-3030' },
  'Gas Detector': { brand: 'Dräger', model: 'X-am 2500' },
  'Emergency Shower': { brand: 'Haws', model: '8135' },
  'PPE Locker': { brand: 'Lista', model: '291-16' },
  'Safety Camera': { brand: 'Hikvision', model: 'DS-2CD2143G2-I' },
  'Environmental Meter': { brand: 'TSI', model: 'VelociCalc 9545' },
  'First Aid Cabinet': { brand: 'Cederroth', model: '2914' },
  'Desktop Workstation': { brand: 'Dell', model: 'OptiPlex 7010' },
  'Multifunction Printer': { brand: 'HP', model: 'LaserJet Pro MFP 4301fd' },
  'Document Scanner': { brand: 'Fujitsu', model: 'fi-8170' },
  'Video Conference Unit': { brand: 'Logitech', model: 'Rally Bar Mini' },
  'Access Control Panel': { brand: 'HID', model: 'VertX V1000' },
  Workstation: { brand: 'Dell', model: 'OptiPlex 7010' },
  'Barcode Scanner': { brand: 'Zebra', model: 'DS3678' },
  'Backup Power Unit': { brand: 'Cummins', model: 'C20D5' },
};

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function trimText(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function key(...values) {
  return values.map(normalize).join('|');
}

function cityFromPlace(place) {
  const parts = String(place ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return trimText(parts.at(-1) || 'India', 50);
}

function companyCode(company) {
  const normalized = normalize(company);
  if (normalized.includes('educational')) return 'BAET';
  if (normalized.includes('sugars')) return 'BASL';
  if (normalized.includes('distillery')) return 'BADO';
  if (normalized.includes('exports')) return 'BAEPL';
  if (normalized.includes('granite')) return 'BAGO';
  return `BAN${String(company).replace(/[^A-Za-z]/g, '').slice(0, 5).toUpperCase()}`;
}

function profileFor(company, branch, department) {
  const text = `${normalize(company)} ${normalize(branch)} ${normalize(department)}`;
  if (normalize(company).includes('educational')) return 'education';
  if (text.includes('quality') || text.includes('laboratory')) return 'quality';
  if (text.includes('safety') || text.includes('ehs') || text.includes('environmental')) {
    return 'safety';
  }
  if (
    text.includes('maintenance') ||
    text.includes('engineering') ||
    text.includes('utilities') ||
    text.includes('equipment')
  ) {
    return 'maintenance';
  }
  if (text.includes('sugar') || text.includes('cane') || text.includes('mill')) {
    return 'sugar';
  }
  if (
    text.includes('distillery') ||
    text.includes('alcohol') ||
    text.includes('ethanol') ||
    text.includes('incineration') ||
    text.includes('fermentation')
  ) {
    return 'distillery';
  }
  if (
    text.includes('granite') ||
    text.includes('quarry') ||
    text.includes('slab') ||
    text.includes('tile')
  ) {
    return 'granite';
  }
  if (
    text.includes('export') ||
    text.includes('logistics') ||
    text.includes('shipment') ||
    text.includes('warehouse') ||
    text.includes('freight') ||
    text.includes('customs') ||
    text.includes('commodity') ||
    text.includes('trade')
  ) {
    return 'logistics';
  }
  if (
    text.includes('finance') ||
    text.includes('administration') ||
    text.includes('documentation') ||
    text.includes('sales') ||
    text.includes('customer service')
  ) {
    return 'office';
  }
  return 'general';
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const worksheet = workbook.Sheets['EAM Structure'];
  if (!worksheet) throw new Error('Workbook is missing the EAM Structure sheet');

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
  });
  const headerIndex = rows.findIndex((row) => row[0] === 'Company / Entity');
  if (headerIndex < 0) throw new Error('EAM Structure header row was not found');

  const hierarchy = rows
    .slice(headerIndex + 1)
    .filter((row) => row[0] && row[1] && row[2])
    .map((row) => ({
      company: trimText(row[0], 50),
      branch: trimText(row[1], 100),
      department: trimText(row[2], 50),
      place: trimText(row[3], 100),
      state: trimText(row[4] || 'Tamil Nadu', 50),
    }));

  if (hierarchy.length !== 46) {
    throw new Error(`Expected 46 hierarchy rows, found ${hierarchy.length}`);
  }
  if (new Set(hierarchy.map((row) => row.company)).size !== 5) {
    throw new Error('Expected exactly 5 company/entity names');
  }
  if (new Set(hierarchy.map((row) => row.branch)).size !== 15) {
    throw new Error('Expected exactly 15 branch/institution names');
  }

  return hierarchy;
}

async function getExistingTables(client, requested) {
  const result = await client.query(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_name = any($1)`,
    [requested],
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function getColumns(client, tableName) {
  const result = await client.query(
    `select column_name
       from information_schema.columns
      where table_schema = 'public'
        and table_name = $1
      order by ordinal_position`,
    [tableName],
  );
  return result.rows.map((row) => row.column_name);
}

async function insertRows(client, tableName, columns, rows) {
  if (!rows.length) return;
  const values = [];
  const placeholders = rows.map((row, rowIndex) => {
    const rowPlaceholders = columns.map((column, columnIndex) => {
      values.push(row[column] ?? null);
      return `$${rowIndex * columns.length + columnIndex + 1}`;
    });
    return `(${rowPlaceholders.join(', ')})`;
  });
  await client.query(
    `insert into ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')})
     values ${placeholders.join(', ')}`,
    values,
  );
}

async function writeLogicalBackup(client, tables) {
  const snapshot = {
    metadata: {
      database: TARGET_DATABASE,
      created_at: new Date().toISOString(),
      source_workbook: WORKBOOK_PATH,
      backup_type: 'logical-json-fallback',
    },
    tables: {},
  };

  for (const table of tables) {
    const exists = await getExistingTables(client, [table]);
    if (!exists.has(table)) continue;
    const result = await client.query(`select * from ${quoteIdentifier(table)}`);
    snapshot.tables[table] = result.rows;
  }

  const backupDirectory = path.join(__dirname, '..', 'backups', 'bannari-eam');
  await fs.mkdir(backupDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `bannari_db_${stamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify(snapshot, null, 2), 'utf8');
  return backupPath;
}

async function getForeignKeys(client) {
  const result = await client.query(`
    select
      child.relname as child_table,
      parent.relname as parent_table,
      case constraint_row.confdeltype
        when 'a' then 'NO ACTION'
        when 'r' then 'RESTRICT'
        when 'c' then 'CASCADE'
        when 'n' then 'SET NULL'
        when 'd' then 'SET DEFAULT'
      end as delete_rule
    from pg_constraint constraint_row
    join pg_class child on child.oid = constraint_row.conrelid
    join pg_namespace child_schema on child_schema.oid = child.relnamespace
    join pg_class parent on parent.oid = constraint_row.confrelid
    where constraint_row.contype = 'f'
      and child_schema.nspname = 'public'
  `);
  return result.rows;
}

function childFirstDeleteOrder(tables, foreignKeys) {
  const remaining = new Set(tables);
  const order = [];

  while (remaining.size) {
    const ready = [...remaining].filter(
      (table) =>
        !foreignKeys.some(
          (fk) =>
            fk.parent_table === table &&
            fk.child_table !== table &&
            remaining.has(fk.child_table),
        ),
    );

    if (!ready.length) {
      // The schema contains self/cyclic constraints with SET NULL semantics.
      // Pick a stable table; PostgreSQL will enforce the actual rule.
      ready.push([...remaining].sort()[0]);
    }
    for (const table of ready.sort()) {
      order.push(table);
      remaining.delete(table);
    }
  }
  return order;
}

function buildGeneratedData(hierarchy) {
  const companies = [...new Map(hierarchy.map((row) => [row.company, row])).values()];
  const branches = [
    ...new Map(hierarchy.map((row) => [key(row.company, row.branch), row])).values(),
  ];
  const departments = hierarchy.map((row) => ({ ...row }));

  const orgIdByCompany = new Map(
    companies.map((row, index) => [row.company, `BAN${String(index + 1).padStart(3, '0')}`]),
  );
  const branchIdByKey = new Map(
    branches.map((row, index) => [
      key(row.company, row.branch),
      `BNB${String(index + 1).padStart(3, '0')}`,
    ]),
  );
  const departmentIdByKey = new Map(
    departments.map((row, index) => [
      key(row.company, row.branch, row.department),
      `BND${String(index + 1).padStart(4, '0')}`,
    ]),
  );

  const orgRows = companies.map((row) => ({
    org_id: orgIdByCompany.get(row.company),
    text: row.company,
    valid_from: TODAY,
    valid_to: null,
    int_status: 1,
    org_code: companyCode(row.company),
    org_city: cityFromPlace(row.place),
    gst_number: null,
    cin_number: null,
  }));

  const branchRows = branches.map((row) => ({
    branch_id: branchIdByKey.get(key(row.company, row.branch)),
    org_id: orgIdByCompany.get(row.company),
    int_status: 1,
    text: row.branch,
    city: cityFromPlace(row.place),
    branch_code: `B${String(branchIdByKey.get(key(row.company, row.branch)).slice(-3))}`,
    created_by: SYSTEM_USER,
    created_on: TODAY,
    changed_by: SYSTEM_USER,
    changed_on: TODAY,
  }));

  const departmentRows = departments.map((row) => ({
    org_id: orgIdByCompany.get(row.company),
    dept_id: departmentIdByKey.get(key(row.company, row.branch, row.department)),
    int_status: 1,
    text: row.department,
    parent_id: null,
    created_on: TODAY,
    changed_on: TODAY,
    changed_by: SYSTEM_USER,
    created_by: SYSTEM_USER,
    branch_id: branchIdByKey.get(key(row.company, row.branch)),
  }));

  const branchDepartmentRows = departments.map((row) => ({
    branch_id: branchIdByKey.get(key(row.company, row.branch)),
    dept_id: departmentIdByKey.get(key(row.company, row.branch, row.department)),
    org_id: orgIdByCompany.get(row.company),
    int_status: 1,
    created_by: SYSTEM_USER,
    created_on: TODAY,
    changed_by: SYSTEM_USER,
    changed_on: TODAY,
  }));

  const vendors = [];
  const vendorIdByKey = new Map();
  const assetTypes = [];
  const products = [];
  const vendorProductLinks = [];
  const assets = [];
  const groups = [];
  const groupDetails = [];
  const assignments = [];
  const deptAssetTypes = [];
  const assetTypeIdByOrgName = new Map();
  const deptAssetTypeKeys = new Set();
  let vendorSequence = 1;
  let typeSequence = 1;
  let productSequence = 1;
  let assetSequence = 1;
  let groupSequence = 1;
  let groupDetailSequence = 1;
  let vendorProductSequence = 1;
  let assignmentSequence = 1;
  let deptTypeSequence = 1;

  const getVendor = (row, profile) => {
    const orgId = orgIdByCompany.get(row.company);
    const vendorKey = `${orgId}:${profile}`;
    if (vendorIdByKey.has(vendorKey)) return vendorIdByKey.get(vendorKey);
    const vendorId = `BNV${String(vendorSequence).padStart(6, '0')}`;
    vendorSequence += 1;
    const vendorProfile = PROFILE_SPECS[profile];
    const state = row.state || 'Tamil Nadu';
    const pincode = state.toLowerCase().includes('karnataka') ? '571301' : '638401';
    vendors.push({
      vendor_id: vendorId,
      org_id: orgId,
      branch_code: null,
      vendor_name: trimText(`Bannari EAM ${vendorProfile.label}`, 50),
      int_status: 1,
      company_name: trimText(`Bannari EAM ${vendorProfile.label}`, 50),
      address_line1: `Synthetic supplier record for ${vendorProfile.label}`,
      address_line2: null,
      city: cityFromPlace(row.place),
      state,
      pincode,
      company_email: `vendor${vendorSequence}@example.com`,
      gst_number: null,
      cin_number: null,
      contact_person_name: 'EAM Supply Desk',
      contact_person_email: `contact${vendorSequence}@example.com`,
      contact_person_number: `900000${String(vendorSequence).padStart(4, '0')}`,
      created_by: SYSTEM_USER,
      created_on: TODAY,
      changed_by: SYSTEM_USER,
      changed_on: TODAY,
      contract_start_date: null,
      contract_end_date: null,
    });
    vendorIdByKey.set(vendorKey, vendorId);
    return vendorId;
  };

  for (const row of departments) {
    const orgId = orgIdByCompany.get(row.company);
    const branchId = branchIdByKey.get(key(row.company, row.branch));
    const deptId = departmentIdByKey.get(key(row.company, row.branch, row.department));
    const profile = profileFor(row.company, row.branch, row.department);
    const profileSpec = PROFILE_SPECS[profile];
    const vendorId = getVendor(row, profile);
    const groupId = `BNG${String(groupSequence).padStart(6, '0')}`;
    groupSequence += 1;
    groups.push({
      assetgroup_h_id: groupId,
      org_id: orgId,
      text: trimText(`EAM Group - ${row.department}`, 100),
      created_by: SYSTEM_USER,
      created_on: TODAY,
      changed_by: SYSTEM_USER,
      changed_on: TODAY,
      branch_code: `B${String(branchId.slice(-3))}`,
    });

    profileSpec.assets.forEach((assetName, assetIndex) => {
      const productCatalog = PRODUCT_CATALOG[assetName];
      if (!productCatalog) {
        throw new Error(`Missing manufacturer/model catalog entry for ${assetName}`);
      }
      const displayName = trimText(`${productCatalog.brand} ${productCatalog.model}`, 50);
      const assetTypeDisplayName = trimText(
        `${assetName} - ${productCatalog.brand} ${productCatalog.model}`,
        50,
      );
      const assetTypeKey = key(orgId, assetName);
      let assetTypeId = assetTypeIdByOrgName.get(assetTypeKey);
      let productId;
      if (!assetTypeId) {
        assetTypeId = `BNT${String(typeSequence).padStart(6, '0')}`;
        productId = `BNP${String(productSequence).padStart(6, '0')}`;
        const vendorLinkId = `BNL${String(vendorProductSequence).padStart(6, '0')}`;
        assetTypeIdByOrgName.set(assetTypeKey, assetTypeId);
        typeSequence += 1;
        productSequence += 1;
        vendorProductSequence += 1;

        assetTypes.push({
          org_id: orgId,
          asset_type_id: assetTypeId,
          int_status: 1,
          assignment_type: 'department',
          inspection_required: false,
          group_required: true,
          created_by: SYSTEM_USER,
          created_on: TODAY,
          changed_by: SYSTEM_USER,
          changed_on: TODAY,
          text: trimText(assetName, 50),
          is_child: false,
          parent_asset_type_id: null,
          maint_lead_type: null,
          serial_num_format: 1,
          last_gen_seq_no: assetIndex + 1,
          depreciation_type: 'ND',
        });
        products.push({
          prod_serv_id: productId,
          org_id: orgId,
          asset_type_id: assetTypeId,
          brand: productCatalog.brand,
          model: productCatalog.model,
          status: 'active',
          ps_type: 'product',
          description: `${assetName} supplied by ${productCatalog.brand}, model ${productCatalog.model}`,
        });
        vendorProductLinks.push({
          ven_prod_serv_id: vendorLinkId,
          prod_serv_id: productId,
          vendor_id: vendorId,
          org_id: orgId,
        });
      } else {
        productId = products.find((product) => product.asset_type_id === assetTypeId)?.prod_serv_id;
      }
      const assetId = `BNA${String(assetSequence).padStart(6, '0')}`;
      const assignmentId = `BNS${String(assignmentSequence).padStart(6, '0')}`;
      assetSequence += 1;
      assignmentSequence += 1;
      if (!productId) {
        throw new Error(`Missing product for ${orgId}/${assetName}`);
      }
      const deptAssetTypeKey = key(deptId, assetTypeId);
      if (!deptAssetTypeKeys.has(deptAssetTypeKey)) {
        deptAssetTypeKeys.add(deptAssetTypeKey);
        deptAssetTypes.push({
          dept_asset_type_id: `BND${String(deptTypeSequence).padStart(6, '0')}`,
          dept_id: deptId,
          asset_type_id: assetTypeId,
          int_status: 1,
          created_by: SYSTEM_USER,
          created_on: TODAY,
          changed_by: SYSTEM_USER,
          changed_on: TODAY,
          org_id: orgId,
        });
        deptTypeSequence += 1;
      }
      assets.push({
        asset_type_id: assetTypeId,
        asset_id: assetId,
        text: assetTypeDisplayName,
        serial_number: `SN${String(assetSequence - 1).padStart(8, '0')}`,
        description: displayName,
        branch_id: branchId,
        purchase_vendor_id: vendorId,
        prod_serv_id: productId,
        maintsch_id: null,
        purchased_cost: String(100000 + (assetIndex + 1) * 12500),
        purchased_on: new Date('2025-01-15T00:00:00.000Z'),
        purchased_by: SYSTEM_USER,
        current_status: 'Active',
        warranty_period: new Date('2028-01-15T00:00:00.000Z'),
        parent_asset_id: null,
        group_id: null,
        org_id: orgId,
        created_by: SYSTEM_USER,
        created_on: TODAY,
        changed_by: SYSTEM_USER,
        changed_on: TODAY,
        service_vendor_id: vendorId,
        expiry_date: new Date('2030-01-15T00:00:00.000Z'),
        current_book_value: null,
        salvage_value: null,
        accumulated_depreciation: null,
        useful_life_years: 10,
        last_depreciation_calc_date: null,
        invoice_no: `INV-${String(assetSequence - 1).padStart(6, '0')}`,
        commissioned_date: TODAY,
        depreciation_start_date: TODAY,
        project_code: null,
        grant_code: null,
        insurance_policy_no: null,
        gl_account_code: null,
        cost_center_code: null,
        depreciation_rate: null,
        location: row.place,
        insurer: null,
        insured_value: null,
        insurance_start_date: null,
        insurance_end_date: null,
        comprehensive_insurance: null,
        scrap_notes: null,
        scraped_on: null,
        scraped_by: null,
      });
      groupDetails.push({
        assetgroup_d_id: `BNGD${String(groupDetailSequence).padStart(6, '0')}`,
        assetgroup_h_id: groupId,
        asset_id: assetId,
      });
      groupDetailSequence += 1;
      assignments.push({
        asset_assign_id: assignmentId,
        dept_id: deptId,
        asset_id: assetId,
        org_id: orgId,
        employee_int_id: null,
        action: 'A',
        action_on: TODAY,
        action_by: SYSTEM_USER,
        latest_assignment_flag: true,
      });
    });
  }

  return {
    companies,
    branches,
    departments,
    orgIdByCompany,
    branchIdByKey,
    departmentIdByKey,
    orgRows,
    branchRows,
    departmentRows,
    branchDepartmentRows,
    vendors,
    assetTypes,
    products,
    vendorProductLinks,
    assets,
    groups,
    groupDetails,
    assignments,
    deptAssetTypes,
  };
}

function firstGeneratedContext(data) {
  const firstDepartment = data.departments[0];
  return {
    orgId: data.orgIdByCompany.get(firstDepartment.company),
    branchId: data.branchIdByKey.get(key(firstDepartment.company, firstDepartment.branch)),
    deptId: data.departmentIdByKey.get(
      key(firstDepartment.company, firstDepartment.branch, firstDepartment.department),
    ),
  };
}

function remapPreservedRows(rows, data, oldOrgs, oldBranches, oldDepartments) {
  const context = firstGeneratedContext(data);
  const newOrgByOldOrg = new Map();
  for (const oldOrg of oldOrgs) {
    const match = data.companies.find(
      (company) =>
        companyCode(company.company) === oldOrg.org_code ||
        normalize(oldOrg.text).includes(normalize(company.company).split(' ')[2] || ''),
    );
    newOrgByOldOrg.set(oldOrg.org_id, match ? data.orgIdByCompany.get(match.company) : context.orgId);
  }

  const newBranchByOldBranch = new Map();
  for (const oldBranch of oldBranches) {
    const oldOrgId = newOrgByOldOrg.get(oldBranch.org_id) || context.orgId;
    const matches = data.branches.filter(
      (branch) =>
        data.orgIdByCompany.get(branch.company) === oldOrgId &&
        normalize(branch.branch) === normalize(oldBranch.text),
    );
    newBranchByOldBranch.set(
      oldBranch.branch_id,
      matches.length ? data.branchIdByKey.get(key(matches[0].company, matches[0].branch)) : context.branchId,
    );
  }

  const newDeptByOldDept = new Map();
  for (const oldDepartment of oldDepartments) {
    const oldOrgId = newOrgByOldOrg.get(oldDepartment.org_id) || context.orgId;
    const matches = data.departments.filter(
      (department) =>
        data.orgIdByCompany.get(department.company) === oldOrgId &&
        normalize(department.department) === normalize(oldDepartment.text),
    );
    newDeptByOldDept.set(
      oldDepartment.dept_id,
      matches.length
        ? data.departmentIdByKey.get(key(matches[0].company, matches[0].branch, matches[0].department))
        : context.deptId,
    );
  }

  return rows.map((row) => ({
    ...row,
    org_id: newOrgByOldOrg.get(row.org_id) || context.orgId,
    branch_id: newBranchByOldBranch.get(row.branch_id) || context.branchId,
    dept_id: newDeptByOldDept.get(row.dept_id) || context.deptId,
  }));
}

async function count(client, tableName) {
  const result = await client.query(`select count(*)::int as count from ${quoteIdentifier(tableName)}`);
  return result.rows[0].count;
}

async function main() {
  const hierarchy = parseWorkbook(WORKBOOK_PATH);
  const generated = buildGeneratedData(hierarchy);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });

  await client.connect();
  let inTransaction = false;
  try {
    const dbResult = await client.query('select current_database() as database');
    if (dbResult.rows[0].database !== TARGET_DATABASE) {
      throw new Error(
        `Refusing to run against ${dbResult.rows[0].database}; expected ${TARGET_DATABASE}`,
      );
    }

    const allRequestedTables = [
      ...DOMAIN_TABLES,
      ...OPERATIONAL_TABLES,
      'tblUsers',
  'tblUserJobRoles',
      'tblRioAdmin',
      ...PRESERVED_TABLES,
    ];
    const existingTables = await getExistingTables(client, allRequestedTables);
    const backupPath = await writeLogicalBackup(client, allRequestedTables);
    console.log(`Logical backup created: ${backupPath}`);

    const oldOrgs = existingTables.has('tblOrgs')
      ? (await client.query('select * from "tblOrgs"')).rows
      : [];
    const oldBranches = existingTables.has('tblBranches')
      ? (await client.query('select * from "tblBranches"')).rows
      : [];
    const oldDepartments = existingTables.has('tblDepartments')
      ? (await client.query('select * from "tblDepartments"')).rows
      : [];
    const preservedUsers = existingTables.has('tblUsers')
      ? (await client.query('select * from "tblUsers"')).rows
      : [];
    const preservedEmployees = existingTables.has('tblEmployees')
      ? (await client.query('select * from "tblEmployees"')).rows
      : [];
    const preservedRioAdmins = existingTables.has('tblRioAdmin')
      ? (await client.query('select * from "tblRioAdmin"')).rows
      : [];
    const configTablesToReinsert = [
      'tblApps',
      'tblAuditLogConfig',
      'tblColumnAccessConfig',
      'tblOrgSettings',
      'tblJobRoleNav',
      'tblUserJobRoles',
    ];
    const preservedConfigRows = {};
    for (const table of configTablesToReinsert) {
      preservedConfigRows[table] = existingTables.has(table)
        ? (await client.query(`select * from ${quoteIdentifier(table)}`)).rows
        : [];
    }
    const preservedRoleRows = existingTables.has('tblJobRoles')
      ? (await client.query('select * from "tblJobRoles"')).rows
      : [];
    const auditUserId = preservedUsers[0]?.user_id || null;
    generated.branchRows.forEach((row) => {
      row.changed_by = null;
    });

    const resetTables = [
      ...new Set([...DOMAIN_TABLES, ...OPERATIONAL_TABLES, 'tblUsers', 'tblRioAdmin']),
    ].filter((table) => existingTables.has(table));
    const foreignKeys = await getForeignKeys(client);
    const resetSet = new Set(resetTables);
    const blockers = foreignKeys.filter(
      (fk) =>
        resetSet.has(fk.parent_table) &&
        !resetSet.has(fk.child_table) &&
        ['NO ACTION', 'RESTRICT'].includes(fk.delete_rule),
    );
    if (blockers.length) {
      throw new Error(
        `Preserved tables block reset: ${blockers
          .map((fk) => `${fk.child_table} -> ${fk.parent_table}`)
          .join(', ')}`,
      );
    }

    await client.query('begin');
    inTransaction = true;

    const explicitChildTables = [
      'tblAuditLogs',
      'tblUsers',
      'tblEmpTechCert',
      'tblEmployees',
      'tblDeptAdmins',
    ].filter((table) => resetSet.has(table));
    if (resetSet.has('tblBranches')) {
      await client.query('update "tblBranches" set changed_by = null');
    }
    for (const table of explicitChildTables) {
      await client.query(`delete from ${quoteIdentifier(table)}`);
    }
    const remainingResetTables = resetTables.filter(
      (table) => !explicitChildTables.includes(table),
    );
    for (const table of childFirstDeleteOrder(remainingResetTables, foreignKeys)) {
      await client.query(`delete from ${quoteIdentifier(table)}`);
    }

    await insertRows(client, 'tblOrgs', [
      'org_id',
      'text',
      'valid_from',
      'valid_to',
      'int_status',
      'org_code',
      'org_city',
      'gst_number',
      'cin_number',
    ], generated.orgRows);
    await insertRows(client, 'tblBranches', [
      'branch_id',
      'org_id',
      'int_status',
      'text',
      'city',
      'branch_code',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
    ], generated.branchRows);
    await insertRows(client, 'tblDepartments', [
      'org_id',
      'dept_id',
      'int_status',
      'text',
      'parent_id',
      'created_on',
      'changed_on',
      'changed_by',
      'created_by',
      'branch_id',
    ], generated.departmentRows);
    await insertRows(client, 'tblBR_DEPT', [
      'branch_id',
      'dept_id',
      'org_id',
      'int_status',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
    ], generated.branchDepartmentRows);
    await insertRows(client, 'tblAssetTypes', [
      'org_id',
      'asset_type_id',
      'int_status',
      'assignment_type',
      'inspection_required',
      'group_required',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
      'text',
      'is_child',
      'parent_asset_type_id',
      'maint_lead_type',
      'serial_num_format',
      'last_gen_seq_no',
      'depreciation_type',
    ], generated.assetTypes);
    await insertRows(client, 'tblVendors', [
      'vendor_id',
      'org_id',
      'branch_code',
      'vendor_name',
      'int_status',
      'company_name',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'pincode',
      'company_email',
      'gst_number',
      'cin_number',
      'contact_person_name',
      'contact_person_email',
      'contact_person_number',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
      'contract_start_date',
      'contract_end_date',
    ], generated.vendors);
    await insertRows(client, 'tblProdServs', [
      'prod_serv_id',
      'org_id',
      'asset_type_id',
      'brand',
      'model',
      'status',
      'ps_type',
      'description',
    ], generated.products);
    await insertRows(client, 'tblVendorProdService', [
      'ven_prod_serv_id',
      'prod_serv_id',
      'vendor_id',
      'org_id',
    ], generated.vendorProductLinks);
    await insertRows(client, 'tblAssets', [
      'asset_type_id',
      'asset_id',
      'text',
      'serial_number',
      'description',
      'branch_id',
      'purchase_vendor_id',
      'prod_serv_id',
      'maintsch_id',
      'purchased_cost',
      'purchased_on',
      'purchased_by',
      'current_status',
      'warranty_period',
      'parent_asset_id',
      'group_id',
      'org_id',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
      'service_vendor_id',
      'expiry_date',
      'current_book_value',
      'salvage_value',
      'accumulated_depreciation',
      'useful_life_years',
      'last_depreciation_calc_date',
      'invoice_no',
      'commissioned_date',
      'depreciation_start_date',
      'project_code',
      'grant_code',
      'insurance_policy_no',
      'gl_account_code',
      'cost_center_code',
      'depreciation_rate',
      'location',
      'insurer',
      'insured_value',
      'insurance_start_date',
      'insurance_end_date',
      'comprehensive_insurance',
      'scrap_notes',
      'scraped_on',
      'scraped_by',
    ], generated.assets);
    await insertRows(client, 'tblAssetGroup_H', [
      'assetgroup_h_id',
      'org_id',
      'text',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
      'branch_code',
    ], generated.groups);
    await insertRows(client, 'tblAssetGroup_D', [
      'assetgroup_d_id',
      'assetgroup_h_id',
      'asset_id',
    ], generated.groupDetails);
    for (const group of generated.groups) {
      const details = generated.groupDetails.filter(
        (detail) => detail.assetgroup_h_id === group.assetgroup_h_id,
      );
      for (const detail of details) {
        await client.query(
          'update "tblAssets" set group_id = $1 where asset_id = $2',
          [group.assetgroup_h_id, detail.asset_id],
        );
      }
    }
    await insertRows(client, 'tblDeptAssetTypes', [
      'dept_asset_type_id',
      'dept_id',
      'asset_type_id',
      'int_status',
      'created_by',
      'created_on',
      'changed_by',
      'changed_on',
      'org_id',
    ], generated.deptAssetTypes);
    await insertRows(client, 'tblAssetAssignments', [
      'asset_assign_id',
      'dept_id',
      'asset_id',
      'org_id',
      'employee_int_id',
      'action',
      'action_on',
      'action_by',
      'latest_assignment_flag',
    ], generated.assignments);

    const remappedEmployees = remapPreservedRows(
      preservedEmployees,
      generated,
      oldOrgs,
      oldBranches,
      oldDepartments,
    );
    const remappedRioAdmins = remapPreservedRows(
      preservedRioAdmins,
      generated,
      oldOrgs,
      oldBranches,
      oldDepartments,
    );
    const remappedUsers = remapPreservedRows(
      preservedUsers,
      generated,
      oldOrgs,
      oldBranches,
      oldDepartments,
    );
    if (existingTables.has('tblJobRoles') && preservedRoleRows.length) {
      await insertRows(
        client,
        'tblJobRoles',
        await getColumns(client, 'tblJobRoles'),
        remapPreservedRows(
          preservedRoleRows,
          generated,
          oldOrgs,
          oldBranches,
          oldDepartments,
        ),
      );
    }
    if (existingTables.has('tblEmployees') && remappedEmployees.length) {
      await insertRows(
        client,
        'tblEmployees',
        await getColumns(client, 'tblEmployees'),
        remappedEmployees,
      );
    }
    if (existingTables.has('tblRioAdmin') && remappedRioAdmins.length) {
      await insertRows(
        client,
        'tblRioAdmin',
        await getColumns(client, 'tblRioAdmin'),
        remappedRioAdmins,
      );
    }
    if (existingTables.has('tblUsers') && remappedUsers.length) {
      await insertRows(
        client,
        'tblUsers',
        await getColumns(client, 'tblUsers'),
        remappedUsers,
      );
    }
    if (auditUserId && existingTables.has('tblBranches')) {
      await client.query('update "tblBranches" set changed_by = $1', [auditUserId]);
    }
    for (const table of configTablesToReinsert) {
      if (existingTables.has(table) && preservedConfigRows[table].length) {
        await insertRows(
          client,
          table,
          await getColumns(client, table),
          remapPreservedRows(
            preservedConfigRows[table],
            generated,
            oldOrgs,
            oldBranches,
            oldDepartments,
          ),
        );
      }
    }

    if (existingTables.has('tblACM')) {
      const context = firstGeneratedContext(generated);
      await client.query(
        `update "tblACM"
            set org_id = case when org_id = '*' then '*' else $1 end,
                branch_id = case when branch_id = '*' then '*' else $2 end,
                dept_id = case when dept_id = '*' then '*' else $3 end`,
        [context.orgId, context.branchId, context.deptId],
      );
    }

    const expected = {
      tblOrgs: 5,
      tblBranches: 15,
      tblDepartments: 46,
      tblBR_DEPT: 46,
      tblAssetTypes: generated.assetTypes.length,
      tblVendors: generated.vendors.length,
      tblProdServs: generated.products.length,
      tblVendorProdService: generated.vendorProductLinks.length,
      tblAssets: 322,
      tblAssetGroup_H: 46,
      tblAssetGroup_D: 322,
      tblDeptAssetTypes: generated.deptAssetTypes.length,
      tblAssetAssignments: 322,
    };
    for (const [table, expectedCount] of Object.entries(expected)) {
      const actual = await count(client, table);
      if (actual !== expectedCount) {
        throw new Error(`${table}: expected ${expectedCount}, found ${actual}`);
      }
    }

    await client.query('commit');
    inTransaction = false;
    console.log(
      JSON.stringify(
        {
          database: TARGET_DATABASE,
          hierarchy_rows: hierarchy.length,
          organizations: expected.tblOrgs,
          branches: expected.tblBranches,
          departments: expected.tblDepartments,
          assets: expected.tblAssets,
          vendors: expected.tblVendors,
          products: expected.tblProdServs,
          asset_types: expected.tblAssetTypes,
          groups: expected.tblAssetGroup_H,
          backup: backupPath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (inTransaction) await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Bannari EAM import failed: ${error.message}`);
  process.exitCode = 1;
});
