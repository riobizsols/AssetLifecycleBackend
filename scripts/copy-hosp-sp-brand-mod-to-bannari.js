#!/usr/bin/env node
/**
 * Copy tblSPBrand + tblSPBMod from hospitality → bannari_db.
 * Clones into every BAN* org with unique IDs (spb_id/spbm_id are global PKs).
 * BAN001 keeps original hospitality IDs (SPB001 / SPBM001); other orgs get ORG_SPB001.
 *
 * Usage: node scripts/copy-hosp-sp-brand-mod-to-bannari.js [--dry-run]
 */
require('dotenv').config();
const { Client } = require('pg');

const dryRun = process.argv.includes('--dry-run');

function hospitalityUrl() {
  if (process.env.HOSPITALITY_DATABASE_URL) return process.env.HOSPITALITY_DATABASE_URL;
  return process.env.DATABASE_URL.replace(/\/([^/?]+)(\?.*)?$/i, '/hospitality$2');
}

function idForOrg(baseId, orgId) {
  if (orgId === 'BAN001') return baseId;
  return `${orgId}_${baseId}`;
}

(async () => {
  const hosp = new Client({ connectionString: hospitalityUrl(), ssl: false });
  const ban = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
  await hosp.connect();
  await ban.connect();

  const hospDb = (await hosp.query('SELECT current_database() AS d')).rows[0].d;
  const banDb = (await ban.query('SELECT current_database() AS d')).rows[0].d;
  console.log(`Copy ${hospDb} → ${banDb}${dryRun ? ' (dry-run)' : ''}`);

  const orgs = (
    await ban.query(`SELECT org_id FROM "tblOrgs" WHERE org_id LIKE 'BAN%' ORDER BY org_id`)
  ).rows.map((r) => r.org_id);
  if (!orgs.length) throw new Error('No BAN* orgs found in bannari_db');

  const brands = (await hosp.query(`SELECT * FROM "tblSPBrand" ORDER BY spb_id`)).rows;
  const models = (await hosp.query(`SELECT * FROM "tblSPBMod" ORDER BY spbm_id`)).rows;
  console.log(`Source brands=${brands.length}, models=${models.length}; target orgs=${orgs.join(',')}`);

  if (dryRun) {
    console.log('Would insert', brands.length * orgs.length, 'brand rows and', models.length * orgs.length, 'model rows');
    await hosp.end();
    await ban.end();
    return;
  }

  await ban.query('BEGIN');
  try {
    let brandInserted = 0;
    let modelInserted = 0;

    for (const orgId of orgs) {
      for (const b of brands) {
        const spbId = idForOrg(b.spb_id, orgId);
        const r = await ban.query(
          `
            INSERT INTO "tblSPBrand" (
              spb_id, text, int_status, org_id, branch_id,
              created_by, created_on, changed_by, changed_on
            ) VALUES ($1,$2,$3,$4,NULL,$5,COALESCE($6, NOW()),$7,$8)
            ON CONFLICT (spb_id) DO UPDATE SET
              text = EXCLUDED.text,
              int_status = EXCLUDED.int_status,
              org_id = EXCLUDED.org_id,
              branch_id = NULL,
              changed_by = 'SYSTEM',
              changed_on = NOW()
            RETURNING spb_id
          `,
          [
            spbId,
            b.text,
            b.int_status ?? 1,
            orgId,
            b.created_by || 'SYSTEM',
            b.created_on || null,
            b.changed_by || 'SYSTEM',
            b.changed_on || null,
          ]
        );
        if (r.rowCount) brandInserted += 1;
      }

      for (const m of models) {
        const spbmId = idForOrg(m.spbm_id, orgId);
        const spbId = idForOrg(m.spb_id, orgId);
        const r = await ban.query(
          `
            INSERT INTO "tblSPBMod" (
              spbm_id, spb_id, text, int_status, org_id, branch_id,
              created_by, created_on, changed_by, changed_on
            ) VALUES ($1,$2,$3,$4,$5,NULL,$6,COALESCE($7, NOW()),$8,$9)
            ON CONFLICT (spbm_id) DO UPDATE SET
              spb_id = EXCLUDED.spb_id,
              text = EXCLUDED.text,
              int_status = EXCLUDED.int_status,
              org_id = EXCLUDED.org_id,
              branch_id = NULL,
              changed_by = 'SYSTEM',
              changed_on = NOW()
            RETURNING spbm_id
          `,
          [
            spbmId,
            spbId,
            m.text,
            m.int_status ?? 1,
            orgId,
            m.created_by || 'SYSTEM',
            m.created_on || null,
            m.changed_by || 'SYSTEM',
            m.changed_on || null,
          ]
        );
        if (r.rowCount) modelInserted += 1;
      }
    }

    await ban.query('COMMIT');

    const brandCounts = await ban.query(
      `SELECT org_id, COUNT(*)::int AS n FROM "tblSPBrand" WHERE org_id LIKE 'BAN%' GROUP BY org_id ORDER BY org_id`
    );
    const modelCounts = await ban.query(
      `SELECT org_id, COUNT(*)::int AS n FROM "tblSPBMod" WHERE org_id LIKE 'BAN%' GROUP BY org_id ORDER BY org_id`
    );
    console.log('Done', { brandInserted, modelInserted, brandCounts: brandCounts.rows, modelCounts: modelCounts.rows });
  } catch (e) {
    await ban.query('ROLLBACK');
    throw e;
  } finally {
    await hosp.end();
    await ban.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
