/**
 * Add a Bus Maintenance technician certificate + technician for NGP Bus asset types.
 * Fixes empty "Select Technician" on maintenance approval when AT067 requires
 * certs that no employee holds.
 *
 * Usage: node scripts/seed-ngp-bus-technician.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

const TENANT_DB = process.env.TENANT_DB || 'ngp_db';
const ORG = 'ORG003';
const USER = 'USR001';
const BUS_TYPES = ['AT067', 'AT068'];
const CERT_NAME = 'Bus Maintenance Certificate';
const CERT_NO = 'BUS-MAINT-001';
const TECH_NAME = 'Bus Field Technician';
const TECH_EMAIL = 'ngp.bus.technician@ngp';

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL required');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

function nextId(prefix, maxId) {
  const n = maxId && String(maxId).startsWith(prefix)
    ? parseInt(String(maxId).slice(prefix.length), 10)
    : 0;
  const width = Math.max(prefix === 'EMP_INT_' ? 4 : 3, String(maxId || '').slice(prefix.length).length || 3);
  return `${prefix}${String(n + 1).padStart(width, '0')}`;
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl(TENANT_DB), ssl: false });
  const client = await pool.connect();
  const now = new Date();

  try {
    await client.query('BEGIN');

    // --- Certificate ---
    let tc = await client.query(
      `SELECT tc_id FROM "tblTechCert"
       WHERE LOWER(TRIM(certificate_name)) = LOWER($1)
         AND (org_id = $2 OR org_id IS NULL)
       ORDER BY CASE WHEN org_id = $2 THEN 0 ELSE 1 END, tc_id
       LIMIT 1`,
      [CERT_NAME, ORG],
    );
    let tcId = tc.rows[0]?.tc_id;
    if (!tcId) {
      const maxTc = await client.query(
        `SELECT MAX(tc_id) AS m FROM "tblTechCert" WHERE tc_id ~ '^TCERT[0-9]+$'`,
      );
      tcId = nextId('TCERT', maxTc.rows[0].m);
      await client.query(
        `INSERT INTO "tblTechCert" (
           tc_id, certificate_name, certificate_no, created_by, created_on, org_id
         ) VALUES ($1,$2,$3,$4,$5,$6)`,
        [tcId, CERT_NAME, CERT_NO, USER, now, ORG],
      );
      console.log('Created tech cert', tcId, CERT_NAME);
    } else {
      console.log('Using existing tech cert', tcId);
    }

    // --- Map cert to Bus asset types (replace prior multi-cert requirements) ---
    for (const assetTypeId of BUS_TYPES) {
      const existsType = await client.query(
        `SELECT 1 FROM "tblAssetTypes" WHERE asset_type_id=$1 AND org_id=$2`,
        [assetTypeId, ORG],
      );
      if (!existsType.rows[0]) {
        console.log('Skip missing asset type', assetTypeId);
        continue;
      }

      await client.query(
        `DELETE FROM "tblATMaintCert" WHERE asset_type_id = $1 AND (org_id = $2 OR org_id IS NULL)`,
        [assetTypeId, ORG],
      );

      const maxAtmc = await client.query(
        `SELECT MAX(atmc_id) AS m FROM "tblATMaintCert" WHERE atmc_id ~ '^ATMC[0-9]+$'`,
      );
      const atmcId = nextId('ATMC', maxAtmc.rows[0].m);
      await client.query(
        `INSERT INTO "tblATMaintCert" (
           atmc_id, asset_type_id, tc_id, maint_type_id,
           created_by, created_on, is_mandatory, requires_expiry, expiry_alert_days, org_id
         ) VALUES ($1,$2,$3,$4,$5,$6,true,false,30,$7)`,
        [atmcId, assetTypeId, tcId, 'MT002', USER, now, ORG],
      );
      console.log('Mapped', assetTypeId, '→', tcId, `(${atmcId})`);
    }

    // --- Technician employee ---
    let emp = await client.query(
      `SELECT emp_int_id, full_name FROM "tblEmployees"
       WHERE org_id = $1 AND (
         LOWER(TRIM(full_name)) = LOWER($2)
         OR LOWER(TRIM(email_id)) = LOWER($3)
       )
       LIMIT 1`,
      [ORG, TECH_NAME, TECH_EMAIL],
    );
    let empIntId = emp.rows[0]?.emp_int_id;
    if (!empIntId) {
      const maxEmp = await client.query(
        `SELECT MAX(emp_int_id) AS m FROM "tblEmployees" WHERE emp_int_id ~ '^EMP_INT_[0-9]+$'`,
      );
      empIntId = nextId('EMP_INT_', maxEmp.rows[0].m);
      const employeeId = `EMP${String(parseInt(empIntId.replace(/\D/g, ''), 10)).padStart(4, '0')}`;
      await client.query(
        `INSERT INTO "tblEmployees" (
           emp_int_id, employee_id, name, first_name, last_name, full_name,
           email_id, phone_number, employee_type, joining_date, language_code, int_status,
           org_id, branch_id, dept_id,
           created_by, created_on, changed_by, changed_on
         ) VALUES (
           $1,$2,$3,'Bus','Technician',$3,
           $4,'9876500123','PERMANENT', CURRENT_DATE, 'en', 1,
           $5,'BR001','DPT001',
           $6,$7,$6,$7
         )`,
        [empIntId, employeeId, TECH_NAME, TECH_EMAIL, ORG, USER, now],
      );
      console.log('Created technician employee', empIntId, TECH_NAME);
    } else {
      await client.query(
        `UPDATE "tblEmployees" SET int_status=1, changed_by=$1, changed_on=$2 WHERE emp_int_id=$3`,
        [USER, now, empIntId],
      );
      console.log('Using existing employee', empIntId, emp.rows[0].full_name);
    }

    // --- Approved employee certificate ---
    const existingEtc = await client.query(
      `SELECT etc_id, status FROM "tblEmpTechCert"
       WHERE emp_int_id = $1 AND tc_id = $2
       LIMIT 1`,
      [empIntId, tcId],
    );
    if (existingEtc.rows[0]) {
      await client.query(
        `UPDATE "tblEmpTechCert"
         SET status = 'Approved',
             certificate_date = COALESCE(certificate_date, CURRENT_DATE::text),
             certificate_expiry = COALESCE(certificate_expiry, (CURRENT_DATE + INTERVAL '3 years')::date::text),
             org_id = COALESCE(org_id, $1)
         WHERE etc_id = $2`,
        [ORG, existingEtc.rows[0].etc_id],
      );
      console.log('Updated emp cert', existingEtc.rows[0].etc_id, '→ Approved');
    } else {
      const maxEtc = await client.query(
        `SELECT MAX(etc_id) AS m FROM "tblEmpTechCert" WHERE etc_id ~ '^ETC[0-9]+$'`,
      );
      const etcId = nextId('ETC', maxEtc.rows[0].m);
      await client.query(
        `INSERT INTO "tblEmpTechCert" (
           etc_id, emp_int_id, tc_id, certificate_date, certificate_expiry,
           status, created_by, created_on, org_id
         ) VALUES (
           $1,$2,$3, CURRENT_DATE::text, (CURRENT_DATE + INTERVAL '3 years')::date::text,
           'Approved', $4, $5, $6
         )`,
        [etcId, empIntId, tcId, USER, now, ORG],
      );
      console.log('Created emp cert', etcId);
    }

    await client.query('COMMIT');

    // --- Verify certified technicians for Bus ---
    for (const assetTypeId of BUS_TYPES) {
      const required = await client.query(
        `SELECT DISTINCT tc_id FROM "tblATMaintCert" WHERE asset_type_id=$1 AND (org_id=$2 OR org_id IS NULL)`,
        [assetTypeId, ORG],
      );
      const tcIds = required.rows.map((r) => r.tc_id);
      if (!tcIds.length) {
        console.log(assetTypeId, 'no required certs');
        continue;
      }
      const techs = await client.query(
        `
        WITH required_certs AS (SELECT UNNEST($1::text[]) AS tc_id),
        required_count AS (SELECT COUNT(*)::int AS cnt FROM required_certs)
        SELECT e.emp_int_id, e.full_name, e.email_id,
               MIN(tc.certificate_name) AS cert_name
        FROM required_certs rc
        CROSS JOIN required_count rcnt
        INNER JOIN "tblEmpTechCert" etc ON etc.tc_id = rc.tc_id
        INNER JOIN "tblEmployees" e ON e.emp_int_id = etc.emp_int_id
        LEFT JOIN "tblTechCert" tc ON tc.tc_id = rc.tc_id
        WHERE e.org_id = $2
          AND e.int_status = 1
          AND (etc.status IS NULL OR UPPER(etc.status) IN ('APPROVED', 'CONFIRMED'))
        GROUP BY e.emp_int_id, e.full_name, e.email_id
        HAVING COUNT(DISTINCT rc.tc_id) = (SELECT cnt FROM required_count)
        ORDER BY e.full_name
        `,
        [tcIds, ORG],
      );
      console.log(
        `\nCertified for ${assetTypeId} (required ${tcIds.join(',')}):`,
        techs.rows,
      );
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('FAILED:', err.message);
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
