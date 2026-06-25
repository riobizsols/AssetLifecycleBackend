const { getDb } = require('./dbContext');

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

  const maxRes = await db.query(`
    SELECT MAX(CAST(SUBSTRING(vendor_id FROM 2) AS INTEGER)) as max_num
    FROM "tblVendors"
    WHERE vendor_id ~ '^V[0-9]+$'
  `);
  const nextNum = (maxRes.rows[0]?.max_num || 0) + 1;
  const vendorId = `V${String(nextNum).padStart(3, '0')}`;

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

module.exports = {
  INHOUSE_VENDOR_NAME,
  getInhouseVendorId,
  resolveVendorIdForMaintRecord,
  isInhouseMaintainedBy,
};
