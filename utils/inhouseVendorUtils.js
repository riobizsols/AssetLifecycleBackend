const { getDb } = require('./dbContext');
const { generateCustomId } = require('./idGenerator');

const INHOUSE_VENDOR_NAME = 'In-House Maintenance';
const INHOUSE_VENDOR_SETTING_KEY = 'inhouse_vendor_id';

async function getInhouseVendorId(orgId = 'ORG001') {
  const db = getDb();

  const settingRes = await db.query(
    `SELECT value FROM "tblOrgSettings" WHERE org_id = $1 AND key = $2 LIMIT 1`,
    [orgId, INHOUSE_VENDOR_SETTING_KEY]
  );
  if (settingRes.rows[0]?.value) {
    const configuredId = settingRes.rows[0].value;
    const exists = await db.query(
      'SELECT vendor_id FROM "tblVendors" WHERE vendor_id = $1 AND org_id = $2',
      [configuredId, orgId]
    );
    if (exists.rows.length) return configuredId;
  }

  const byName = await db.query(
    `SELECT vendor_id FROM "tblVendors" WHERE org_id = $1 AND vendor_name = $2 LIMIT 1`,
    [orgId, INHOUSE_VENDOR_NAME]
  );
  if (byName.rows.length) return byName.rows[0].vendor_id;

  const vendorId = await generateCustomId('vendor', 3);

  await db.query(
    `INSERT INTO "tblVendors" (
      vendor_id, org_id, vendor_name, int_status, company_name,
      address_line1, city, state, pincode, company_email,
      contact_person_name, contact_person_email, contact_person_number,
      created_by, created_on, changed_by, changed_on
    ) VALUES ($1, $2, $3, 1, $3, '', '', '', '', '', '', '', '', 'system', NOW(), 'system', NOW())`,
    [vendorId, orgId, INHOUSE_VENDOR_NAME]
  );

  return vendorId;
}

async function resolveVendorIdForMaintRecord(vendorId, maintainedBy, orgId) {
  // In-house must never keep the asset's service_vendor_id — that makes Furnace/etc.
  // look "vendor based" and skips technician fields on the schedule.
  if (isInhouseMaintainedBy(maintainedBy)) {
    return getInhouseVendorId(orgId);
  }
  if (vendorId != null && String(vendorId).trim() !== '') {
    return vendorId;
  }
  // tblAssetMaintSch.vendor_id is NOT NULL + FK — use system in-house vendor when none assigned
  return getInhouseVendorId(orgId);
}

function isInhouseMaintainedBy(maintainedBy) {
  const maint = (maintainedBy || '').toString().toLowerCase().replace(/\s|-/g, '');
  if (!maint) return false;
  return !maint.includes('vendor');
}

/**
 * Resolve provider from tblATMaintFreq — never from asset.service_vendor_id.
 * Many in-house types (Furnace, etc.) still have a purchase/service vendor row;
 * using that as "Vendor" blanks technicians and mislabels Upcoming Jobs / WOs.
 */
async function resolveMaintenanceProvider({
  orgId,
  atMainFreqId = null,
  assetTypeId = null,
  serviceVendorId = null,
  dbPool = null,
} = {}) {
  const db = dbPool || getDb();
  let maintainedBy = null;
  let empIntId = null;
  let resolvedFreqId = atMainFreqId || null;

  if (atMainFreqId || assetTypeId) {
    try {
      const freq = await db.query(
        `SELECT at_main_freq_id, maintained_by, emp_int_id
         FROM "tblATMaintFreq"
         WHERE org_id = $1
           AND (
             ($2::text IS NOT NULL AND at_main_freq_id = $2)
             OR ($3::text IS NOT NULL AND asset_type_id = $3)
           )
           AND COALESCE(int_status, 1) = 1
           AND NULLIF(BTRIM(maintained_by), '') IS NOT NULL
         ORDER BY (at_main_freq_id = $2) DESC NULLS LAST, at_main_freq_id ASC
         LIMIT 1`,
        [orgId, atMainFreqId || null, assetTypeId || null],
      );
      if (freq.rows[0]) {
        maintainedBy = freq.rows[0].maintained_by;
        empIntId = freq.rows[0].emp_int_id || null;
        resolvedFreqId = freq.rows[0].at_main_freq_id || resolvedFreqId;
      }
    } catch (_) {
      /* optional */
    }
  }

  // Missing freq → Inhouse. Do not treat service_vendor_id as Vendor.
  if (!maintainedBy) {
    maintainedBy = 'Inhouse';
  }

  const isInhouse = isInhouseMaintainedBy(maintainedBy);
  if (!isInhouse) {
    empIntId = null;
  }

  const vendorId = await resolveVendorIdForMaintRecord(
    serviceVendorId,
    maintainedBy,
    orgId,
  );

  return {
    maintainedBy,
    empIntId,
    isInhouse,
    vendorId,
    atMainFreqId: resolvedFreqId,
  };
}

module.exports = {
  INHOUSE_VENDOR_NAME,
  getInhouseVendorId,
  resolveVendorIdForMaintRecord,
  isInhouseMaintainedBy,
  resolveMaintenanceProvider,
};
