/**
 * Add nullable branch_id to tblAssetTypes (optional per asset type).
 * Run: node scripts/migrations/add-asset-types-branch-id.js
 *
 * Note: PostgreSQL appends new columns at the end; logical position is after org_id.
 */
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const DATABASE_URL =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.GENERIC_URL;

async function migrate(connectionString) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`
      ALTER TABLE "tblAssetTypes"
        ADD COLUMN IF NOT EXISTS branch_id character varying(10);
    `);

    // Optional FK — only if tblBranches exists and constraint not already there
    const fk = await client.query(`
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_tblassettypes_branch_id'
    `);
    if (fk.rowCount === 0) {
      try {
        await client.query(`
          ALTER TABLE "tblAssetTypes"
            ADD CONSTRAINT "fk_tblassettypes_branch_id"
            FOREIGN KEY (branch_id)
            REFERENCES "tblBranches" (branch_id)
            ON UPDATE CASCADE
            ON DELETE SET NULL;
        `);
      } catch (err) {
        console.warn('FK not added (ok if branches table missing):', err.message);
      }
    }

    console.log('OK: tblAssetTypes.branch_id ready on', connectionString.replace(/:[^:@/]+@/, ':***@'));
  } finally {
    await client.end();
  }
}

(async () => {
  if (!DATABASE_URL) {
    console.error('No DATABASE_URL / GENERIC_URL set');
    process.exit(1);
  }
  await migrate(DATABASE_URL);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
