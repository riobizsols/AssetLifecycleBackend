#!/usr/bin/env node
/**
 * Seed Fire Safety + NABH audit types (org-shared), semantic AT mappings,
 * AUDITREPORT app + JR001 nav under Reports.
 *
 * Usage:
 *   node scripts/seed-audit-reports.js [db1 db2 ...]
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('pg');
const { ensureAuditTablesSchema } = require('../utils/ensureAuditTablesSchema');

const ALWAYS_INCLUDE = ['schema_db', 'hospitality', 'assetLifecycle', 'assetlifecycle'];

const AUDIT_TYPES = [
  {
    id: 'AUDTP001',
    description: 'Fire Safety',
    is_internal: true,
    // Prefer asset types that belong in a fire / life-safety audit
    namePatterns: [
      'fire',
      'extinguish',
      'alarm',
      'smoke',
      'hydrant',
      'sprinkler',
      'cctv',
      'emergency',
      'detector',
    ],
  },
  {
    id: 'AUDTP002',
    description: 'NABH Standards',
    is_internal: true,
    namePatterns: [
      'medical',
      'patient',
      'ventilat',
      'ecg',
      'hospital',
      'clinical',
      'biomed',
      'life support',
      'icu',
      'ot ',
      'nabh',
      'defibril',
      'monitor',
      'infusion',
    ],
  },
];

function dbUrl(name) {
  const base =
    process.env.TENANT_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.GENERIC_URL;
  if (!base) throw new Error('No database URL');
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${name}$2`);
}

async function listEamDatabases() {
  const admin = new Client({ connectionString: dbUrl('postgres'), ssl: false });
  await admin.connect();
  try {
    const { rows } = await admin.query(`
      SELECT datname FROM pg_database
      WHERE datistemplate = false AND datname NOT IN ('postgres')
      ORDER BY 1
    `);
    const eam = new Set(ALWAYS_INCLUDE);
    for (const { datname } of rows) {
      if (/_attdb$|^Attendence/i.test(datname)) continue;
      const client = new Client({ connectionString: dbUrl(datname), ssl: false });
      try {
        await client.connect();
        const check = await client.query(`SELECT to_regclass('public."tblAssets"') AS t`);
        if (check.rows[0]?.t) eam.add(datname);
      } catch (_) {
        /* skip */
      } finally {
        try {
          await client.end();
        } catch (_) {
          /* ignore */
        }
      }
    }
    return [...eam].sort();
  } finally {
    await admin.end();
  }
}

async function nextAudatmId(client, start) {
  let n = start;
  while (true) {
    const id = `AUDATM${String(n).padStart(3, '0')}`;
    const pk = await client.query(
      `SELECT 1 FROM "tblAuditATMapping" WHERE audatm_id = $1`,
      [id],
    );
    if (!pk.rows.length) return { id, next: n + 1 };
    n += 1;
  }
}

/**
 * Pick asset types that match audit semantics; if too few, fall back to
 * asset types that actually have maintenance / docs / breakdown history.
 */
async function resolveAssetTypesForAudit(client, auditDef) {
  const patterns = auditDef.namePatterns || [];
  const matched = new Set();

  if (patterns.length) {
    const clauses = patterns.map((_, i) => `LOWER(COALESCE(text, '')) LIKE $${i + 1}`);
    const params = patterns.map((p) => `%${p.toLowerCase()}%`);
    const { rows } = await client.query(
      `
        SELECT asset_type_id
        FROM "tblAssetTypes"
        WHERE COALESCE(int_status, 1) = 1
          AND (${clauses.join(' OR ')})
        ORDER BY text ASC, asset_type_id ASC
      `,
      params,
    );
    rows.forEach((r) => matched.add(r.asset_type_id));
  }

  if (matched.size < 2) {
    const { rows: withHistory } = await client.query(`
      SELECT a.asset_type_id
      FROM "tblAssets" a
      LEFT JOIN "tblAssetMaintSch" ams ON ams.asset_id = a.asset_id
      LEFT JOIN "tblAssetBRDet" br ON br.asset_id = a.asset_id
      LEFT JOIN "tblAssetDocs" ad
        ON ad.asset_id = a.asset_id AND COALESCE(ad.is_archived, false) = false
      GROUP BY a.asset_type_id
      HAVING COUNT(ams.ams_id) + COUNT(br.abr_id) + COUNT(ad.a_d_id) > 0
      ORDER BY
        COUNT(ams.ams_id) DESC,
        COUNT(br.abr_id) DESC,
        COUNT(ad.a_d_id) DESC,
        a.asset_type_id ASC
      LIMIT 8
    `);
    withHistory.forEach((r) => matched.add(r.asset_type_id));
  }

  if (matched.size === 0) {
    const { rows } = await client.query(`
      SELECT asset_type_id
      FROM "tblAssetTypes"
      WHERE COALESCE(int_status, 1) = 1
      ORDER BY asset_type_id
      LIMIT 6
    `);
    rows.forEach((r) => matched.add(r.asset_type_id));
  }

  return [...matched];
}

async function upsertMapping(client, audtpId, atId, mapSeqRef) {
  const shared = await client.query(
    `
      SELECT audatm_id FROM "tblAuditATMapping"
      WHERE audtp_id = $1 AND assettype_id = $2 AND org_id IS NULL
      LIMIT 1
    `,
    [audtpId, atId],
  );
  if (shared.rows.length) {
    await client.query(
      `
        UPDATE "tblAuditATMapping"
        SET int_status = 1, changed_on = CURRENT_TIMESTAMP, changed_by = 'SYSTEM'
        WHERE audatm_id = $1
      `,
      [shared.rows[0].audatm_id],
    );
    return mapSeqRef;
  }

  const any = await client.query(
    `
      SELECT audatm_id FROM "tblAuditATMapping"
      WHERE audtp_id = $1 AND assettype_id = $2
      ORDER BY audatm_id
      LIMIT 1
    `,
    [audtpId, atId],
  );
  if (any.rows.length) {
    await client.query(
      `
        UPDATE "tblAuditATMapping"
        SET org_id = NULL, int_status = 1, changed_on = CURRENT_TIMESTAMP, changed_by = 'SYSTEM'
        WHERE audatm_id = $1
      `,
      [any.rows[0].audatm_id],
    );
    return mapSeqRef;
  }

  const { id, next } = await nextAudatmId(client, mapSeqRef);
  await client.query(
    `
      INSERT INTO "tblAuditATMapping"
        (audatm_id, assettype_id, audtp_id, created_by, created_on, org_id, int_status)
      VALUES ($1, $2, $3, 'SYSTEM', CURRENT_TIMESTAMP, NULL, 1)
    `,
    [id, atId, audtpId],
  );
  return next;
}

async function seedDb(dbName) {
  const client = new Client({ connectionString: dbUrl(dbName), ssl: false });
  await client.connect();
  try {
    await ensureAuditTablesSchema(client);

    const orgRes = await client.query(
      `SELECT org_id FROM "tblOrgs" ORDER BY org_id LIMIT 1`,
    );
    const primaryOrg = orgRes.rows[0]?.org_id || null;

    for (const t of AUDIT_TYPES) {
      await client.query(
        `
          INSERT INTO "tblAuditType"
            (audtp_id, description, is_internal, created_by, created_on, org_id, int_status)
          VALUES ($1, $2, $3, 'SYSTEM', CURRENT_TIMESTAMP, NULL, 1)
          ON CONFLICT (audtp_id) DO UPDATE
          SET description = EXCLUDED.description,
              is_internal = EXCLUDED.is_internal,
              int_status = 1,
              org_id = NULL,
              changed_on = CURRENT_TIMESTAMP,
              changed_by = 'SYSTEM'
        `,
        [t.id, t.description, t.is_internal],
      );
    }

    let mapSeq = 1;
    for (const auditDef of AUDIT_TYPES) {
      const assetTypes = await resolveAssetTypesForAudit(client, auditDef);

      // Soft-disable previous mappings that are not in the semantic set
      if (assetTypes.length) {
        await client.query(
          `
            UPDATE "tblAuditATMapping"
            SET int_status = 0, changed_on = CURRENT_TIMESTAMP, changed_by = 'SYSTEM'
            WHERE audtp_id = $1
              AND assettype_id <> ALL($2::varchar[])
              AND COALESCE(int_status, 1) = 1
          `,
          [auditDef.id, assetTypes],
        );
      }

      for (const atId of assetTypes) {
        mapSeq = await upsertMapping(client, auditDef.id, atId, mapSeq);
      }
    }

    if (primaryOrg) {
      await client.query(
        `
          INSERT INTO "tblApps" (app_id, text, int_status, org_id)
          VALUES ('AUDITREPORT', 'Audit Reports', true, $1)
          ON CONFLICT (app_id) DO UPDATE
          SET text = EXCLUDED.text, int_status = true, org_id = EXCLUDED.org_id
        `,
        [primaryOrg],
      );

      const navExists = await client.query(
        `
          SELECT 1 FROM "tblJobRoleNav"
          WHERE job_role_id = 'JR001' AND app_id = 'AUDITREPORT'
          LIMIT 1
        `,
      );
      if (!navExists.rows.length) {
        const parent = await client.query(
          `
            SELECT job_role_nav_id FROM "tblJobRoleNav"
            WHERE job_role_id = 'JR001' AND label ILIKE 'Reports'
            ORDER BY sequence
            LIMIT 1
          `,
        );
        const parentId = parent.rows[0]?.job_role_nav_id || 'JRN012';
        const maxSeq = await client.query(
          `
            SELECT COALESCE(MAX(sequence), 0)::int AS s
            FROM "tblJobRoleNav"
            WHERE job_role_id = 'JR001' AND parent_id = $1
          `,
          [parentId],
        );
        const seq = (maxSeq.rows[0]?.s || 0) + 1;

        let jrnId = 'JRN062';
        for (let i = 62; i < 200; i += 1) {
          const candidate = `JRN${String(i).padStart(3, '0')}`;
          const hit = await client.query(
            `SELECT 1 FROM "tblJobRoleNav" WHERE job_role_nav_id = $1`,
            [candidate],
          );
          if (!hit.rows.length) {
            jrnId = candidate;
            break;
          }
        }

        await client.query(
          `
            INSERT INTO "tblJobRoleNav"
              (job_role_nav_id, job_role_id, parent_id, app_id, label, sequence, access_level, is_group, org_id, int_status, mob_desk)
            VALUES ($1, 'JR001', $2, 'AUDITREPORT', 'Audit Reports', $3, 'A', false, $4, 1, 'D')
          `,
          [jrnId, parentId, seq, primaryOrg],
        );
      }
    }

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM "tblAuditType" WHERE COALESCE(int_status,1)=1) AS types,
        (SELECT COUNT(*)::int FROM "tblAuditATMapping" WHERE COALESCE(int_status,1)=1) AS maps,
        (SELECT COUNT(*)::int FROM "tblApps" WHERE app_id = 'AUDITREPORT') AS apps,
        (SELECT COUNT(*)::int FROM "tblJobRoleNav" WHERE app_id = 'AUDITREPORT') AS nav
    `);

    const mapDetail = await client.query(`
      SELECT m.audtp_id, t.description, array_agg(at.text ORDER BY at.text) AS asset_types
      FROM "tblAuditATMapping" m
      JOIN "tblAuditType" t ON t.audtp_id = m.audtp_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.assettype_id
      WHERE COALESCE(m.int_status, 1) = 1
      GROUP BY m.audtp_id, t.description
      ORDER BY m.audtp_id
    `);

    return { ...counts.rows[0], mapDetail: mapDetail.rows };
  } finally {
    await client.end();
  }
}

async function main() {
  const explicit = process.argv.slice(2);
  const databases = explicit.length ? explicit : await listEamDatabases();
  console.log(`[seed-audit-reports] dbs (${databases.length}): ${databases.join(', ')}`);
  let ok = 0;
  let failed = 0;
  for (const db of databases) {
    try {
      const c = await seedDb(db);
      console.log(
        `  ${db}: types=${c.types} maps=${c.maps} app=${c.apps} nav=${c.nav}`,
      );
      for (const row of c.mapDetail || []) {
        console.log(
          `    ${row.description}: ${(row.asset_types || []).filter(Boolean).join(', ') || '(none)'}`,
        );
      }
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ${db}: FAILED ${err.message}`);
    }
  }
  console.log(`[seed-audit-reports] done. ok=${ok} failed=${failed}`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
