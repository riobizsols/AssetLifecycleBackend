const db = require('./config/db');

async function check() {
  const tables = ['tblTechCert', 'tblATInspCert', 'tblAssetTypes'];
  for (const table of tables) {
    console.log(`\nColumns for ${table}:`);
    const res = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
    console.log(res.rows.map(r => r.column_name).join(', '));
  }
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
