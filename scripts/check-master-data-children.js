require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  const q = await pool.query(`
    SELECT job_role_nav_id, parent_id, app_id, label, sequence, access_level, int_status
    FROM "tblJobRoleNav"
    WHERE job_role_id = 'JR001' AND parent_id = 'JRN009'
    ORDER BY sequence, label
  `);
  console.log('Master Data children in DB:');
  for (const r of q.rows) {
    console.log(`${r.sequence}\t${r.job_role_nav_id}\t${r.app_id}\t${r.label}\taccess=${r.access_level}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
