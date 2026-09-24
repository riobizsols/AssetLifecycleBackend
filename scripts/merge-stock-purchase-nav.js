/**
 * Merge Out of Stock + Purchase Requirement nav into one "Stock & Purchase" item.
 * Usage: node scripts/merge-stock-purchase-nav.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl('ngp_db'), ssl: false });
  try {
    await pool.query('BEGIN');

    const rename = await pool.query(
      `
      UPDATE "tblJobRoleNav"
         SET label = 'Stock & Purchase',
             int_status = 1
       WHERE app_id = 'PURCHASEREQUIREMENTREPORT'
      RETURNING job_role_nav_id, job_role_id, label
      `,
    );

    const hide = await pool.query(
      `
      UPDATE "tblJobRoleNav"
         SET int_status = 0,
             label = 'Out of Stock (merged)'
       WHERE app_id = 'OUTOFSTOCKREPORT'
      RETURNING job_role_nav_id, job_role_id
      `,
    );

    await pool.query(
      `
      UPDATE "tblApps"
         SET text = 'Stock & Purchase'
       WHERE app_id = 'PURCHASEREQUIREMENTREPORT'
      `,
    );

    await pool.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          ok: true,
          renamed: rename.rows.length,
          hiddenOutOfStock: hide.rows.length,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
