#!/usr/bin/env node
/**
 * Backdate one workflow's current AP step so it becomes overdue for escalation testing.
 * Sets changed_on to (CURRENT_DATE - 2) so step_date = 2 days ago, deadline = yesterday.
 *
 * Usage (from AssetLifecycleBackend):
 *   node scripts/backdate-one-ap-step-for-escalation-test.js <wfamsh_id> [orgId]
 *
 * Example:
 *   node scripts/backdate-one-ap-step-for-escalation-test.js WFAMSH_01 ORG001
 *
 * Then run: node scripts/test-workflow-escalation.js ORG001
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getDb } = require('../utils/dbContext');

const wfamshId = process.argv[2];
const orgId = process.argv[3] || process.env.ORG_ID || 'ORG001';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set.');
    process.exit(1);
  }
  if (!wfamshId) {
    console.error('Usage: node scripts/backdate-one-ap-step-for-escalation-test.js <wfamsh_id> [orgId]');
    console.error('Example: node scripts/backdate-one-ap-step-for-escalation-test.js WFAMSH_01 ORG001');
    process.exit(1);
  }

  const db = getDb();

  const update = await db.query(
    `UPDATE "tblWFAssetMaintSch_D"
     SET changed_on = ARRAY[(CURRENT_DATE - 2)::timestamp without time zone]
     WHERE wfamsh_id = $1 AND org_id = $2 AND status = 'AP'
     RETURNING wfamsd_id, wfamsh_id, sequence`,
    [wfamshId, orgId]
  );

  if (update.rowCount === 0) {
    console.error('No AP row found for wfamsh_id=' + wfamshId + ', org_id=' + orgId);
    process.exit(1);
  }

  console.log('Backdated ' + update.rowCount + ' row(s): step date set to (today - 2).');
  console.log(update.rows);
  console.log('Run: node scripts/test-workflow-escalation.js ' + orgId);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
