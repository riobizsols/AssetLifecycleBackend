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
       emp_int_id,
       COALESCE(
         NULLIF(BTRIM(full_name), ''),
         NULLIF(BTRIM(name), ''),
         emp_int_id
       ) AS technician_name,
       email_id AS technician_email,
       phone_number AS technician_phno
     FROM "tblEmployees"
     WHERE emp_int_id = $1
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
