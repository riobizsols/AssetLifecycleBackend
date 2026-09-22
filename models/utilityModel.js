/**
 * Utility module data access.
 *
 * Graph:
 *   tblUtility_H 1──* tblUtility_D *──* tblAssetTypes (via tblATUtilityMap)
 *                      │
 *                      *── tblUtilConsumption
 *   Lookups (no UI): tblUTConsumType, tblUtilFreq, tblUom
 */
const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');
const {
  CONSUMPTION_TYPE,
  calculateMeterConsumption,
  buildConsumptionRecord,
} = require('../utils/utilityConsumptionLogic');
const { ensureUtilityHSchema } = require('../utils/ensureUtilityHSchema');

const getDb = () => getDbFromContext();

async function ensureSchema() {
  await ensureUtilityHSchema(getDb());
}

async function listHeaders(orgId) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT h.util_id, h.utility_name, h.org_id, h.uom_id, u.uom AS uom_name,
             (SELECT COUNT(*)::int FROM "tblUtility_D" d WHERE d.util_id = h.util_id) AS detail_count
      FROM "tblUtility_H" h
      LEFT JOIN "tblUom" u ON u.uom_id = h.uom_id
      WHERE ($1::text IS NULL OR h.org_id = $1)
      ORDER BY h.utility_name, h.util_id
    `,
    [orgId || null],
  );
  return rows;
}

async function getHeaderWithDetails(utilId, orgId) {
  await ensureSchema();
  const header = await getDb().query(
    `
      SELECT h.*, u.uom AS uom_name
      FROM "tblUtility_H" h
      LEFT JOIN "tblUom" u ON u.uom_id = h.uom_id
      WHERE h.util_id = $1
        AND ($2::text IS NULL OR h.org_id = $2)
    `,
    [utilId, orgId || null],
  );
  if (!header.rows[0]) return null;

  const details = await getDb().query(
    `
      SELECT d.*,
             ct.consumption_type,
             f.description AS frequency_label,
             f.freq AS frequency_days,
             u.uom AS uom_name
      FROM "tblUtility_D" d
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUtilFreq" f ON f.utfq_id = d.utfq_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      WHERE d.util_id = $1
      ORDER BY d.utility_sh, d.utild_id
    `,
    [utilId],
  );

  return { ...header.rows[0], details: details.rows };
}

async function createHeader({ utility_name, org_id, uom_id }) {
  await ensureSchema();
  if (!utility_name?.trim()) throw new Error('utility_name is required');
  if (!org_id) throw new Error('org_id is required');

  const util_id = await generateCustomId('utility_h', 3);
  await getDb().query(
    `
      INSERT INTO "tblUtility_H" (util_id, utility_name, org_id, uom_id)
      VALUES ($1, $2, $3, $4)
    `,
    [util_id, utility_name.trim(), org_id, uom_id || null],
  );
  return getHeaderWithDetails(util_id, org_id);
}

async function updateHeader(utilId, { utility_name, uom_id, org_id }) {
  await ensureSchema();
  await getDb().query(
    `
      UPDATE "tblUtility_H"
      SET utility_name = COALESCE($2, utility_name),
          uom_id = COALESCE($3, uom_id)
      WHERE util_id = $1
        AND ($4::text IS NULL OR org_id = $4)
    `,
    [utilId, utility_name?.trim() || null, uom_id ?? null, org_id || null],
  );
  return getHeaderWithDetails(utilId, org_id);
}

async function deleteHeader(utilId, orgId) {
  await ensureSchema();
  const kids = await getDb().query(
    `SELECT 1 FROM "tblUtility_D" WHERE util_id = $1 LIMIT 1`,
    [utilId],
  );
  if (kids.rows.length) {
    throw new Error('Delete utility details first');
  }
  await getDb().query(
    `DELETE FROM "tblUtility_H" WHERE util_id = $1 AND ($2::text IS NULL OR org_id = $2)`,
    [utilId, orgId || null],
  );
  return { deleted: true };
}

function validateDetailPayload(payload) {
  const utctp = String(payload.utctp_id || '').toUpperCase();
  if (!payload.utility_sh?.trim()) throw new Error('utility_sh is required');
  if (!payload.util_id) throw new Error('util_id is required');
  if (!payload.org_id) throw new Error('org_id is required');
  if (!payload.utfq_id) throw new Error('utfq_id is required');
  if (![CONSUMPTION_TYPE.METER, CONSUMPTION_TYPE.QUANTITY].includes(utctp)) {
    throw new Error('utctp_id must be UTCTP001 (meter) or UTCTP002 (quantity)');
  }
  if (utctp === CONSUMPTION_TYPE.METER) {
    const max = Number(payload.meter_max);
    if (![999, 9999].includes(max)) {
      throw new Error('meter_max must be 999 or 9999 for meter type');
    }
  }
}

async function createDetail(payload) {
  await ensureSchema();
  validateDetailPayload(payload);
  const utctp = String(payload.utctp_id).toUpperCase();
  const utild_id = await generateCustomId('utility_d', 3);
  const meter_max = utctp === CONSUMPTION_TYPE.METER ? Number(payload.meter_max) : null;

  await getDb().query(
    `
      INSERT INTO "tblUtility_D"
        (utild_id, utility_sh, utctp_id, org_id, uom_id, util_id, utfq_id, meter_max)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      utild_id,
      payload.utility_sh.trim(),
      utctp,
      payload.org_id,
      payload.uom_id || null,
      payload.util_id,
      payload.utfq_id,
      meter_max,
    ],
  );
  return getDetail(utild_id);
}

async function updateDetail(utildId, payload) {
  await ensureSchema();
  const existing = await getDetail(utildId);
  if (!existing) throw new Error('Utility detail not found');

  const merged = {
    ...existing,
    ...payload,
    utility_sh: payload.utility_sh ?? existing.utility_sh,
    utctp_id: payload.utctp_id ?? existing.utctp_id,
    util_id: existing.util_id,
    org_id: existing.org_id,
    utfq_id: payload.utfq_id ?? existing.utfq_id,
    meter_max: payload.meter_max ?? existing.meter_max,
  };
  validateDetailPayload(merged);
  const utctp = String(merged.utctp_id).toUpperCase();
  const meter_max = utctp === CONSUMPTION_TYPE.METER ? Number(merged.meter_max) : null;

  await getDb().query(
    `
      UPDATE "tblUtility_D"
      SET utility_sh = $2,
          utctp_id = $3,
          uom_id = $4,
          utfq_id = $5,
          meter_max = $6
      WHERE utild_id = $1
    `,
    [
      utildId,
      merged.utility_sh.trim(),
      utctp,
      merged.uom_id || null,
      merged.utfq_id,
      meter_max,
    ],
  );
  return getDetail(utildId);
}

async function getDetail(utildId) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT d.*,
             ct.consumption_type,
             f.description AS frequency_label,
             f.freq AS frequency_days,
             u.uom AS uom_name,
             h.utility_name
      FROM "tblUtility_D" d
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUtilFreq" f ON f.utfq_id = d.utfq_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      WHERE d.utild_id = $1
    `,
    [utildId],
  );
  return rows[0] || null;
}

async function listDetails(orgId) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT d.*,
             ct.consumption_type,
             f.description AS frequency_label,
             u.uom AS uom_name,
             h.utility_name
      FROM "tblUtility_D" d
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUtilFreq" f ON f.utfq_id = d.utfq_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      WHERE ($1::text IS NULL OR d.org_id = $1)
      ORDER BY h.utility_name, d.utility_sh
    `,
    [orgId || null],
  );
  return rows;
}

async function deleteDetail(utildId) {
  await ensureSchema();
  const maps = await getDb().query(
    `SELECT 1 FROM "tblATUtilityMap" WHERE utild_id = $1 LIMIT 1`,
    [utildId],
  );
  if (maps.rows.length) throw new Error('Remove asset-type mappings first');
  const cons = await getDb().query(
    `SELECT 1 FROM "tblUtilConsumption" WHERE utild_id = $1 LIMIT 1`,
    [utildId],
  );
  if (cons.rows.length) throw new Error('Cannot delete detail with consumption history');
  await getDb().query(`DELETE FROM "tblUtility_D" WHERE utild_id = $1`, [utildId]);
  return { deleted: true };
}

async function listLookups() {
  await ensureSchema();
  const [types, freqs, uoms] = await Promise.all([
    getDb().query(`SELECT utctp_id, consumption_type FROM "tblUTConsumType" ORDER BY utctp_id`),
    getDb().query(`SELECT utfq_id, freq, description FROM "tblUtilFreq" ORDER BY utfq_id`),
    getDb().query(`SELECT uom_id, uom FROM "tblUom" ORDER BY uom_id`),
  ]);
  return {
    consumptionTypes: types.rows,
    frequencies: freqs.rows,
    uoms: uoms.rows,
  };
}

async function listAssetTypes() {
  const { rows } = await getDb().query(
    `
      SELECT asset_type_id, text AS asset_type_name
      FROM "tblAssetTypes"
      WHERE COALESCE(int_status, 1) = 1
      ORDER BY text, asset_type_id
    `,
  );
  return rows;
}

async function listMappings(orgId) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT m.*,
             d.utility_sh,
             d.utctp_id,
             h.utility_name,
             at.text AS asset_type_name
      FROM "tblATUtilityMap" m
      JOIN "tblUtility_D" d ON d.utild_id = m.utild_id
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.assettype_id
      WHERE ($1::text IS NULL OR d.org_id = $1)
      ORDER BY h.utility_name, d.utility_sh, at.text
    `,
    [orgId || null],
  );
  return rows;
}

async function createMapping({ utild_id, assettype_id, created_by }) {
  await ensureSchema();
  if (!utild_id || !assettype_id) throw new Error('utild_id and assettype_id are required');
  const atum_id = await generateCustomId('at_utility_map', 3);
  await getDb().query(
    `
      INSERT INTO "tblATUtilityMap"
        (atum_id, utild_id, assettype_id, created_by, created_on)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `,
    [atum_id, utild_id, assettype_id, created_by || null],
  );
  const { rows } = await getDb().query(
    `SELECT * FROM "tblATUtilityMap" WHERE atum_id = $1`,
    [atum_id],
  );
  return rows[0];
}

async function deleteMapping(atumId) {
  await ensureSchema();
  await getDb().query(`DELETE FROM "tblATUtilityMap" WHERE atum_id = $1`, [atumId]);
  return { deleted: true };
}

async function listConsumptions({ orgId, utildId, limit = 100 } = {}) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT c.*,
             d.utility_sh,
             d.utctp_id,
             d.meter_max,
             ct.consumption_type,
             h.utility_name,
             u.uom AS uom_name
      FROM "tblUtilConsumption" c
      JOIN "tblUtility_D" d ON d.utild_id = c.utild_id
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      WHERE ($1::text IS NULL OR COALESCE(c.org_id, d.org_id) = $1)
        AND ($2::text IS NULL OR c.utild_id = $2)
      ORDER BY c.consumption_date DESC, c.created_on DESC
      LIMIT $3
    `,
    [orgId || null, utildId || null, Math.min(Number(limit) || 100, 500)],
  );
  return rows;
}

async function getPreviousReading(utildId, beforeDate) {
  const { rows } = await getDb().query(
    `
      SELECT reading, quantity_consumed, consumption_date, utcv_id
      FROM "tblUtilConsumption"
      WHERE utild_id = $1
        AND reading IS NOT NULL
        AND ($2::date IS NULL OR consumption_date <= $2::date)
      ORDER BY consumption_date DESC, created_on DESC
      LIMIT 1
    `,
    [utildId, beforeDate || null],
  );
  return rows[0] || null;
}

async function previewConsumption({ utild_id, reading, quantity_consumed, consumption_date }) {
  await ensureSchema();
  const detail = await getDetail(utild_id);
  if (!detail) throw new Error('Utility detail not found');

  const previous = await getPreviousReading(utild_id, consumption_date);
  const built = buildConsumptionRecord(detail, {
    reading,
    quantityConsumed: quantity_consumed,
    previousReading: previous?.reading,
    consumptionDate: consumption_date,
    firstReadingMode: 'baseline',
  });

  return {
    detail,
    previousReading: previous,
    preview: built,
  };
}

async function createConsumption(payload, userId) {
  await ensureSchema();
  const detail = await getDetail(payload.utild_id);
  if (!detail) throw new Error('Utility detail not found');
  if (!payload.consumption_date) throw new Error('consumption_date is required');

  const previous = await getPreviousReading(payload.utild_id, payload.consumption_date);
  const built = buildConsumptionRecord(detail, {
    reading: payload.reading,
    quantityConsumed: payload.quantity_consumed,
    previousReading: previous?.reading,
    consumptionDate: payload.consumption_date,
    firstReadingMode: payload.first_reading_mode || 'baseline',
  });

  const utcv_id = await generateCustomId('util_consumption', 3);
  await getDb().query(
    `
      INSERT INTO "tblUtilConsumption"
        (utcv_id, utild_id, reading, quantity_consumed, consumption_date,
         created_on, created_by, rolled_over, org_id)
      VALUES ($1,$2,$3,$4,$5, CURRENT_TIMESTAMP, $6, $7, $8)
    `,
    [
      utcv_id,
      built.utild_id,
      built.reading,
      built.quantity_consumed,
      built.consumption_date,
      userId || null,
      Boolean(built.rolled_over),
      detail.org_id,
    ],
  );

  const { rows } = await getDb().query(
    `
      SELECT c.*, d.utility_sh, d.meter_max, ct.consumption_type, h.utility_name
      FROM "tblUtilConsumption" c
      JOIN "tblUtility_D" d ON d.utild_id = c.utild_id
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      WHERE c.utcv_id = $1
    `,
    [utcv_id],
  );
  return rows[0];
}

module.exports = {
  listHeaders,
  getHeaderWithDetails,
  createHeader,
  updateHeader,
  deleteHeader,
  listDetails,
  getDetail,
  createDetail,
  updateDetail,
  deleteDetail,
  listLookups,
  listAssetTypes,
  listMappings,
  createMapping,
  deleteMapping,
  listConsumptions,
  getPreviousReading,
  previewConsumption,
  createConsumption,
  calculateMeterConsumption,
  CONSUMPTION_TYPE,
};
