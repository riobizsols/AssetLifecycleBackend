require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query(`
    ALTER TABLE "tblEmpTechCert"
    ADD COLUMN IF NOT EXISTS file_path character varying
  `);
  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tblEmpTechCert'
    ORDER BY ordinal_position
  `);
  console.log(cols.rows.map((r) => r.column_name));
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
