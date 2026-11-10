/**
 * Resolve technician display fields from tblEmployees for tblAssetMaintSch.
 */
async function resolveTechnicianFromEmp(empIntId, dbPool) {
  if (!empIntId || !dbPool) {
    return {
      emp_int_id: empIntId || null,
      technician_name: null,
      technician_email: null,
      technician_phno: null,
    };
  }

  const result = await dbPool.query(
    `SELECT
       e.emp_int_id,
       COALESCE(
         NULLIF(BTRIM(e.full_name), ''),
         NULLIF(BTRIM(e.name), ''),
         NULLIF(BTRIM(u.full_name), ''),
         e.emp_int_id
       ) AS technician_name,
       COALESCE(
         NULLIF(BTRIM(e.email_id), ''),
         NULLIF(BTRIM(u.email), '')
       ) AS technician_email,
       COALESCE(
         NULLIF(BTRIM(e.phone_number), ''),
         NULLIF(BTRIM(u.phone), '')
       ) AS technician_phno
     FROM "tblEmployees" e
     LEFT JOIN LATERAL (
       SELECT full_name, email, phone
       FROM "tblUsers"
       WHERE emp_int_id = e.emp_int_id
       ORDER BY CASE WHEN COALESCE(int_status, 1) = 1 THEN 0 ELSE 1 END
       LIMIT 1
     ) u ON TRUE
     WHERE e.emp_int_id = $1
     LIMIT 1`,
    [empIntId]
  );

  if (!result.rows[0]) {
    return {
      emp_int_id: empIntId,
      technician_name: null,
      technician_email: null,
      technician_phno: null,
    };
  }

  return result.rows[0];
}

/**
 * Resolve technician display fields from vendor contact person / company email.
 * Used when maintenance is vendor-maintained so the supervisor form auto-fills.
 */
async function resolveVendorContactTech(vendorId, dbPool) {
  if (!vendorId || !dbPool) {
    return {
      vendor_id: vendorId || null,
      technician_name: null,
      technician_email: null,
      technician_phno: null,
    };
  }

  const result = await dbPool.query(
    `SELECT
       v.vendor_id,
       COALESCE(
         NULLIF(BTRIM(v.contact_person_name), ''),
         NULLIF(BTRIM(v.vendor_name), ''),
         NULLIF(BTRIM(v.company_name), '')
       ) AS technician_name,
       COALESCE(
         NULLIF(BTRIM(v.contact_person_email), ''),
         NULLIF(BTRIM(v.company_email), '')
       ) AS technician_email,
       NULLIF(BTRIM(v.contact_person_number), '') AS technician_phno
     FROM "tblVendors" v
     WHERE v.vendor_id = $1
     LIMIT 1`,
    [vendorId]
  );

  if (!result.rows[0]) {
    return {
      vendor_id: vendorId,
      technician_name: null,
      technician_email: null,
      technician_phno: null,
    };
  }

  const row = result.rows[0];
  let phone = row.technician_phno ? String(row.technician_phno).replace(/\D/g, '') : null;
  if (phone && phone.length > 10 && phone.startsWith('0')) {
    phone = phone.slice(-10);
  } else if (phone && phone.length > 10) {
    phone = phone.slice(0, 10);
  }

  return {
    ...row,
    technician_phno: phone || null,
  };
}

module.exports = {
  resolveTechnicianFromEmp,
  resolveVendorContactTech,
};
