require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    const apps = await p.query(`
      UPDATE "tblApps"
      SET text = 'Spare Part'
      WHERE app_id = 'SPAREPARTMASTER'
      RETURNING app_id, text, org_id
    `);
    const nav = await p.query(`
      UPDATE "tblJobRoleNav"
      SET label = 'Spare Part'
      WHERE app_id = 'SPAREPARTMASTER'
      RETURNING job_role_nav_id, label
    `);
    console.log('apps updated:', apps.rows);
    console.log('nav updated:', nav.rowCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await p.end();
  }
})();
