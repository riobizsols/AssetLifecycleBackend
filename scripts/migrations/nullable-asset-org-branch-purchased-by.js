/**
 * Make tblAssets.org_id, branch_id, purchased_by optional (nullable).
 * Run: node scripts/migrations/nullable-asset-org-branch-purchased-by.js
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
      ALTER TABLE "tblAssets"
        ALTER COLUMN org_id DROP NOT NULL,
        ALTER COLUMN branch_id DROP NOT NULL,
        ALTER COLUMN purchased_by DROP NOT NULL
    `);
    console.log(
      'OK: tblAssets org_id, branch_id, purchased_by are nullable on',
      connectionString.replace(/:[^:@/]+@/, ':***@')
    );
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
