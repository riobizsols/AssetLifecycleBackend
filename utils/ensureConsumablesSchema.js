/**
 * Ensure Consumables tables exist.
 * Safe to call during tenant align / create / API requests (idempotent).
 *
 * Spreadsheet:
 *   tblConsumables  — consum_id, consumable, uom_id, org_id, branch_id
 *   tblConsumInven  — cinven_id, consum_id, quantity, min_stock, reorder_level, brand
 *   tblConsumeUsage — cusage_id, cinven_id, allocated_qty, balance, dept_id
 *
 * Reorder level / min stock breaches surface as dashboard alerts.
 */

const CONSUMABLES_SCHEMA_LOCK_KEY = 87201402;

const inflightByPool = new WeakMap();
const readyByPool = new WeakMap();

function isBenignSchemaRace(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    err.code === '23505' ||
    err.code === '42P07' ||
    err.code === '42710' ||
    /already exists/i.test(msg) ||
    /duplicate key/i.test(msg) ||
    /pg_type_typname_nsp_index/i.test(msg)
  );
}

async function safeQuery(dbPool, sql, params) {
  try {
    return await dbPool.query(sql, params);
  } catch (err) {
    if (isBenignSchemaRace(err)) {
      return { rows: [], rowCount: 0, ignored: true };
    }
    throw err;
  }
}

const AUDIT_COLUMNS = `
      created_by    character varying(50),
      created_on    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by    character varying(50),
      changed_on    timestamp without time zone`;

const FOREIGN_KEYS = [
  {
    name: 'fk_tblConsumables_uom',
    sql: `ALTER TABLE "tblConsumables"
      ADD CONSTRAINT fk_tblConsumables_uom
      FOREIGN KEY (uom_id) REFERENCES "tblUom"(uom_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`,
  },
  {
    name: 'fk_tblConsumables_branch',
    sql: `ALTER TABLE "tblConsumables"
      ADD CONSTRAINT fk_tblConsumables_branch
      FOREIGN KEY (branch_id) REFERENCES "tblBranches"(branch_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`,
  },
  {
    name: 'fk_tblConsumInven_consum',
    sql: `ALTER TABLE "tblConsumInven"
      ADD CONSTRAINT fk_tblConsumInven_consum
      FOREIGN KEY (consum_id) REFERENCES "tblConsumables"(consum_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`,
  },
  {
    name: 'fk_tblConsumeUsage_cinven',
    sql: `ALTER TABLE "tblConsumeUsage"
      ADD CONSTRAINT fk_tblConsumeUsage_cinven
      FOREIGN KEY (cinven_id) REFERENCES "tblConsumInven"(cinven_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`,
  },
  {
    name: 'fk_tblConsumInvenLog_cinven',
    sql: `ALTER TABLE "tblConsumInvenLog"
      ADD CONSTRAINT fk_tblConsumInvenLog_cinven
      FOREIGN KEY (cinven_id) REFERENCES "tblConsumInven"(cinven_id)
      ON UPDATE CASCADE ON DELETE CASCADE`,
  },
  {
    name: 'fk_tblConsumeUsage_dept',
    sql: `ALTER TABLE "tblConsumeUsage"
      ADD CONSTRAINT fk_tblConsumeUsage_dept
      FOREIGN KEY (dept_id) REFERENCES "tblDepartments"(dept_id)
      ON UPDATE CASCADE ON DELETE RESTRICT`,
  },
];

async function runEnsureConsumablesSchema(dbPool) {
  let locked = false;
  try {
    await dbPool.query('SELECT pg_advisory_lock($1)', [CONSUMABLES_SCHEMA_LOCK_KEY]);
    locked = true;
  } catch (_) {
    /* advisory lock may be unavailable on some pools; continue with mutex alone */
  }

  try {
    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblConsumables" (
      consum_id     character varying(20) PRIMARY KEY,
      consumable    character varying(100) NOT NULL,
      uom_id        character varying(20),
      org_id        character varying(20) NOT NULL,
      branch_id     character varying(20),${AUDIT_COLUMNS}
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblConsumInven" (
      cinven_id      character varying(20) PRIMARY KEY,
      consum_id      character varying(20) NOT NULL,
      quantity       numeric(18,2) NOT NULL DEFAULT 0,
      min_stock      numeric(18,2) NOT NULL DEFAULT 0,
      reorder_level  numeric(18,2) NOT NULL DEFAULT 0,
      brand          character varying(100),
      org_id         character varying(20) NOT NULL,${AUDIT_COLUMNS}
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblConsumeUsage" (
      cusage_id      character varying(20) PRIMARY KEY,
      cinven_id      character varying(20) NOT NULL,
      allocated_qty  numeric(18,2) NOT NULL,
      balance        numeric(18,2) NOT NULL DEFAULT 0,
      dept_id        character varying(20),
      org_id         character varying(20) NOT NULL,${AUDIT_COLUMNS}
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblConsumInvenLog" (
      log_id       bigserial PRIMARY KEY,
      cinven_id    character varying(20) NOT NULL,
      org_id       character varying(20),
      txn_type     character varying(20) NOT NULL,
      qty_change   numeric(18,2) NOT NULL,
      qty_before   numeric(18,2),
      qty_after    numeric(18,2),
      cusage_id    character varying(20),
      dept_id      character varying(20),
      reference    character varying(100),
      remarks      character varying(255),
      created_by   character varying(50),
      created_on   timestamp without time zone DEFAULT CURRENT_TIMESTAMP
    )
  `,
    );

    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_tblConsumInvenLog_cinven ON "tblConsumInvenLog" (cinven_id, created_on)`,
      `CREATE INDEX IF NOT EXISTS idx_tblConsumables_org_branch ON "tblConsumables" (org_id, branch_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_tblConsumables_org_branch_name
         ON "tblConsumables" (org_id, COALESCE(branch_id, ''), LOWER(consumable))`,
      `CREATE INDEX IF NOT EXISTS idx_tblConsumInven_consum_id ON "tblConsumInven" (consum_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tblConsumInven_org_id ON "tblConsumInven" (org_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tblConsumeUsage_cinven_id ON "tblConsumeUsage" (cinven_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tblConsumeUsage_org_id ON "tblConsumeUsage" (org_id)`,
    ];
    for (const sql of indexes) {
      await safeQuery(dbPool, sql);
    }

    await safeQuery(
      dbPool,
      `
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname ILIKE 'chk_tblconsumeusage_allocated_qty') THEN
        ALTER TABLE "tblConsumeUsage"
          ADD CONSTRAINT chk_tblConsumeUsage_allocated_qty CHECK (allocated_qty > 0);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname ILIKE 'chk_tblconsuminven_quantity') THEN
        ALTER TABLE "tblConsumInven"
          ADD CONSTRAINT chk_tblConsumInven_quantity CHECK (quantity >= 0);
      END IF;
    END $$;
  `,
    );

    for (const fk of FOREIGN_KEYS) {
      try {
        const exists = await dbPool.query(
          `SELECT 1 FROM pg_constraint WHERE conname ILIKE $1 LIMIT 1`,
          [fk.name],
        );
        if (!exists.rows.length) {
          await safeQuery(dbPool, fk.sql);
        }
      } catch (err) {
        console.warn(`[ConsumablesSchema] ${fk.name} skipped:`, err.message);
      }
    }

    // Stock rows that predate the log get a reconstructed opening entry plus one entry per allocation.
    try {
      await safeQuery(
        dbPool,
        `
      WITH missing AS (
        SELECT i.cinven_id, i.org_id, i.quantity, i.created_by, i.created_on,
               COALESCE((SELECT SUM(g.allocated_qty) FROM "tblConsumeUsage" g WHERE g.cinven_id = i.cinven_id), 0) AS issued
        FROM "tblConsumInven" i
        WHERE NOT EXISTS (SELECT 1 FROM "tblConsumInvenLog" l WHERE l.cinven_id = i.cinven_id)
      ),
      opening AS (
        INSERT INTO "tblConsumInvenLog"
          (cinven_id, org_id, txn_type, qty_change, qty_before, qty_after, remarks, created_by, created_on)
        SELECT cinven_id, org_id, 'OPENING', quantity + issued, 0, quantity + issued,
               'Reconstructed from existing stock', created_by, COALESCE(created_on, CURRENT_TIMESTAMP)
        FROM missing
        RETURNING cinven_id
      )
      INSERT INTO "tblConsumInvenLog"
        (cinven_id, org_id, txn_type, qty_change, qty_before, qty_after, cusage_id, dept_id, created_by, created_on)
      SELECT g.cinven_id, g.org_id, 'ISSUE', -g.allocated_qty, g.balance + g.allocated_qty, g.balance,
             g.cusage_id, g.dept_id, g.created_by, COALESCE(g.created_on, CURRENT_TIMESTAMP)
      FROM "tblConsumeUsage" g
      WHERE g.cinven_id IN (SELECT cinven_id FROM missing)
    `,
      );
    } catch (err) {
      console.warn('[ConsumablesSchema] stock log backfill skipped:', err.message);
    }

    try {
      await safeQuery(
        dbPool,
        `
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES
        ('consumable', 'consum', 0),
        ('consum_inven', 'cinven', 0),
        ('consume_usage', 'cusage', 0)
      ON CONFLICT (table_key) DO NOTHING
    `,
      );
    } catch (_) {
      /* tblIDSequences may be missing on some partial DBs */
    }

    return { created: true };
  } finally {
    if (locked) {
      try {
        await dbPool.query('SELECT pg_advisory_unlock($1)', [CONSUMABLES_SCHEMA_LOCK_KEY]);
      } catch (_) {
        /* ignore unlock failures */
      }
    }
  }
}

async function ensureConsumablesSchema(dbPool) {
  if (!dbPool?.query) return { created: false };

  if (readyByPool.get(dbPool)) {
    return { created: false };
  }

  let pending = inflightByPool.get(dbPool);
  if (!pending) {
    pending = runEnsureConsumablesSchema(dbPool)
      .then((result) => {
        readyByPool.set(dbPool, true);
        return result;
      })
      .catch((err) => {
        if (isBenignSchemaRace(err)) {
          readyByPool.set(dbPool, true);
          return { created: false, raced: true };
        }
        throw err;
      })
      .finally(() => {
        inflightByPool.delete(dbPool);
      });
    inflightByPool.set(dbPool, pending);
  }

  return pending;
}

const CONSUMABLES_TABLES = ['tblConsumables', 'tblConsumInven', 'tblConsumeUsage', 'tblConsumInvenLog'];

module.exports = {
  CONSUMABLES_TABLES,
  ensureConsumablesSchema,
};
