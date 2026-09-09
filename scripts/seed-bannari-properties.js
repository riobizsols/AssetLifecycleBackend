#!/usr/bin/env node

/**
 * Clone legacy ORG001 properties into each Bannari org (BAN001–BAN005)
 * and map a default property set onto every active asset type.
 *
 * Usage:
 *   node scripts/seed-bannari-properties.js
 *   node scripts/seed-bannari-properties.js --dry-run
 *   node scripts/seed-bannari-properties.js --org-id=BAN001
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Client } = require('pg');

const SOURCE_ORG = 'ORG001';
const BANNARI_ORGS = ['BAN001', 'BAN002', 'BAN003', 'BAN004', 'BAN005'];

/** Prefer these property names when mapping to asset types (case-insensitive). */
const DEFAULT_MAP_NAMES = [
  'Brand',
  'Type',
  'Capacity',
  'Material',
  'Color',
  'Dimensions',
  'Model',
];

function parseArgs(argv) {
  const args = { dryRun: false, orgId: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--org-id=')) args.orgId = arg.slice('--org-id='.length);
  }
  return args;
}

function nextId(prefix, maxId, seq, width = 6) {
  const current = maxId && String(maxId).startsWith(prefix)
    ? parseInt(String(maxId).slice(prefix.length), 10)
    : 0;
  return `${prefix}${String(current + seq).padStart(width, '0')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    const targetOrgs = args.orgId ? [args.orgId] : BANNARI_ORGS;

    const sourceProps = await client.query(
      `
      SELECT prop_id, property, int_status
      FROM "tblProps"
      WHERE org_id = $1
        AND int_status::text IN ('1', 'true')
      ORDER BY prop_id
      `,
      [SOURCE_ORG],
    );

    if (!sourceProps.rows.length) {
      throw new Error(`No active properties found for source org ${SOURCE_ORG}`);
    }

    console.log(
      `Cloning ${sourceProps.rows.length} properties from ${SOURCE_ORG} → ${targetOrgs.join(', ')}` +
        (args.dryRun ? ' [DRY RUN]' : ''),
    );

    const maxProp = await client.query(
      `SELECT MAX(prop_id) AS m FROM "tblProps" WHERE prop_id LIKE 'BNP%'`,
    );
    const maxAtp = await client.query(
      `SELECT MAX(asset_type_prop_id) AS m FROM "tblAssetTypeProps" WHERE asset_type_prop_id LIKE 'BATP%'`,
    );

    let propSeq = 0;
    let atpSeq = 0;
    const summary = {
      propsCreated: 0,
      mapsCreated: 0,
      orgsSkipped: 0,
    };

    if (!args.dryRun) await client.query('BEGIN');

    for (const orgId of targetOrgs) {
      const existing = await client.query(
        `SELECT COUNT(*)::int AS c FROM "tblProps" WHERE org_id = $1 AND int_status::text IN ('1','true')`,
        [orgId],
      );

      let orgPropRows;
      if (existing.rows[0].c > 0) {
        console.log(`  ${orgId}: already has ${existing.rows[0].c} properties — reuse`);
        orgPropRows = (
          await client.query(
            `
            SELECT prop_id, property
            FROM "tblProps"
            WHERE org_id = $1 AND int_status::text IN ('1','true')
            ORDER BY property
            `,
            [orgId],
          )
        ).rows;
        summary.orgsSkipped += 1;
      } else {
        orgPropRows = [];
        for (const src of sourceProps.rows) {
          propSeq += 1;
          const propId = nextId('BNP', maxProp.rows[0].m, propSeq);
          if (!args.dryRun) {
            await client.query(
              `
              INSERT INTO "tblProps" (prop_id, org_id, property, int_status)
              VALUES ($1, $2, $3, $4)
              `,
              [propId, orgId, src.property, src.int_status ?? 1],
            );
          }
          orgPropRows.push({ prop_id: propId, property: src.property });
          summary.propsCreated += 1;
        }
        console.log(`  ${orgId}: created ${sourceProps.rows.length} properties`);
      }

      // Choose default props to map (by name), fallback to first 5
      const byName = new Map(orgPropRows.map((p) => [String(p.property).toLowerCase(), p]));
      const toMap = [];
      for (const name of DEFAULT_MAP_NAMES) {
        const hit = byName.get(name.toLowerCase());
        if (hit) toMap.push(hit);
      }
      if (!toMap.length) toMap.push(...orgPropRows.slice(0, 5));

      const types = await client.query(
        `
        SELECT asset_type_id
        FROM "tblAssetTypes"
        WHERE org_id = $1 AND int_status = 1
        ORDER BY asset_type_id
        `,
        [orgId],
      );

      let mappedForOrg = 0;
      for (const type of types.rows) {
        for (const prop of toMap) {
          const already = await client.query(
            `
            SELECT 1 FROM "tblAssetTypeProps"
            WHERE asset_type_id = $1 AND prop_id = $2
            LIMIT 1
            `,
            [type.asset_type_id, prop.prop_id],
          );
          if (already.rows.length) continue;

          atpSeq += 1;
          const atpId = nextId('BATP', maxAtp.rows[0].m, atpSeq);
          if (!args.dryRun) {
            await client.query(
              `
              INSERT INTO "tblAssetTypeProps" (asset_type_prop_id, org_id, asset_type_id, prop_id)
              VALUES ($1, $2, $3, $4)
              `,
              [atpId, orgId, type.asset_type_id, prop.prop_id],
            );
          }
          summary.mapsCreated += 1;
          mappedForOrg += 1;
        }
      }
      console.log(
        `  ${orgId}: mapped ${toMap.length} props × ${types.rows.length} types → ${mappedForOrg} new links`,
      );
    }

    if (!args.dryRun) await client.query('COMMIT');

    console.log('\nDone:', summary);

    const verify = await client.query(`
      SELECT p.org_id, COUNT(DISTINCT p.prop_id)::int AS props,
             COUNT(DISTINCT atp.asset_type_id)::int AS types_with_props
      FROM "tblProps" p
      LEFT JOIN "tblAssetTypeProps" atp ON atp.prop_id = p.prop_id AND atp.org_id = p.org_id
      WHERE p.org_id LIKE 'BAN%'
        AND p.int_status::text IN ('1','true')
      GROUP BY p.org_id
      ORDER BY p.org_id
    `);
    console.log('\nVerify:', verify.rows);

    const projector = await client.query(`
      SELECT at.asset_type_id, at.text, p.property
      FROM "tblAssetTypes" at
      JOIN "tblAssetTypeProps" atp ON atp.asset_type_id = at.asset_type_id
      JOIN "tblProps" p ON p.prop_id = atp.prop_id
      WHERE at.text = 'Smart Classroom Projector'
      ORDER BY p.property
    `);
    console.log('\nSmart Classroom Projector props:', projector.rows);
  } catch (err) {
    if (!args.dryRun) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
