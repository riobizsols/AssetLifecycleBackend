/**
 * Setup Scrap workflow sequences for an asset type by copying existing maintenance workflow sequences.
 *
 * Copies from: tblWFATSeqs(asset_type_id, wf_steps_id, seqs_no, org_id)
 * Inserts into: tblWFScrapSeq(id, asset_type_id, wf_steps_id, seq_no, org_id)
 *
 * Usage:
 *   node scripts/setup-scrap-workflow-sequences.js <ASSET_TYPE_ID> [ORG_ID] [--force]
 *
 * Notes:
 * - If --force is provided, existing tblWFScrapSeq rows for that asset_type_id+org_id will be deleted first.
 * - IDs are generated using crypto.randomUUID().
 */

const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const args = process.argv.slice(2);
  const assetTypeId = (args[0] || '').toString().trim().toUpperCase();
  const orgIdArg = (args[1] || '').toString().trim();
  const force = args.includes('--force');

  if (!assetTypeId) {
    console.log('Usage: node scripts/setup-scrap-workflow-sequences.js <ASSET_TYPE_ID> [ORG_ID] [--force]');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 1,
  });

  const client = await pool.connect();
  try {
    // Resolve org_id if not provided
    let orgId = orgIdArg;
    if (!orgId) {
      const r = await client.query(`SELECT org_id FROM "tblAssetTypes" WHERE asset_type_id = $1`, [assetTypeId]);
      orgId = r.rows[0]?.org_id;
    }

    if (!orgId) {
      console.error(`❌ Could not resolve org_id for asset_type_id ${assetTypeId}. Provide ORG_ID explicitly.`);
      process.exit(1);
    }

    console.log(`Setting up scrap workflow sequences for asset_type_id=${assetTypeId}, org_id=${orgId}`);

    await client.query('BEGIN');

    if (force) {
      console.log('⚠️  --force enabled: deleting existing tblWFScrapSeq rows first...');
      await client.query(`DELETE FROM "tblWFScrapSeq" WHERE asset_type_id = $1 AND org_id = $2`, [assetTypeId, orgId]);
    } else {
      const existing = await client.query(
        `SELECT COUNT(1)::int AS c FROM "tblWFScrapSeq" WHERE asset_type_id = $1 AND org_id = $2`,
        [assetTypeId, orgId]
      );
      if ((existing.rows[0]?.c || 0) > 0) {
        console.log('✅ Scrap workflow sequences already exist. Nothing to do. (Use --force to overwrite)');
        await client.query('ROLLBACK');
        return;
      }
    }

    const seqRes = await client.query(
      `
        SELECT wf_steps_id, seqs_no
        FROM "tblWFATSeqs"
        WHERE asset_type_id = $1 AND org_id = $2
        ORDER BY seqs_no ASC
      `,
      [assetTypeId, orgId]
    );

    if (!seqRes.rows.length) {
      console.log(`❌ No rows found in tblWFATSeqs for asset_type_id=${assetTypeId}, org_id=${orgId}`);
      await client.query('ROLLBACK');
      return;
    }

    let inserted = 0;
    for (const row of seqRes.rows) {
      const id = `WFSCQ_${crypto.randomUUID().slice(0, 12)}`;
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `
          INSERT INTO "tblWFScrapSeq" (id, asset_type_id, wf_steps_id, seq_no, org_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [id, assetTypeId, row.wf_steps_id, Number(row.seqs_no), orgId]
      );
      inserted += 1;
    }

    await client.query('COMMIT');
    console.log(`✅ Inserted ${inserted} scrap workflow sequence row(s) into tblWFScrapSeq.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});

