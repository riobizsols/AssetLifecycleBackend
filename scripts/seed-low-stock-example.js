/**
 * Seed one low-stock spare category for Stock & Purchase demo (NGP).
 * Available > 0 but below reorder level → "Needs purchase".
 *
 * Usage: node scripts/seed-low-stock-example.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

function tenantUrl(dbName) {
  const base = process.env.TENANT_DATABASE_URL || process.env.DATABASE_URL;
  return base.replace(/\/([^/?]+)(\?.*)?$/i, `/${dbName}$2`);
}

(async () => {
  const pool = new Pool({ connectionString: tenantUrl('ngp_db'), ssl: false });
  const client = await pool.connect();
  try {
    const cats = await client.query(`
      SELECT c.spc_id, c.text, c.uom, c.minimum_stock, c.re_order_level, c.org_id, c.branch_id,
             COALESCE(COUNT(ind.spid_id) FILTER (WHERE COALESCE(ind.is_used, 0) = 0), 0)::int AS available
        FROM "tblSPCategory" c
        LEFT JOIN "tblSPIndDet" ind
          ON ind.spc_id = c.spc_id AND ind.org_id = c.org_id
       WHERE c.org_id = 'ORG003'
         AND COALESCE(c.int_status, 1) = 1
       GROUP BY c.spc_id, c.text, c.uom, c.minimum_stock, c.re_order_level, c.org_id, c.branch_id
       ORDER BY c.spc_id
    `);
    console.log('NGP categories before:', cats.rows);

    const branch = await client.query(`
      SELECT branch_id, text
        FROM "tblBranches"
       WHERE org_id = 'ORG003' AND COALESCE(int_status, 1) = 1
       ORDER BY branch_id
       LIMIT 1
    `);
    const branchId = branch.rows[0]?.branch_id || null;
    console.log('Using branch:', branch.rows[0] || null);

    await client.query('BEGIN');

    const nextId = await client.query(`
      SELECT COALESCE(
        (SELECT MAX(CAST(SUBSTRING(spc_id FROM 4) AS int))
           FROM "tblSPCategory"
          WHERE spc_id ~ '^SPC[0-9]+$'),
        0
      ) + 1 AS n
    `);
    const n = Number(nextId.rows[0].n) || 4;
    const spcId = `SPC${String(n).padStart(3, '0')}`;

    // 2 available, reorder 10, min 5 → Needs purchase (not out of stock)
    const existing = await client.query(
      `SELECT spc_id FROM "tblSPCategory" WHERE spc_id = $1`,
      [spcId],
    );
    if (existing.rows.length) {
      await client.query(
        `
        UPDATE "tblSPCategory"
           SET text = 'Drive belts (demo low stock)',
               uom = 'PCS',
               minimum_stock = 5,
               re_order_level = 10,
               int_status = 1,
               org_id = 'ORG003',
               branch_id = $2,
               changed_on = CURRENT_TIMESTAMP
         WHERE spc_id = $1
        `,
        [spcId, branchId],
      );
    } else {
      await client.query(
        `
        INSERT INTO "tblSPCategory" (
          spc_id, text, uom, minimum_stock, re_order_level, int_status,
          org_id, branch_id, created_on, changed_on
        ) VALUES (
          $1, 'Drive belts (demo low stock)', 'PCS', 5, 10, 1,
          'ORG003', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        `,
        [spcId, branchId],
      );
    }

    await client.query(`DELETE FROM "tblSPIndDet" WHERE spc_id = $1 AND org_id = 'ORG003'`, [spcId]);
    await client.query(`DELETE FROM "tblSPLotDet" WHERE spc_id = $1 AND org_id = 'ORG003'`, [spcId]);

    const lotSeq = await client.query(`
      SELECT COALESCE(
        (SELECT MAX(CAST(SUBSTRING(spld_id FROM 5) AS int))
           FROM "tblSPLotDet"
          WHERE spld_id ~ '^SPLD[0-9]+$'),
        0
      ) + 1 AS n
    `);
    const lotN = Number(lotSeq.rows[0].n) || 1;
    const spldId = `SPLD${String(lotN).padStart(3, '0')}`;

    await client.query(
      `
      INSERT INTO "tblSPLotDet" (
        spld_id, spc_id, quantity, unit_price, remarks,
        org_id, branch_id, created_on, changed_on
      ) VALUES (
        $1, $2, 2, 0, 'Demo low-stock seed',
        'ORG003', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      `,
      [spldId, spcId, branchId],
    );

    const indSeq = await client.query(`
      SELECT COALESCE(
        (SELECT MAX(CAST(SUBSTRING(spid_id FROM 5) AS int))
           FROM "tblSPIndDet"
          WHERE spid_id ~ '^SPID[0-9]+$'),
        0
      ) + 1 AS n
    `);
    const indN = Number(indSeq.rows[0].n) || 1;

    for (let i = 0; i < 2; i += 1) {
      const spidId = `SPID${String(indN + i).padStart(3, '0')}`;
      await client.query(
        `
        INSERT INTO "tblSPIndDet" (
          spid_id, spld_id, spc_id, serial_number, is_used,
          org_id, branch_id, created_on, changed_on
        ) VALUES (
          $1, $2, $3, $4, 0,
          'ORG003', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
        `,
        [spidId, spldId, spcId, `DEMO-LOW-${i + 1}`, branchId],
      );
    }

    await client.query(
      `
      UPDATE "tblIDSequences"
         SET last_number = GREATEST(last_number, $1)
       WHERE table_key = 'sp_category'
      `,
      [n],
    );
    await client.query(
      `
      UPDATE "tblIDSequences"
         SET last_number = GREATEST(last_number, $1)
       WHERE table_key = 'sp_lot_det'
      `,
      [lotN],
    );
    await client.query(
      `
      UPDATE "tblIDSequences"
         SET last_number = GREATEST(last_number, $1)
       WHERE table_key = 'sp_ind_det'
      `,
      [indN + 1],
    );

    await client.query('COMMIT');

    const after = await client.query(
      `
      SELECT c.spc_id, c.text, c.minimum_stock, c.re_order_level,
             COALESCE(COUNT(ind.spid_id) FILTER (WHERE COALESCE(ind.is_used, 0) = 0), 0)::int AS available
        FROM "tblSPCategory" c
        LEFT JOIN "tblSPIndDet" ind
          ON ind.spc_id = c.spc_id AND ind.org_id = c.org_id
       WHERE c.org_id = 'ORG003' AND c.spc_id = $1
       GROUP BY c.spc_id, c.text, c.minimum_stock, c.re_order_level
      `,
      [spcId],
    );
    console.log('Seeded low-stock part:', after.rows[0]);
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
