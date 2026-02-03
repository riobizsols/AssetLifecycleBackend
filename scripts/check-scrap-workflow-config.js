/**
 * Check Scrap Workflow configuration
 *
 * Usage:
 *   node scripts/check-scrap-workflow-config.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  try {
    const counts = {};

    const tables = ['tblWFScrapSeq', 'tblWFScrap_H', 'tblWFScrap_D', 'tblAssetScrap'];
    for (const t of tables) {
      // eslint-disable-next-line no-await-in-loop
      const r = await pool.query(`SELECT COUNT(1)::int AS c FROM "${t}"`);
      counts[t] = r.rows[0]?.c ?? 0;
    }

    console.log('=== Scrap Workflow Table Counts ===');
    for (const [k, v] of Object.entries(counts)) {
      console.log(`${k}: ${v}`);
    }

    if (counts.tblWFScrapSeq === 0) {
      console.log('\n⚠️  tblWFScrapSeq has 0 rows.');
      console.log('   Scrap requests will be processed as DIRECT scrap (no workflow) until sequences are configured.');
    } else {
      console.log('\n✅ tblWFScrapSeq has workflow sequences configured.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});

