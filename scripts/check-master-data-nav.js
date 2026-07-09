require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const q = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND int_status = 1
      AND (app_id IN ('USERS', 'USERROLES') OR label ILIKE '%role%')
    ORDER BY sequence, label
  `);
  console.log('Master Data / User Role nav rows:');
  for (const r of q.rows) {
    console.log(`${r.sequence}\t${r.app_id}\t${r.label}\tparent=${r.parent_id}`);
  }
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
