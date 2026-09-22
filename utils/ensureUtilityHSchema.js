/**
 * Ensure Utility Header + Consumption Type + Frequency tables exist.
 * Safe to call during tenant align / create / API requests.
 *
 * Concurrent requests can race on CREATE TABLE (pg_type_typname_nsp_index).
 * We serialize with an advisory lock + in-process mutex, and ignore
 * "already exists" / duplicate-type errors so callers never 500.
 *
 * Spreadsheet:
 *   tblUtility_H     — util_id, utility_name, org_id, uom_id (FK → tblUom)
 *   tblUTConsumType  — utctp_id, consumption_type (NO UI; seeded)
 *   tblUtilFreq      — utfq_id, freq, description (NO UI; seeded)
 *   tblUtility_D     — measurement details
 *   tblATUtilityMap  — asset-type mapping
 *   tblUtilConsumption — consumption records
 */
const UTILITY_UOM_DEFAULTS = [
  { id: 'UOM007', name: 'kWh' },
  { id: 'UOM008', name: 'Litre' },
  { id: 'UOM009', name: 'Cubic Metre' },
  { id: 'UOM010', name: 'kg' },
  { id: 'UOM011', name: 'Cylinder' },
  { id: 'UOM012', name: 'Unit' },
];

/** Stable advisory-lock key for utility DDL (must not collide with other locks). */
const UTILITY_SCHEMA_LOCK_KEY = 87201401;

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

async function ensureUtilityUoms(dbPool) {
  for (const uom of UTILITY_UOM_DEFAULTS) {
    await safeQuery(
      dbPool,
      `
        INSERT INTO "tblUom" (uom_id, uom)
        VALUES ($1, $2)
        ON CONFLICT (uom_id) DO UPDATE
          SET uom = EXCLUDED.uom
      `,
      [uom.id, uom.name],
    );
  }
}

async function runEnsureUtilityHSchema(dbPool) {
  let locked = false;
  try {
    await dbPool.query('SELECT pg_advisory_lock($1)', [UTILITY_SCHEMA_LOCK_KEY]);
    locked = true;
  } catch (_) {
    /* advisory lock may be unavailable on some pools; continue with mutex alone */
  }

  try {
    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblUtility_H" (
      util_id       character varying(20) PRIMARY KEY,
      utility_name  character varying(100) NOT NULL,
      org_id        character varying(20) NOT NULL,
      uom_id        character varying(20)
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    ALTER TABLE "tblUtility_H"
      ADD COLUMN IF NOT EXISTS uom_id character varying(20)
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtility_H_org_id
      ON "tblUtility_H" (org_id)
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtility_H_uom_id
      ON "tblUtility_H" (uom_id)
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblUtility_H_org_name
      ON "tblUtility_H" (org_id, utility_name)
  `,
    );

    try {
      await ensureUtilityUoms(dbPool);
      await safeQuery(
        dbPool,
        `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname ILIKE 'fk_tblutility_h_uom'
        ) THEN
          ALTER TABLE "tblUtility_H"
            ADD CONSTRAINT fk_tblUtility_H_uom
            FOREIGN KEY (uom_id) REFERENCES "tblUom"(uom_id)
            ON UPDATE CASCADE ON DELETE RESTRICT;
        END IF;
      END $$;
    `,
      );
    } catch (err) {
      console.warn('[UtilitySchema] tblUom seed/FK skipped:', err.message);
    }

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblUTConsumType" (
      utctp_id           character varying(20) PRIMARY KEY,
      consumption_type   character varying(50) NOT NULL
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblUTConsumType_consumption_type
      ON "tblUTConsumType" (consumption_type)
  `,
    );

    await safeQuery(
      dbPool,
      `
    INSERT INTO "tblUTConsumType" (utctp_id, consumption_type)
    VALUES
      ('UTCTP001', 'meter'),
      ('UTCTP002', 'quantity')
    ON CONFLICT (utctp_id) DO UPDATE
      SET consumption_type = EXCLUDED.consumption_type
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblUtilFreq" (
      utfq_id       character varying(20) PRIMARY KEY,
      freq          integer NOT NULL,
      description   character varying(50) NOT NULL
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblUtilFreq_description
      ON "tblUtilFreq" (description)
  `,
    );

    await safeQuery(
      dbPool,
      `
    INSERT INTO "tblUtilFreq" (utfq_id, freq, description)
    VALUES
      ('uf001', 1,   'Daily'),
      ('uf002', 7,   'Weekly'),
      ('uf003', 30,  'Monthly'),
      ('uf004', 180, 'Halfyearly'),
      ('uf005', 0,   'OnActualUsage')
    ON CONFLICT (utfq_id) DO UPDATE
      SET freq = EXCLUDED.freq,
          description = EXCLUDED.description
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblUtility_D" (
      utild_id     character varying(20) PRIMARY KEY,
      utility_sh   character varying(100) NOT NULL,
      utctp_id     character varying(20) NOT NULL,
      org_id       character varying(20) NOT NULL,
      uom_id       character varying(20),
      util_id      character varying(20) NOT NULL,
      utfq_id      character varying(20) NOT NULL,
      meter_max    integer
    )
  `,
    );

    await safeQuery(
      dbPool,
      `
    ALTER TABLE "tblUtility_D"
      ADD COLUMN IF NOT EXISTS meter_max integer
  `,
    );

    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtility_D_util_id
      ON "tblUtility_D" (util_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtility_D_org_id
      ON "tblUtility_D" (org_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtility_D_utctp_id
      ON "tblUtility_D" (utctp_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblUtility_D_org_sh
      ON "tblUtility_D" (org_id, utility_sh)
  `,
    );

    await safeQuery(
      dbPool,
      `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname ILIKE 'chk_tblutility_d_meter_max'
      ) THEN
        ALTER TABLE "tblUtility_D"
          ADD CONSTRAINT chk_tblUtility_D_meter_max
          CHECK (
            meter_max IS NULL
            OR meter_max IN (999, 9999)
          );
      END IF;
    END $$;
  `,
    );

    const detailFks = [
      {
        name: 'fk_tblUtility_D_util',
        sql: `ALTER TABLE "tblUtility_D"
        ADD CONSTRAINT fk_tblUtility_D_util
        FOREIGN KEY (util_id) REFERENCES "tblUtility_H"(util_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
      {
        name: 'fk_tblUtility_D_utctp',
        sql: `ALTER TABLE "tblUtility_D"
        ADD CONSTRAINT fk_tblUtility_D_utctp
        FOREIGN KEY (utctp_id) REFERENCES "tblUTConsumType"(utctp_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
      {
        name: 'fk_tblUtility_D_utfq',
        sql: `ALTER TABLE "tblUtility_D"
        ADD CONSTRAINT fk_tblUtility_D_utfq
        FOREIGN KEY (utfq_id) REFERENCES "tblUtilFreq"(utfq_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
      {
        name: 'fk_tblUtility_D_uom',
        sql: `ALTER TABLE "tblUtility_D"
        ADD CONSTRAINT fk_tblUtility_D_uom
        FOREIGN KEY (uom_id) REFERENCES "tblUom"(uom_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
    ];

    for (const fk of detailFks) {
      try {
        const exists = await dbPool.query(
          `SELECT 1 FROM pg_constraint WHERE conname ILIKE $1 LIMIT 1`,
          [fk.name],
        );
        if (!exists.rows.length) {
          await safeQuery(dbPool, fk.sql);
        }
      } catch (err) {
        console.warn(`[UtilitySchema] ${fk.name} skipped:`, err.message);
      }
    }

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblATUtilityMap" (
      atum_id       character varying(20) PRIMARY KEY,
      utild_id      character varying(20) NOT NULL,
      assettype_id  character varying(20) NOT NULL,
      created_by    character varying(50),
      created_on    timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      changed_by    character varying(50),
      changed_on    timestamp without time zone
    )
  `,
    );

    const mapAlters = [
      ['created_by', 'character varying(50)'],
      ['created_on', 'timestamp without time zone DEFAULT CURRENT_TIMESTAMP'],
      ['changed_by', 'character varying(50)'],
      ['changed_on', 'timestamp without time zone'],
    ];
    for (const [col, ddl] of mapAlters) {
      await safeQuery(
        dbPool,
        `ALTER TABLE "tblATUtilityMap" ADD COLUMN IF NOT EXISTS "${col}" ${ddl}`,
      );
    }

    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblATUtilityMap_utild_id
      ON "tblATUtilityMap" (utild_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblATUtilityMap_assettype_id
      ON "tblATUtilityMap" (assettype_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE UNIQUE INDEX IF NOT EXISTS uq_tblATUtilityMap_utild_assettype
      ON "tblATUtilityMap" (utild_id, assettype_id)
  `,
    );

    const mapFks = [
      {
        name: 'fk_tblATUtilityMap_utild',
        sql: `ALTER TABLE "tblATUtilityMap"
        ADD CONSTRAINT fk_tblATUtilityMap_utild
        FOREIGN KEY (utild_id) REFERENCES "tblUtility_D"(utild_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
      {
        name: 'fk_tblATUtilityMap_assettype',
        sql: `ALTER TABLE "tblATUtilityMap"
        ADD CONSTRAINT fk_tblATUtilityMap_assettype
        FOREIGN KEY (assettype_id) REFERENCES "tblAssetTypes"(asset_type_id)
        ON UPDATE CASCADE ON DELETE RESTRICT`,
      },
    ];

    for (const fk of mapFks) {
      try {
        const exists = await dbPool.query(
          `SELECT 1 FROM pg_constraint WHERE conname ILIKE $1 LIMIT 1`,
          [fk.name],
        );
        if (!exists.rows.length) {
          await safeQuery(dbPool, fk.sql);
        }
      } catch (err) {
        console.warn(`[UtilitySchema] ${fk.name} skipped:`, err.message);
      }
    }

    await safeQuery(
      dbPool,
      `
    CREATE TABLE IF NOT EXISTS "tblUtilConsumption" (
      utcv_id             character varying(20) PRIMARY KEY,
      utild_id            character varying(20) NOT NULL,
      reading             numeric(18,4),
      quantity_consumed   numeric(18,4),
      consumption_date    date NOT NULL,
      created_on          timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
      created_by          character varying(50),
      rolled_over         boolean NOT NULL DEFAULT false,
      org_id              character varying(20)
    )
  `,
    );

    const consAlters = [
      ['reading', 'numeric(18,4)'],
      ['quantity_consumed', 'numeric(18,4)'],
      ['consumption_date', 'date'],
      ['created_on', 'timestamp without time zone DEFAULT CURRENT_TIMESTAMP'],
      ['created_by', 'character varying(50)'],
      ['rolled_over', 'boolean NOT NULL DEFAULT false'],
      ['org_id', 'character varying(20)'],
    ];
    for (const [col, ddl] of consAlters) {
      await safeQuery(
        dbPool,
        `ALTER TABLE "tblUtilConsumption" ADD COLUMN IF NOT EXISTS "${col}" ${ddl}`,
      );
    }

    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtilConsumption_utild_id
      ON "tblUtilConsumption" (utild_id)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtilConsumption_date
      ON "tblUtilConsumption" (consumption_date DESC)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtilConsumption_utild_date
      ON "tblUtilConsumption" (utild_id, consumption_date DESC)
  `,
    );
    await safeQuery(
      dbPool,
      `
    CREATE INDEX IF NOT EXISTS idx_tblUtilConsumption_org_id
      ON "tblUtilConsumption" (org_id)
  `,
    );

    try {
      const exists = await dbPool.query(
        `SELECT 1 FROM pg_constraint WHERE conname ILIKE $1 LIMIT 1`,
        ['fk_tblUtilConsumption_utild'],
      );
      if (!exists.rows.length) {
        await safeQuery(
          dbPool,
          `
        ALTER TABLE "tblUtilConsumption"
          ADD CONSTRAINT fk_tblUtilConsumption_utild
          FOREIGN KEY (utild_id) REFERENCES "tblUtility_D"(utild_id)
          ON UPDATE CASCADE ON DELETE RESTRICT
      `,
        );
      }
    } catch (err) {
      console.warn('[UtilitySchema] fk_tblUtilConsumption_utild skipped:', err.message);
    }

    try {
      await safeQuery(
        dbPool,
        `
      INSERT INTO "tblIDSequences" (table_key, prefix, last_number)
      VALUES
        ('utility_h', 'UTIL', 0),
        ('ut_consum_type', 'UTCTP', 2),
        ('util_freq', 'uf', 5),
        ('utility_d', 'utild', 0),
        ('at_utility_map', 'ATUM', 0),
        ('util_consumption', 'utcv', 0)
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
        await dbPool.query('SELECT pg_advisory_unlock($1)', [UTILITY_SCHEMA_LOCK_KEY]);
      } catch (_) {
        /* ignore unlock failures */
      }
    }
  }
}

async function ensureUtilityHSchema(dbPool) {
  if (!dbPool?.query) return { created: false };

  if (readyByPool.get(dbPool)) {
    return { created: false };
  }

  let pending = inflightByPool.get(dbPool);
  if (!pending) {
    pending = runEnsureUtilityHSchema(dbPool)
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

const ensureUtilityTablesSchema = ensureUtilityHSchema;

module.exports = {
  UTILITY_UOM_DEFAULTS,
  ensureUtilityUoms,
  ensureUtilityHSchema,
  ensureUtilityTablesSchema,
};
