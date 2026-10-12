/**
 * Consumables module data access.
 *
 * Graph:
 *   tblConsumables 1──* tblConsumInven 1──* tblConsumeUsage
 *   Lookups: tblUom, tblBranches, tblDepartments
 *
 * Allocating usage deducts from tblConsumInven.quantity; balance is the
 * inventory quantity left after that allocation.
 */
const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId, generateCustomIdForClient } = require('../utils/idGenerator');
const { ensureConsumablesSchema } = require('../utils/ensureConsumablesSchema');

const getDb = () => getDbFromContext();

async function ensureSchema() {
  await ensureConsumablesSchema(getDb());
}

const STOCK_STATUS_SQL = `
  CASE
    WHEN i.quantity <= 0 THEN 'OUT_OF_STOCK'
    WHEN i.quantity <= i.reorder_level THEN 'REORDER'
    WHEN i.quantity <= i.min_stock THEN 'LOW_STOCK'
    ELSE 'OK'
  END`;

function toNumber(value, field, { allowZero = true } = {}) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0)) {
    throw new Error(`${field} must be a ${allowZero ? 'non-negative' : 'positive'} number`);
  }
  return n;
}

async function withTransaction(fn) {
  const client = await getDb().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Stock movement ledger (tblConsumInvenLog).
 * txn_type: OPENING | RESTOCK | ADJUSTMENT | ISSUE | ISSUE_EDIT | ISSUE_REVERSAL
 * qty_change is signed: positive adds to stock, negative removes.
 */
async function logStock(client, entry) {
  await client.query(
    `
      INSERT INTO "tblConsumInvenLog"
        (cinven_id, org_id, txn_type, qty_change, qty_before, qty_after,
         cusage_id, dept_id, reference, remarks, created_by, created_on)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
    `,
    [
      entry.cinven_id,
      entry.org_id || null,
      entry.txn_type,
      entry.qty_change,
      entry.qty_before ?? null,
      entry.qty_after ?? null,
      entry.cusage_id || null,
      entry.dept_id || null,
      entry.reference || null,
      entry.remarks || null,
      entry.user_id || null,
    ],
  );
}

// ── Lookups ────────────────────────────────────────────────────────────────

async function listLookups(orgId) {
  await ensureSchema();
  const db = getDb();
  const [uoms, branches, departments] = await Promise.all([
    db.query(`SELECT uom_id, uom FROM "tblUom" ORDER BY uom`),
    db.query(
      `
        SELECT branch_id, text AS branch_name
        FROM "tblBranches"
        WHERE ($1::text IS NULL OR org_id = $1)
          AND (int_status IS NULL OR int_status::text IN ('1', 'true'))
        ORDER BY text
      `,
      [orgId || null],
    ),
    db.query(
      `
        SELECT dept_id, text AS dept_name
        FROM "tblDepartments"
        WHERE ($1::text IS NULL OR org_id = $1)
          AND (int_status IS NULL OR int_status::text IN ('1', 'true'))
        ORDER BY text
      `,
      [orgId || null],
    ),
  ]);
  return { uoms: uoms.rows, branches: branches.rows, departments: departments.rows };
}

// ── tblConsumables ─────────────────────────────────────────────────────────

async function listConsumables({ orgId, branchId }) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT c.consum_id, c.consumable, c.uom_id, u.uom AS uom_name,
             c.org_id, c.branch_id, b.text AS branch_name,
             c.created_by, c.created_on, c.changed_by, c.changed_on,
             (SELECT COUNT(*)::int FROM "tblConsumInven" i WHERE i.consum_id = c.consum_id) AS inventory_count
      FROM "tblConsumables" c
      LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
      LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
      WHERE ($1::text IS NULL OR c.org_id = $1)
        AND ($2::text IS NULL OR c.branch_id = $2)
      ORDER BY c.consumable, c.consum_id
    `,
    [orgId || null, branchId || null],
  );
  return rows;
}

async function getConsumable(consumId, orgId) {
  const { rows } = await getDb().query(
    `
      SELECT c.*, u.uom AS uom_name, b.text AS branch_name
      FROM "tblConsumables" c
      LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
      LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
      WHERE c.consum_id = $1 AND ($2::text IS NULL OR c.org_id = $2)
    `,
    [consumId, orgId || null],
  );
  return rows[0] || null;
}

async function createConsumable({ consumable, uom_id, branch_id, org_id, user_id }) {
  await ensureSchema();
  if (!consumable?.trim()) throw new Error('Consumable name is required');
  if (!uom_id) throw new Error('UOM is required');
  if (!branch_id) throw new Error('Branch is required');
  if (!org_id) throw new Error('org_id is required');

  const consum_id = await generateCustomId('consumable', 3);
  await getDb().query(
    `
      INSERT INTO "tblConsumables"
        (consum_id, consumable, uom_id, org_id, branch_id, created_by, created_on)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    `,
    [consum_id, consumable.trim(), uom_id, org_id, branch_id || null, user_id || null],
  );
  return getConsumable(consum_id, org_id);
}

async function updateConsumable(consumId, { consumable, uom_id, branch_id, org_id, user_id }) {
  await ensureSchema();
  if (consumable !== undefined && !String(consumable).trim()) {
    throw new Error('Consumable name is required');
  }
  const result = await getDb().query(
    `
      UPDATE "tblConsumables"
      SET consumable = COALESCE($2, consumable),
          uom_id = COALESCE($3, uom_id),
          branch_id = COALESCE($4, branch_id),
          changed_by = $5,
          changed_on = CURRENT_TIMESTAMP
      WHERE consum_id = $1
        AND ($6::text IS NULL OR org_id = $6)
    `,
    [
      consumId,
      consumable?.trim() || null,
      uom_id || null,
      branch_id || null,
      user_id || null,
      org_id || null,
    ],
  );
  if (!result.rowCount) throw new Error('Consumable not found');
  return getConsumable(consumId, org_id);
}

async function deleteConsumable(consumId, orgId) {
  await ensureSchema();
  const kids = await getDb().query(
    `SELECT 1 FROM "tblConsumInven" WHERE consum_id = $1 LIMIT 1`,
    [consumId],
  );
  if (kids.rows.length) {
    throw new Error('Delete the inventory entries for this consumable first');
  }
  await getDb().query(
    `DELETE FROM "tblConsumables" WHERE consum_id = $1 AND ($2::text IS NULL OR org_id = $2)`,
    [consumId, orgId || null],
  );
  return { deleted: true };
}

// ── tblConsumInven ─────────────────────────────────────────────────────────

const INVENTORY_SELECT = `
  SELECT i.cinven_id, i.consum_id, c.consumable, c.uom_id, u.uom AS uom_name,
         c.branch_id, b.text AS branch_name,
         i.quantity, i.min_stock, i.reorder_level, i.brand, i.org_id,
         i.created_by, i.created_on, i.changed_by, i.changed_on,
         ${STOCK_STATUS_SQL} AS stock_status,
         lr.created_on AS last_restocked_on, lr.qty_change AS last_restocked_qty
  FROM "tblConsumInven" i
  LEFT JOIN LATERAL (
    SELECT l.created_on, l.qty_change
    FROM "tblConsumInvenLog" l
    WHERE l.cinven_id = i.cinven_id AND l.txn_type IN ('OPENING', 'RESTOCK')
    ORDER BY l.created_on DESC, l.log_id DESC
    LIMIT 1
  ) lr ON TRUE
  JOIN "tblConsumables" c ON c.consum_id = i.consum_id
  LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
  LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id`;

async function listInventory({ orgId, branchId, consumId }) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      ${INVENTORY_SELECT}
      WHERE ($1::text IS NULL OR i.org_id = $1)
        AND ($2::text IS NULL OR c.branch_id = $2)
        AND ($3::text IS NULL OR i.consum_id = $3)
      ORDER BY c.consumable, i.brand NULLS LAST, i.cinven_id
    `,
    [orgId || null, branchId || null, consumId || null],
  );
  return rows;
}

async function getInventory(cinvenId, orgId) {
  const { rows } = await getDb().query(
    `${INVENTORY_SELECT} WHERE i.cinven_id = $1 AND ($2::text IS NULL OR i.org_id = $2)`,
    [cinvenId, orgId || null],
  );
  return rows[0] || null;
}

function validateInventoryPayload(payload, { partial = false } = {}) {
  const quantity = toNumber(payload.quantity, 'Quantity');
  const min_stock = toNumber(payload.min_stock, 'Min stock');
  const reorder_level = toNumber(payload.reorder_level, 'Reorder level');
  if (!partial) {
    if (!payload.consum_id) throw new Error('Consumable is required');
    if (quantity === null) throw new Error('Quantity is required');
  }
  return { quantity, min_stock, reorder_level };
}

async function createInventory(payload) {
  await ensureSchema();
  const { quantity, min_stock, reorder_level } = validateInventoryPayload(payload);
  const parent = await getConsumable(payload.consum_id, payload.org_id);
  if (!parent) throw new Error('Consumable not found');

  const brand = payload.brand?.trim() || null;
  const reference = payload.reference?.trim() || null;
  const remarks = payload.remarks?.trim() || null;

  const result = await withTransaction(async (client) => {
    // One row per consumable + brand: restocking an existing brand tops up that row.
    const existing = await client.query(
      `
        SELECT cinven_id, quantity FROM "tblConsumInven"
        WHERE consum_id = $1
          AND LOWER(COALESCE(TRIM(brand), '')) = LOWER(COALESCE($2, ''))
          AND ($3::text IS NULL OR org_id = $3)
        ORDER BY created_on NULLS LAST, cinven_id
        LIMIT 1
        FOR UPDATE
      `,
      [payload.consum_id, brand, payload.org_id || null],
    );

    if (existing.rows.length) {
      const { cinven_id } = existing.rows[0];
      const before = Number(existing.rows[0].quantity);
      await client.query(
        `
          UPDATE "tblConsumInven"
          SET quantity = quantity + $2,
              min_stock = COALESCE($3, min_stock),
              reorder_level = COALESCE($4, reorder_level),
              changed_by = $5,
              changed_on = CURRENT_TIMESTAMP
          WHERE cinven_id = $1
        `,
        [cinven_id, quantity, min_stock, reorder_level, payload.user_id || null],
      );
      await logStock(client, {
        cinven_id,
        org_id: payload.org_id,
        txn_type: 'RESTOCK',
        qty_change: quantity,
        qty_before: before,
        qty_after: before + quantity,
        reference,
        remarks,
        user_id: payload.user_id,
      });
      return { cinven_id, restocked: true };
    }

    const cinven_id = await generateCustomIdForClient(client, 'consum_inven', 3);
    await client.query(
      `
        INSERT INTO "tblConsumInven"
          (cinven_id, consum_id, quantity, min_stock, reorder_level, brand, org_id, created_by, created_on)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      `,
      [
        cinven_id,
        payload.consum_id,
        quantity,
        min_stock ?? 0,
        reorder_level ?? 0,
        brand,
        payload.org_id,
        payload.user_id || null,
      ],
    );
    await logStock(client, {
      cinven_id,
      org_id: payload.org_id,
      txn_type: 'OPENING',
      qty_change: quantity,
      qty_before: 0,
      qty_after: quantity,
      reference,
      remarks,
      user_id: payload.user_id,
    });
    return { cinven_id, restocked: false };
  });

  const row = await getInventory(result.cinven_id, payload.org_id);
  return row && result.restocked ? { ...row, restocked: true } : row;
}

async function updateInventory(cinvenId, payload) {
  await ensureSchema();
  const { quantity, min_stock, reorder_level } = validateInventoryPayload(payload, { partial: true });

  await withTransaction(async (client) => {
    const before = await lockInventory(client, cinvenId, payload.org_id);
    await client.query(
      `
        UPDATE "tblConsumInven"
        SET quantity = COALESCE($2, quantity),
            min_stock = COALESCE($3, min_stock),
            reorder_level = COALESCE($4, reorder_level),
            brand = COALESCE($5, brand),
            changed_by = $6,
            changed_on = CURRENT_TIMESTAMP
        WHERE cinven_id = $1
      `,
      [cinvenId, quantity, min_stock, reorder_level, payload.brand?.trim() || null, payload.user_id || null],
    );
    if (quantity !== null && quantity !== before) {
      await logStock(client, {
        cinven_id: cinvenId,
        org_id: payload.org_id,
        txn_type: 'ADJUSTMENT',
        qty_change: quantity - before,
        qty_before: before,
        qty_after: quantity,
        remarks: payload.remarks?.trim() || null,
        user_id: payload.user_id,
      });
    }
  });

  return getInventory(cinvenId, payload.org_id);
}

async function getInventoryHistory(cinvenId, orgId) {
  await ensureSchema();
  const entry = await getInventory(cinvenId, orgId);
  if (!entry) throw new Error('Inventory entry not found');
  const { rows } = await getDb().query(
    `
      SELECT l.log_id, l.txn_type, l.qty_change, l.qty_before, l.qty_after,
             l.cusage_id, l.dept_id, d.text AS dept_name,
             l.reference, l.remarks, l.created_by, u.full_name AS created_by_name, l.created_on
      FROM "tblConsumInvenLog" l
      LEFT JOIN "tblDepartments" d ON d.dept_id = l.dept_id
      LEFT JOIN "tblUsers" u ON u.user_id = l.created_by
      WHERE l.cinven_id = $1
      ORDER BY l.created_on DESC, l.log_id DESC
    `,
    [cinvenId],
  );
  return { entry, logs: rows };
}

async function deleteInventory(cinvenId, orgId) {
  await ensureSchema();
  const kids = await getDb().query(
    `SELECT 1 FROM "tblConsumeUsage" WHERE cinven_id = $1 LIMIT 1`,
    [cinvenId],
  );
  if (kids.rows.length) {
    throw new Error('Delete the usage entries for this inventory first');
  }
  await getDb().query(
    `DELETE FROM "tblConsumInven" WHERE cinven_id = $1 AND ($2::text IS NULL OR org_id = $2)`,
    [cinvenId, orgId || null],
  );
  return { deleted: true };
}

// ── tblConsumeUsage ────────────────────────────────────────────────────────

const USAGE_SELECT = `
  SELECT g.cusage_id, g.cinven_id, g.allocated_qty, g.balance, g.dept_id,
         d.text AS dept_name, g.org_id,
         i.consum_id, c.consumable, i.brand, u.uom AS uom_name,
         c.branch_id, b.text AS branch_name,
         g.created_by, g.created_on, g.changed_by, g.changed_on
  FROM "tblConsumeUsage" g
  JOIN "tblConsumInven" i ON i.cinven_id = g.cinven_id
  JOIN "tblConsumables" c ON c.consum_id = i.consum_id
  LEFT JOIN "tblUom" u ON u.uom_id = c.uom_id
  LEFT JOIN "tblBranches" b ON b.branch_id = c.branch_id
  LEFT JOIN "tblDepartments" d ON d.dept_id = g.dept_id`;

async function listUsage({ orgId, branchId, cinvenId }) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      ${USAGE_SELECT}
      WHERE ($1::text IS NULL OR g.org_id = $1)
        AND ($2::text IS NULL OR c.branch_id = $2)
        AND ($3::text IS NULL OR g.cinven_id = $3)
      ORDER BY g.created_on DESC NULLS LAST, g.cusage_id DESC
    `,
    [orgId || null, branchId || null, cinvenId || null],
  );
  return rows;
}

async function getUsage(cusageId, orgId) {
  const { rows } = await getDb().query(
    `${USAGE_SELECT} WHERE g.cusage_id = $1 AND ($2::text IS NULL OR g.org_id = $2)`,
    [cusageId, orgId || null],
  );
  return rows[0] || null;
}

async function lockInventory(client, cinvenId, orgId) {
  const { rows } = await client.query(
    `
      SELECT cinven_id, quantity
      FROM "tblConsumInven"
      WHERE cinven_id = $1 AND ($2::text IS NULL OR org_id = $2)
      FOR UPDATE
    `,
    [cinvenId, orgId || null],
  );
  if (!rows[0]) throw new Error('Inventory entry not found');
  return Number(rows[0].quantity);
}

async function createUsage({ cinven_id, allocated_qty, dept_id, org_id, user_id }) {
  await ensureSchema();
  if (!cinven_id) throw new Error('Inventory is required');
  if (!dept_id) throw new Error('Department is required');
  const qty = toNumber(allocated_qty, 'Allocated quantity', { allowZero: false });
  if (qty === null) throw new Error('Allocated quantity is required');

  const cusage_id = await withTransaction(async (client) => {
    const available = await lockInventory(client, cinven_id, org_id);
    if (qty > available) {
      throw new Error(`Only ${available} available in stock`);
    }
    const balance = available - qty;
    await client.query(
      `UPDATE "tblConsumInven" SET quantity = $2, changed_by = $3, changed_on = CURRENT_TIMESTAMP WHERE cinven_id = $1`,
      [cinven_id, balance, user_id || null],
    );
    const id = await generateCustomIdForClient(client, 'consume_usage', 3);
    await client.query(
      `
        INSERT INTO "tblConsumeUsage"
          (cusage_id, cinven_id, allocated_qty, balance, dept_id, org_id, created_by, created_on)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `,
      [id, cinven_id, qty, balance, dept_id, org_id, user_id || null],
    );
    await logStock(client, {
      cinven_id,
      org_id,
      txn_type: 'ISSUE',
      qty_change: -qty,
      qty_before: available,
      qty_after: balance,
      cusage_id: id,
      dept_id,
      user_id,
    });
    return id;
  });

  return getUsage(cusage_id, org_id);
}

async function updateUsage(cusageId, { allocated_qty, dept_id, org_id, user_id }) {
  await ensureSchema();
  const qty = toNumber(allocated_qty, 'Allocated quantity', { allowZero: false });

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `
        SELECT cinven_id, allocated_qty, dept_id
        FROM "tblConsumeUsage"
        WHERE cusage_id = $1 AND ($2::text IS NULL OR org_id = $2)
        FOR UPDATE
      `,
      [cusageId, org_id || null],
    );
    const existing = rows[0];
    if (!existing) throw new Error('Usage entry not found');

    let balance = null;
    if (qty !== null && qty !== Number(existing.allocated_qty)) {
      const available = await lockInventory(client, existing.cinven_id, org_id);
      const delta = qty - Number(existing.allocated_qty);
      if (delta > available) {
        throw new Error(`Only ${available} more available in stock`);
      }
      balance = available - delta;
      await client.query(
        `UPDATE "tblConsumInven" SET quantity = $2, changed_by = $3, changed_on = CURRENT_TIMESTAMP WHERE cinven_id = $1`,
        [existing.cinven_id, balance, user_id || null],
      );
      await logStock(client, {
        cinven_id: existing.cinven_id,
        org_id,
        txn_type: 'ISSUE_EDIT',
        qty_change: -delta,
        qty_before: available,
        qty_after: balance,
        cusage_id: cusageId,
        dept_id: dept_id || existing.dept_id,
        remarks: `Allocation changed from ${Number(existing.allocated_qty)} to ${qty}`,
        user_id,
      });
    }

    await client.query(
      `
        UPDATE "tblConsumeUsage"
        SET allocated_qty = COALESCE($2, allocated_qty),
            balance = COALESCE($3, balance),
            dept_id = COALESCE($4, dept_id),
            changed_by = $5,
            changed_on = CURRENT_TIMESTAMP
        WHERE cusage_id = $1
      `,
      [cusageId, qty, balance, dept_id || null, user_id || null],
    );
  });

  return getUsage(cusageId, org_id);
}

async function deleteUsage(cusageId, { org_id, user_id }) {
  await ensureSchema();
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `
        DELETE FROM "tblConsumeUsage"
        WHERE cusage_id = $1 AND ($2::text IS NULL OR org_id = $2)
        RETURNING cinven_id, allocated_qty, dept_id
      `,
      [cusageId, org_id || null],
    );
    if (!rows[0]) throw new Error('Usage entry not found');
    const before = await lockInventory(client, rows[0].cinven_id, null);
    const returned = Number(rows[0].allocated_qty);
    await client.query(
      `
        UPDATE "tblConsumInven"
        SET quantity = quantity + $2, changed_by = $3, changed_on = CURRENT_TIMESTAMP
        WHERE cinven_id = $1
      `,
      [rows[0].cinven_id, returned, user_id || null],
    );
    await logStock(client, {
      cinven_id: rows[0].cinven_id,
      org_id,
      txn_type: 'ISSUE_REVERSAL',
      qty_change: returned,
      qty_before: before,
      qty_after: before + returned,
      cusage_id: cusageId,
      dept_id: rows[0].dept_id,
      remarks: 'Allocation deleted — quantity returned to stock',
      user_id,
    });
  });
  return { deleted: true };
}

// ── Dashboard alerts ───────────────────────────────────────────────────────

async function listStockAlerts({ orgId, branchId }) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT * FROM (
        ${INVENTORY_SELECT}
        WHERE ($1::text IS NULL OR i.org_id = $1)
          AND ($2::text IS NULL OR c.branch_id = $2)
      ) s
      WHERE s.stock_status <> 'OK'
      ORDER BY
        CASE s.stock_status WHEN 'OUT_OF_STOCK' THEN 0 WHEN 'REORDER' THEN 1 ELSE 2 END,
        s.consumable
    `,
    [orgId || null, branchId || null],
  );
  return rows;
}

module.exports = {
  listLookups,
  listConsumables,
  createConsumable,
  updateConsumable,
  deleteConsumable,
  listInventory,
  createInventory,
  updateInventory,
  deleteInventory,
  getInventoryHistory,
  listUsage,
  createUsage,
  updateUsage,
  deleteUsage,
  listStockAlerts,
};
