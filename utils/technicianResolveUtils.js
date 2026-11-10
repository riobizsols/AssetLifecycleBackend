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

module.exports = {
  resolveTechnicianFromEmp,
};
