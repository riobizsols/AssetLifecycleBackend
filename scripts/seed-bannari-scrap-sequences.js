require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

/**
 * Seed tblWFScrapSeq for all Bannari asset types that are missing scrap workflows.
 * Prefers copying from tblWFATSeqs; otherwise uses org step WFS-{org}-01 (seq 10).
 */
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const types = await c.query(`
    SELECT at.asset_type_id, at.org_id
    FROM "tblAssetTypes" at
    WHERE at.org_id LIKE 'BAN%'
      AND NOT EXISTS (
        SELECT 1 FROM "tblWFScrapSeq" s
        WHERE s.asset_type_id = at.asset_type_id AND s.org_id = at.org_id
      )
    ORDER BY at.org_id, at.asset_type_id
  `);

  let inserted = 0;
  let fromMaint = 0;
  let fromDefault = 0;
  let skipped = 0;

  for (const row of types.rows) {
    const { asset_type_id, org_id } = row;
    const maint = await c.query(
      `
        SELECT wf_steps_id, seqs_no
        FROM "tblWFATSeqs"
        WHERE asset_type_id = $1 AND org_id = $2
        ORDER BY seqs_no ASC
      `,
      [asset_type_id, org_id]
    );

    let steps = maint.rows.map((r) => ({
      wf_steps_id: r.wf_steps_id,
      seq_no: Number(r.seqs_no) || 10,
    }));

    if (!steps.length) {
      const defaultStep = `WFS-${org_id}-01`;
      const exists = await c.query(
        `SELECT 1 FROM "tblWFSteps" WHERE wf_steps_id = $1 AND org_id = $2 LIMIT 1`,
        [defaultStep, org_id]
      );
      if (!exists.rows.length) {
        skipped += 1;
        continue;
      }
      steps = [{ wf_steps_id: defaultStep, seq_no: 10 }];
      fromDefault += 1;
    } else {
      fromMaint += 1;
    }

    for (const step of steps) {
      const id = `WFSCQ_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      await c.query(
        `
          INSERT INTO "tblWFScrapSeq" (id, asset_type_id, wf_steps_id, seq_no, org_id)
          SELECT $1::varchar, $2::varchar, $3::varchar, $4::int, $5::varchar
          WHERE NOT EXISTS (
            SELECT 1 FROM "tblWFScrapSeq"
            WHERE asset_type_id = $2::varchar
              AND org_id = $5::varchar
              AND wf_steps_id = $3::varchar
              AND seq_no = $4::int
          )
        `,
        [id, asset_type_id, step.wf_steps_id, step.seq_no, org_id]
      );
      inserted += 1;
    }
  }

  const totals = await c.query(`
    SELECT org_id, COUNT(*)::int AS cnt FROM "tblWFScrapSeq" WHERE org_id LIKE 'BAN%' GROUP BY org_id ORDER BY org_id
  `);
  console.log({
    typesMissing: types.rows.length,
    inserted,
    typesFromMaint: fromMaint,
    typesFromDefault: fromDefault,
    skipped,
    totals: totals.rows,
  });

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
