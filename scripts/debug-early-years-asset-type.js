require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await client.connect();
  try {
    const matches = await client.query(`
      SELECT asset_type_id, text, int_status, org_id, maint_lead_type
      FROM "tblAssetTypes"
      WHERE LOWER(COALESCE(text,'')) LIKE '%early years%'
         OR LOWER(COALESCE(text,'')) LIKE '%sensory%'
      ORDER BY org_id, text
    `);
    console.log('MATCHES', matches.rows);

    const early = await client.query(`
      SELECT asset_type_id, text, int_status, org_id
      FROM "tblAssetTypes"
      WHERE org_id = 'ORG003' AND LOWER(COALESCE(text,'')) LIKE 'early%'
      ORDER BY text
    `);
    console.log('EARLY_ORG003', early.rows);

    // What does the frequency page load for asset types?
    const active = await client.query(`
      SELECT COUNT(*)::int AS c FROM "tblAssetTypes"
      WHERE org_id = 'ORG003' AND COALESCE(int_status,1) = 1
    `);
    console.log('ACTIVE_COUNT_ORG003', active.rows[0]);

    const inactiveSensory = await client.query(`
      SELECT asset_type_id, text, int_status, org_id
      FROM "tblAssetTypes"
      WHERE LOWER(COALESCE(text,'')) LIKE '%sensory tool%'
      ORDER BY org_id, text
    `);
    console.log('SENSORY_TOOL', inactiveSensory.rows);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
