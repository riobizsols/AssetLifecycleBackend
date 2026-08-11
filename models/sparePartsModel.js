const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomIdForClient } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

/**
 * Convert spare category ID to serial prefix (same idea as asset types).
 * SPC001 -> 01, SPC012 -> 12, SPC101 -> 01 (last 2 digits).
 * Format: [CategoryCode 2][ReversedYear 2][Month 2][Running 5]
 */
const convertSpcToSerialFormat = (spcId) => {
  const id = String(spcId || '');
  if (id.toUpperCase().startsWith('SPC')) {
    const numericPart = id.replace(/^SPC/i, '');
    const n = parseInt(numericPart, 10);
    if (Number.isFinite(n)) {
      return String(n % 100).padStart(2, '0');
    }
  }
  const digits = id.replace(/\D/g, '');
  if (digits) {
    return String(parseInt(digits, 10) % 100).padStart(2, '0');
  }
  return '00';
};

const buildSpareSerialNumber = (spcId, sequence) => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const reversedYear = year.split('').reverse().join('');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = convertSpcToSerialFormat(spcId);
  return `${prefix}${reversedYear}${month}${String(sequence).padStart(5, '0')}`;
};

/**
 * Spare-part categories for an org (tblSPCategory).
 * @param {boolean} activeOnly - when true, only int_status = 1
 */
const getCategories = async (
  org_id,
  branch_id = null,
  hasSuperAccess = false,
  activeOnly = true
) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      spc_id,
      text,
      uom,
      minimum_stock,
      re_order_level,
      int_status,
      org_id,
      branch_id,
      created_by,
      created_on,
      changed_by,
      changed_on
    FROM "tblSPCategory"
    WHERE org_id = $1
  `;

  if (activeOnly) {
    query += ` AND int_status = 1`;
  }

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (branch_id IS NULL OR branch_id = $${params.length})`;
  }

  query += ` ORDER BY text ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const createCategory = async ({
  org_id,
  branch_id,
  text,
  uom,
  minimum_stock,
  re_order_level,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const name = String(text || '').trim();
    if (!name) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }
    if (!uom || !String(uom).trim()) {
      const err = new Error('UOM is required');
      err.statusCode = 400;
      throw err;
    }

    const minStock = Number(minimum_stock);
    const reorder = Number(re_order_level);
    if (!Number.isFinite(minStock) || minStock < 0) {
      const err = new Error('Minimum stock must be a valid non-negative number');
      err.statusCode = 400;
      throw err;
    }
    if (!Number.isFinite(reorder) || reorder < 0) {
      const err = new Error('Reorder level must be a valid non-negative number');
      err.statusCode = 400;
      throw err;
    }

    const dup = await client.query(
      `
        SELECT 1 FROM "tblSPCategory"
        WHERE org_id = $1
          AND LOWER(TRIM(text)) = LOWER($2)
        LIMIT 1
      `,
      [org_id, name]
    );
    if (dup.rows.length) {
      const err = new Error('A spare part category with this name already exists');
      err.statusCode = 400;
      throw err;
    }

    const spc_id = await generateCustomIdForClient(client, 'sp_category', 3);

    const result = await client.query(
      `
        INSERT INTO "tblSPCategory" (
          spc_id, text, uom, minimum_stock, re_order_level, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, 1,
          $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spc_id,
        name,
        String(uom).trim(),
        minStock,
        reorder,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

const getCategoryMappings = async (org_id, branch_id = null, hasSuperAccess = false) => {
  const dbPool = getDb();
  const params = [org_id];
  let query = `
    SELECT
      m.spcatm_id,
      m.spc_id,
      c.text AS category_name,
      m.asset_type_id,
      at.text AS asset_type_name,
      m.brand,
      m.model,
      m.int_status,
      m.org_id,
      m.branch_id,
      m.created_by,
      m.created_on
    FROM "tblSPCatATMap" m
    LEFT JOIN "tblSPCategory" c ON c.spc_id = m.spc_id
    LEFT JOIN "tblAssetTypes" at ON at.asset_type_id = m.asset_type_id
    WHERE m.org_id = $1
  `;

  if (!hasSuperAccess && branch_id) {
    params.push(branch_id);
    query += ` AND (m.branch_id IS NULL OR m.branch_id = $${params.length})`;
  }

  query += ` ORDER BY c.text ASC, at.text ASC, m.brand ASC, m.model ASC`;
  const result = await dbPool.query(query, params);
  return result.rows;
};

const createCategoryMapping = async ({
  org_id,
  branch_id,
  spc_id,
  asset_type_id,
  brand,
  model,
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    if (!spc_id) {
      const err = new Error('Category is required');
      err.statusCode = 400;
      throw err;
    }
    if (!asset_type_id) {
      const err = new Error('Asset type is required');
      err.statusCode = 400;
      throw err;
    }

    const brandVal = brand != null ? String(brand).trim() : '';
    const modelVal = model != null ? String(model).trim() : '';

    const cat = await client.query(
      `
        SELECT spc_id FROM "tblSPCategory"
        WHERE spc_id = $1 AND org_id = $2 AND int_status = 1
      `,
      [spc_id, org_id]
    );
    if (!cat.rows.length) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    const at = await client.query(
      `
        SELECT asset_type_id FROM "tblAssetTypes"
        WHERE asset_type_id = $1 AND org_id = $2
      `,
      [asset_type_id, org_id]
    );
    if (!at.rows.length) {
      const err = new Error('Invalid asset type');
      err.statusCode = 400;
      throw err;
    }

    const dup = await client.query(
      `
        SELECT 1 FROM "tblSPCatATMap"
        WHERE org_id = $1
          AND spc_id = $2
          AND asset_type_id = $3
          AND COALESCE(LOWER(TRIM(brand)), '') = LOWER($4)
          AND COALESCE(LOWER(TRIM(model)), '') = LOWER($5)
          AND int_status = 1
        LIMIT 1
      `,
      [org_id, spc_id, asset_type_id, brandVal, modelVal]
    );
    if (dup.rows.length) {
      const err = new Error('This category / asset type / brand / model mapping already exists');
      err.statusCode = 400;
      throw err;
    }

    const spcatm_id = await generateCustomIdForClient(client, 'sp_cat_at_map', 3);

    const result = await client.query(
      `
        INSERT INTO "tblSPCatATMap" (
          spcatm_id, spc_id, asset_type_id, brand, model, int_status,
          org_id, branch_id, created_by, created_on, changed_by, changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, 1,
          $6, $7, $8, CURRENT_TIMESTAMP, $8, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spcatm_id,
        spc_id,
        asset_type_id,
        brandVal || null,
        modelVal || null,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Create lot header (tblSPLotDet) + individual unit rows (tblSPIndDet) in one transaction.
 */
const createSparePartLot = async ({
  org_id,
  branch_id,
  spc_id,
  unit_price,
  lot_purchase_date,
  invoice_no,
  invoice_item_no,
  quantity,
  remarks = null,
  has_serial_number = false,
  serial_numbers = [],
  created_by,
}) => {
  const dbPool = getDb();
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const categoryCheck = await client.query(
      `
        SELECT spc_id
        FROM "tblSPCategory"
        WHERE spc_id = $1
          AND org_id = $2
          AND int_status = 1
      `,
      [spc_id, org_id]
    );

    if (categoryCheck.rows.length === 0) {
      const err = new Error('Invalid or inactive spare part category');
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      const err = new Error('Quantity must be a positive number');
      err.statusCode = 400;
      throw err;
    }

    const unitCount = Math.floor(qty);
    // Each quantity unit gets one serial (manual or auto-generated)
    if (unitCount !== qty) {
      const err = new Error('Quantity must be a whole number so each unit can have a serial number');
      err.statusCode = 400;
      throw err;
    }

    let resolvedSerials = [];

    if (has_serial_number) {
      if (!Array.isArray(serial_numbers) || serial_numbers.length !== unitCount) {
        const err = new Error(`Exactly ${unitCount} serial number(s) are required`);
        err.statusCode = 400;
        throw err;
      }
      resolvedSerials = serial_numbers.map((s) => String(s || '').trim());
      if (resolvedSerials.some((s) => !s)) {
        const err = new Error('All serial numbers are required');
        err.statusCode = 400;
        throw err;
      }
      const unique = new Set(resolvedSerials.map((s) => s.toLowerCase()));
      if (unique.size !== resolvedSerials.length) {
        const err = new Error('Serial numbers must be unique');
        err.statusCode = 400;
        throw err;
      }

      const existing = await client.query(
        `
          SELECT serial_number
          FROM "tblSPIndDet"
          WHERE org_id = $1
            AND spc_id = $2
            AND serial_number IS NOT NULL
            AND LOWER(serial_number) = ANY($3::text[])
        `,
        [org_id, spc_id, resolvedSerials.map((s) => s.toLowerCase())]
      );
      if (existing.rows.length) {
        const dupes = existing.rows.map((r) => r.serial_number).join(', ');
        const err = new Error(`Serial number(s) already exist for this category: ${dupes}`);
        err.statusCode = 400;
        throw err;
      }
    } else {
      // Auto-generate unique sequential serials (asset creation format)
      for (let i = 0; i < unitCount; i += 1) {
        const seqResult = await client.query(
          `
            UPDATE "tblSPCategory"
            SET last_gen_seq_no = COALESCE(last_gen_seq_no, 0) + 1,
                changed_on = CURRENT_TIMESTAMP
            WHERE spc_id = $1 AND org_id = $2
            RETURNING last_gen_seq_no
          `,
          [spc_id, org_id]
        );
        if (!seqResult.rows.length) {
          const err = new Error('Failed to allocate spare part serial sequence');
          err.statusCode = 500;
          throw err;
        }
        const nextSequence = parseInt(seqResult.rows[0].last_gen_seq_no, 10);
        resolvedSerials.push(buildSpareSerialNumber(spc_id, nextSequence));
      }
    }

    const spld_id = await generateCustomIdForClient(client, 'sp_lot_det', 3);

    const lotResult = await client.query(
      `
        INSERT INTO "tblSPLotDet" (
          spld_id,
          spc_id,
          unit_price,
          lot_purchase_date,
          invoice_no,
          invoice_item_no,
          quantity,
          remarks,
          org_id,
          branch_id,
          created_by,
          created_on,
          changed_by,
          changed_on
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          CURRENT_TIMESTAMP, $11, CURRENT_TIMESTAMP
        )
        RETURNING *
      `,
      [
        spld_id,
        spc_id,
        unit_price,
        lot_purchase_date || null,
        invoice_no || null,
        invoice_item_no || null,
        qty,
        remarks,
        org_id,
        branch_id || null,
        created_by || null,
      ]
    );

    const individuals = [];

    for (let i = 0; i < unitCount; i += 1) {
      const spid_id = await generateCustomIdForClient(client, 'sp_ind_det', 3);
      const serial_number = resolvedSerials[i];

      const indResult = await client.query(
        `
          INSERT INTO "tblSPIndDet" (
            spid_id,
            spld_id,
            spc_id,
            serial_number,
            is_used,
            org_id,
            branch_id,
            created_by,
            created_on,
            changed_by,
            changed_on
          ) VALUES (
            $1, $2, $3, $4, 0, $5, $6, $7,
            CURRENT_TIMESTAMP, $7, CURRENT_TIMESTAMP
          )
          RETURNING *
        `,
        [
          spid_id,
          spld_id,
          spc_id,
          serial_number,
          org_id,
          branch_id || null,
          created_by || null,
        ]
      );
      individuals.push(indResult.rows[0]);
    }

    await client.query('COMMIT');

    return {
      lot: lotResult.rows[0],
      individuals,
      serials_auto_generated: !has_serial_number,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore rollback errors */
    }
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Individuals for a lot — used when serials were not entered manually
 * so records can be fetched from DB and displayed.
 */
const getIndividualsByLotId = async (spld_id, org_id) => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `
      SELECT
        spid_id,
        spld_id,
        spc_id,
        serial_number,
        is_used,
        org_id,
        branch_id,
        created_on
      FROM "tblSPIndDet"
      WHERE spld_id = $1
        AND org_id = $2
      ORDER BY spid_id ASC
    `,
    [spld_id, org_id]
  );
  return result.rows;
};

module.exports = {
  getCategories,
  createCategory,
  getCategoryMappings,
  createCategoryMapping,
  createSparePartLot,
  getIndividualsByLotId,
  convertSpcToSerialFormat,
  buildSpareSerialNumber,
};
