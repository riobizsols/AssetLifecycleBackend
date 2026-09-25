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

async function getPreviousReading(utildId, beforeDate, assetId = null) {
  const { rows } = await getDb().query(
    `
      SELECT reading, start_reading, quantity_consumed, consumption_date, utcv_id, asset_id
      FROM "tblUtilConsumption"
      WHERE utild_id = $1
        AND reading IS NOT NULL
        AND ($2::date IS NULL OR consumption_date <= $2::date)
        AND (
          $3::text IS NULL
          OR asset_id = $3
          OR ($3::text IS NOT NULL AND asset_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM "tblUtilConsumption" x
            WHERE x.utild_id = $1 AND x.asset_id = $3 AND x.reading IS NOT NULL
          ))
        )
      ORDER BY consumption_date DESC, created_on DESC
      LIMIT 1
    `,
    [utildId, beforeDate || null, assetId || null],
  );
  return rows[0] || null;
}

async function previewConsumption({ utild_id, reading, quantity_consumed, consumption_date, asset_id }) {
  await ensureSchema();
  const detail = await getDetail(utild_id);
  if (!detail) throw new Error('Utility detail not found');

  const previous = await getPreviousReading(utild_id, consumption_date, asset_id || null);
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

async function isAssetAssignedToEmployee(assetId, employeeIntId, orgId, deptId = null) {
  const { rows } = await getDb().query(
    `
      SELECT 1
      FROM "tblAssetAssignments" aa
      INNER JOIN "tblAssets" a ON aa.asset_id = a.asset_id
      WHERE aa.asset_id = $1
        AND aa.action = 'A'
        AND aa.latest_assignment_flag = true
        AND a.org_id = $3
        AND COALESCE(a.current_status, '') <> 'SCRAPPED'
        AND (
          aa.employee_int_id = $2
          OR ($4::text IS NOT NULL AND aa.dept_id = $4)
        )
      LIMIT 1
    `,
    [assetId, employeeIntId, orgId, deptId || null],
  );
  return rows.length > 0;
}

function classifyReadingKind({ utility_name, utility_sh, uom_name, consumption_type }) {
  const blob = [
    utility_name,
    utility_sh,
    uom_name,
    consumption_type,
  ]
    .map((v) => String(v || '').toLowerCase())
    .join(' ');
  if (
    /\b(km|kilometre|kilometer|odometer|odo|bus|vehicle|fleet|travel)\b/.test(blob)
  ) {
    return 'odometer';
  }
  return 'meter';
}

async function listMyAssignedUtilityAssets({ orgId, employeeIntId, deptId = null }) {
  await ensureSchema();
  if (!orgId || !employeeIntId) {
    throw new Error('Organization and employee are required');
  }

  const { rows } = await getDb().query(
    `
      SELECT DISTINCT ON (a.asset_id, d.utild_id)
        a.asset_id,
        a.asset_type_id,
        COALESCE(NULLIF(BTRIM(a.description), ''), NULLIF(BTRIM(a.text), ''), a.asset_id) AS asset_name,
        a.serial_number,
        at.text AS asset_type_name,
        d.utild_id,
        d.utility_sh,
        d.utctp_id,
        d.meter_max,
        d.uom_id,
        ct.consumption_type,
        h.util_id,
        h.utility_name,
        COALESCE(u.uom, uh.uom) AS uom_name,
        aa.action_on AS assigned_on,
        CASE
          WHEN aa.employee_int_id = $2 THEN 'USER'
          WHEN $3::text IS NOT NULL AND aa.dept_id = $3 THEN 'DEPARTMENT'
          ELSE 'UNKNOWN'
        END AS assignment_scope
      FROM "tblAssetAssignments" aa
      INNER JOIN "tblAssets" a ON a.asset_id = aa.asset_id
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      INNER JOIN "tblATUtilityMap" m
        ON m.assettype_id = a.asset_type_id
      INNER JOIN "tblUtility_D" d ON d.utild_id = m.utild_id
      INNER JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      LEFT JOIN "tblUom" uh ON uh.uom_id = h.uom_id
      WHERE aa.action = 'A'
        AND aa.latest_assignment_flag = true
        AND a.org_id = $1
        AND COALESCE(a.current_status, '') <> 'SCRAPPED'
        AND ($1::text IS NULL OR COALESCE(d.org_id, h.org_id) = $1)
        AND (
          aa.employee_int_id = $2
          OR ($3::text IS NOT NULL AND aa.dept_id = $3)
        )
      ORDER BY a.asset_id, d.utild_id,
        CASE WHEN aa.employee_int_id = $2 THEN 0 ELSE 1 END
    `,
    [orgId, employeeIntId, deptId || null],
  );

  return rows.map((row) => {
    const reading_kind = classifyReadingKind(row);
    return {
      ...row,
      reading_kind,
      start_label: reading_kind === 'odometer' ? 'Start km' : 'Start reading',
      end_label: reading_kind === 'odometer' ? 'End km' : 'End reading',
      consumed_label: reading_kind === 'odometer' ? 'Distance (km)' : 'Consumed',
    };
  });
}

async function listAssetConsumptions({ orgId, assetId, utildId, limit = 30 }) {
  await ensureSchema();
  const { rows } = await getDb().query(
    `
      SELECT c.*,
             d.utility_sh,
             d.utctp_id,
             d.meter_max,
             ct.consumption_type,
             h.utility_name,
             COALESCE(u.uom, uh.uom) AS uom_name
      FROM "tblUtilConsumption" c
      JOIN "tblUtility_D" d ON d.utild_id = c.utild_id
      JOIN "tblUtility_H" h ON h.util_id = d.util_id
      LEFT JOIN "tblUTConsumType" ct ON ct.utctp_id = d.utctp_id
      LEFT JOIN "tblUom" u ON u.uom_id = d.uom_id
      LEFT JOIN "tblUom" uh ON uh.uom_id = h.uom_id
      WHERE c.asset_id = $1
        AND ($2::text IS NULL OR c.utild_id = $2)
        AND ($3::text IS NULL OR COALESCE(c.org_id, d.org_id) = $3)
      ORDER BY c.consumption_date DESC, c.created_on DESC
      LIMIT $4
    `,
    [assetId, utildId || null, orgId || null, Math.min(Number(limit) || 30, 100)],
  );
  return rows;
}

async function createAssetConsumption(payload, { userId, orgId, employeeIntId, deptId }) {
  await ensureSchema();
  const assetId = payload.asset_id;
  const utildId = payload.utild_id;
  if (!assetId) throw new Error('asset_id is required');
  if (!utildId) throw new Error('utild_id is required');
  if (!payload.consumption_date) throw new Error('consumption_date is required');

  const allowed = await isAssetAssignedToEmployee(assetId, employeeIntId, orgId, deptId);
  if (!allowed) {
    const err = new Error('You can only record readings for assets assigned to you');
    err.statusCode = 403;
    throw err;
  }

  const detail = await getDetail(utildId);
  if (!detail) throw new Error('Utility detail not found');

  // Ensure asset type is mapped to this utility detail
  const mapCheck = await getDb().query(
    `
      SELECT 1
      FROM "tblATUtilityMap" m
      INNER JOIN "tblAssets" a ON a.asset_type_id = m.assettype_id
      WHERE a.asset_id = $1
        AND m.utild_id = $2
      LIMIT 1
    `,
    [assetId, utildId],
  );
  if (!mapCheck.rows.length) {
    throw new Error('This utility is not mapped to the selected asset type');
  }

  const startRaw = payload.start_reading;
  const endRaw = payload.end_reading ?? payload.reading;
  if (startRaw === '' || startRaw == null) throw new Error('start_reading is required');
  if (endRaw === '' || endRaw == null) throw new Error('end_reading is required');

  const start = Number(startRaw);
  const end = Number(endRaw);
  if (!Number.isFinite(start) || start < 0) throw new Error('start_reading must be a non-negative number');
  if (!Number.isFinite(end) || end < 0) throw new Error('end_reading must be a non-negative number');

  let quantity_consumed;
  let rolled_over = false;
  const utctp = String(detail.utctp_id || '').toUpperCase();

  if (utctp === CONSUMPTION_TYPE.METER) {
    const calc = calculateMeterConsumption({
      previousReading: start,
      currentReading: end,
      meterMax: detail.meter_max || 9999,
      firstReadingMode: 'from_zero',
    });
    quantity_consumed = calc.quantityConsumed;
    rolled_over = calc.rolledOver;
  } else {
    if (end < start) throw new Error('End value cannot be less than start value');
    quantity_consumed = end - start;
  }

  const utcv_id = await generateCustomId('util_consumption', 3);
  await getDb().query(
    `
      INSERT INTO "tblUtilConsumption"
        (utcv_id, utild_id, reading, start_reading, quantity_consumed, consumption_date,
         created_on, created_by, rolled_over, org_id, asset_id)
      VALUES ($1,$2,$3,$4,$5,$6, CURRENT_TIMESTAMP, $7, $8, $9, $10)
    `,
    [
      utcv_id,
      utildId,
      end,
      start,
      quantity_consumed,
      payload.consumption_date,
      userId || null,
      Boolean(rolled_over),
      detail.org_id || orgId,
      assetId,
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

async function createConsumption(payload, userId) {
  await ensureSchema();
  const detail = await getDetail(payload.utild_id);
  if (!detail) throw new Error('Utility detail not found');
  if (!payload.consumption_date) throw new Error('consumption_date is required');

  const previous = await getPreviousReading(
    payload.utild_id,
    payload.consumption_date,
    payload.asset_id || null,
  );
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
        (utcv_id, utild_id, reading, start_reading, quantity_consumed, consumption_date,
         created_on, created_by, rolled_over, org_id, asset_id)
      VALUES ($1,$2,$3,$4,$5,$6, CURRENT_TIMESTAMP, $7, $8, $9, $10)
    `,
    [
      utcv_id,
      built.utild_id,
      built.reading,
      payload.start_reading ?? previous?.reading ?? null,
      built.quantity_consumed,
      built.consumption_date,
      userId || null,
      Boolean(built.rolled_over),
      detail.org_id,
      payload.asset_id || null,
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

/**
 * Missed consumption alerts for the employee currently assigned to the asset.
 * Frequency rules (tblUtilFreq.freq):
 *   0  = OnActualUsage → skip alerts
 *   1  = Daily → due if no consumption with consumption_date = today (IST-ish UTC date)
 *   N  = Weekly/Monthly/Halfyearly → due if last consumption_date + N days < today
 *        (also due if never recorded)
 */
async function getConsumptionMissNotificationsByUser({
  empIntId,
  orgId = null,
  branchId = null,
} = {}) {
  await ensureSchema();
  if (!empIntId) return [];

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const { rows } = await getDb().query(
    `
      SELECT
        a.asset_id,
        a.org_id,
        a.branch_id,
        COALESCE(NULLIF(BTRIM(a.description), ''), NULLIF(BTRIM(a.text), ''), a.asset_id) AS asset_name,
        at.text AS asset_type_name,
        d.utild_id,
        d.utility_sh,
        d.utfq_id,
        f.freq AS frequency_days,
        f.description AS frequency_label,
        h.util_id,
        h.utility_name,
        aa.employee_int_id,
        (
          SELECT MAX(c.consumption_date)::date
          FROM "tblUtilConsumption" c
          WHERE c.utild_id = d.utild_id
            AND c.asset_id = a.asset_id
        ) AS last_consumption_date
      FROM "tblAssetAssignments" aa
      INNER JOIN "tblAssets" a ON a.asset_id = aa.asset_id
      INNER JOIN "tblAssetTypes" at ON at.asset_type_id = a.asset_type_id
      INNER JOIN "tblATUtilityMap" m ON m.assettype_id = a.asset_type_id
      INNER JOIN "tblUtility_D" d ON d.utild_id = m.utild_id
      INNER JOIN "tblUtility_H" h ON h.util_id = d.util_id
      INNER JOIN "tblUtilFreq" f ON f.utfq_id = d.utfq_id
      WHERE aa.action = 'A'
        AND aa.latest_assignment_flag = true
        AND aa.employee_int_id = $1
        AND COALESCE(a.current_status, '') <> 'SCRAPPED'
        AND ($2::text IS NULL OR a.org_id = $2)
        AND ($3::text IS NULL OR a.branch_id = $3 OR a.branch_id IS NULL)
        AND COALESCE(f.freq, 0) > 0
      ORDER BY a.asset_id, d.utild_id
    `,
    [empIntId, orgId || null, branchId || null],
  );

  const alerts = [];
  for (const row of rows) {
    const freqDays = Number(row.frequency_days) || 0;
    if (freqDays <= 0) continue;

    const last = row.last_consumption_date
      ? String(row.last_consumption_date).slice(0, 10)
      : null;

    let isMissed = false;
    let dueDate = todayStr;

    if (freqDays === 1) {
      // Daily: missed if no reading for today
      isMissed = last !== todayStr;
      dueDate = todayStr;
    } else if (!last) {
      isMissed = true;
      dueDate = todayStr;
    } else {
      const lastDate = new Date(`${last}T00:00:00Z`);
      const nextDue = new Date(lastDate);
      nextDue.setUTCDate(nextDue.getUTCDate() + freqDays);
      const nextDueStr = nextDue.toISOString().slice(0, 10);
      isMissed = nextDueStr <= todayStr;
      dueDate = nextDueStr;
    }

    if (!isMissed) continue;

    const utilityLabel = row.utility_sh || row.utility_name || 'Utility';
    const freqLabel = row.frequency_label || `${freqDays} day(s)`;
    const params = new URLSearchParams({
      utilId: row.util_id,
      utildId: row.utild_id,
      assetId: row.asset_id,
      date: dueDate,
    });
    alerts.push({
      id: `CONSMISS-${row.asset_id}-${row.utild_id}`,
      wfamshId: null,
      workflowId: `CONSMISS-${row.asset_id}-${row.utild_id}`,
      workflowType: 'CONSUMPTION_MISS',
      route: `/utilities/consumption?${params.toString()}`,
      dueDate,
      cutoffDate: dueDate,
      daysUntilCutoff: 0,
      isUrgent: true,
      isOverdue: true,
      maintenanceType: 'Consumption Miss Alert',
      assetId: row.asset_id,
      assetTypeName: row.asset_type_name || utilityLabel,
      categoryName: utilityLabel,
      maintenanceId: row.utild_id,
      quantityIssued: null,
      isGroupMaintenance: false,
      groupId: null,
      groupName: null,
      groupAssetCount: null,
      title: 'Consumption Miss Alert',
      body: `${utilityLabel} reading missed for ${row.asset_name || row.asset_id} (${freqLabel})`,
      userName: null,
      statusLabel: 'Missed',
      notifyId: null,
      notificationStatus: 'NEW',
      utildId: row.utild_id,
      utilId: row.util_id,
      utilityName: row.utility_name,
      utilitySh: row.utility_sh,
      frequencyLabel: freqLabel,
      lastConsumptionDate: last,
    });
  }

  return alerts;
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
  listMyAssignedUtilityAssets,
  listAssetConsumptions,
  createAssetConsumption,
  isAssetAssignedToEmployee,
  getConsumptionMissNotificationsByUser,
  calculateMeterConsumption,
  CONSUMPTION_TYPE,
};
