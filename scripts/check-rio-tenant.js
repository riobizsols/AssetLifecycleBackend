require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const urls = [
    ['TENANT_DATABASE_URL', process.env.TENANT_DATABASE_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
  ];

  for (const [label, url] of urls) {
    if (!url) continue;
    console.log(`\n--- ${label} ---`);
    console.log(url.replace(/:[^:@]+@/, ':***@'));
    const pool = new Pool({ connectionString: url });
    try {
      const rio = await pool.query(
        'SELECT org_id, org_name, database_name FROM tenants WHERE org_id = $1',
        ['RIO']
      );
      console.log('RIO:', JSON.stringify(rio.rows, null, 2));
      const all = await pool.query(
        'SELECT org_id, org_name FROM tenants ORDER BY org_id LIMIT 20'
      );
      console.log('Tenants:', JSON.stringify(all.rows, null, 2));
    } catch (e) {
      console.error('Error:', e.message);
    } finally {
      await pool.end();
    }
  }
}

main();
