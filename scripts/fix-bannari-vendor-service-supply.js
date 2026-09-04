require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`
    UPDATE "tblVendors"
    SET service_supply = true
    WHERE org_id LIKE 'BAN%'
      AND int_status = 1
      AND (service_supply IS DISTINCT FROM true)
    RETURNING vendor_id, org_id, vendor_name, service_supply
  `);
  console.log('updated', r.rows.length);
  console.log(r.rows);
  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
