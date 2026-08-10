require('dotenv').config();
const { Pool } = require('pg');

const p = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

(async () => {
  try {
    await p.query(`
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES ('sp_cat_at_map', 'SPCATM', 0)
      ON CONFLICT (table_key) DO NOTHING
    `);

    await p.query(`
      UPDATE "tblApps"
      SET text = 'Spare Parts Configuration'
      WHERE app_id = 'SPAREPARTS'
    `);

    await p.query(`
      UPDATE "tblJobRoleNav"
      SET label = 'Spare Parts Configuration'
      WHERE app_id = 'SPAREPARTS'
    `);

    console.log('Updated SPAREPARTS labels and mapping sequence');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await p.end();
  }
})();
