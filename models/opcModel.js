/**
 * OPC / condition monitoring master data
 *   tblAssetComponents, tblOpcServers, tblOpcTags, tblCompTags
 */
const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId, generateCustomIdForClient } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const DATA_TYPES = ['SHORT', 'LONG', 'REAL4', 'REAL8', 'BOOLEAN', 'STRING'];
const TAG_TYPES = ['Counter', 'Measurement', 'Status'];

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

// ---------- Components ----------

exports.listComponents = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT c.comp_id, c.asset_id, a.text AS asset_name, c.comp_name, c.created_on, c.changed_on
       FROM "tblAssetComponents" c
       JOIN "tblAssets" a ON a.asset_id = c.asset_id
      WHERE c.org_id = $1 AND COALESCE(c.int_status, 1) = 1
      ORDER BY a.text, c.comp_name`,
    [orgId],
  );
  return rows;
};

exports.listAssetsWithComponents = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT a.asset_id, a.text AS asset_name, COUNT(c.comp_id)::int AS component_count
       FROM "tblAssetComponents" c
       JOIN "tblAssets" a ON a.asset_id = c.asset_id
      WHERE c.org_id = $1 AND COALESCE(c.int_status, 1) = 1
      GROUP BY a.asset_id, a.text
      ORDER BY a.text`,
    [orgId],
  );
  return rows;
};

exports.listAssetsForComponents = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT asset_id, text AS asset_name, serial_number
       FROM "tblAssets"
      WHERE org_id = $1 AND COALESCE(current_status, 'Active') <> 'SCRAPPED'
      ORDER BY text`,
    [orgId],
  );
  return rows;
};

const assertAssetInOrg = async (assetId, orgId) => {
  const { rows } = await getDb().query(
    `SELECT 1 FROM "tblAssets" WHERE asset_id = $1 AND org_id = $2`,
    [assetId, orgId],
  );
  if (!rows.length) throw new Error('Asset not found');
};

const assertComponentNameFree = async (assetId, compName, orgId, excludeCompId = null) => {
  const { rows } = await getDb().query(
    `SELECT comp_id FROM "tblAssetComponents"
      WHERE asset_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1
        AND LOWER(TRIM(comp_name)) = LOWER($3)
        AND ($4::varchar IS NULL OR comp_id <> $4::varchar)`,
    [assetId, orgId, compName, excludeCompId],
  );
  if (rows.length) throw new Error(`Component "${compName}" already exists on this asset`);
};

exports.createComponent = async ({ asset_id, comp_name, org_id, user_id }) => {
  const assetId = clean(asset_id);
  const compName = clean(comp_name);
  if (!assetId) throw new Error('Asset is required');
  if (!compName) throw new Error('Component name is required');

  await assertAssetInOrg(assetId, org_id);
  await assertComponentNameFree(assetId, compName, org_id);

  const compId = await generateCustomId('asset_component', 3);
  const { rows } = await getDb().query(
    `INSERT INTO "tblAssetComponents"
       (comp_id, asset_id, comp_name, org_id, int_status, created_by, created_on, changed_by, changed_on)
     VALUES ($1, $2, $3, $4, 1, $5, NOW(), $5, NOW())
     RETURNING *`,
    [compId, assetId, compName, org_id, user_id],
  );
  return rows[0];
};

exports.updateComponent = async (compId, { asset_id, comp_name, org_id, user_id }) => {
  const assetId = clean(asset_id);
  const compName = clean(comp_name);
  if (!assetId) throw new Error('Asset is required');
  if (!compName) throw new Error('Component name is required');

  await assertAssetInOrg(assetId, org_id);
  await assertComponentNameFree(assetId, compName, org_id, compId);

  const { rows } = await getDb().query(
    `UPDATE "tblAssetComponents"
        SET asset_id = $2, comp_name = $3, changed_by = $5, changed_on = NOW()
      WHERE comp_id = $1 AND org_id = $4 AND COALESCE(int_status, 1) = 1
      RETURNING *`,
    [compId, assetId, compName, org_id, user_id],
  );
  if (!rows.length) throw new Error('Component not found');
  return rows[0];
};

exports.deleteComponent = async (compId, { org_id, user_id }) => {
  const mapped = await getDb().query(
    `SELECT 1 FROM "tblCompTags" WHERE comp_id = $1 AND COALESCE(int_status, 1) = 1 LIMIT 1`,
    [compId],
  );
  if (mapped.rows.length) {
    throw new Error('Remove the tag mappings of this component first');
  }
  const { rows } = await getDb().query(
    `UPDATE "tblAssetComponents"
        SET int_status = 0, changed_by = $3, changed_on = NOW()
      WHERE comp_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1
      RETURNING comp_id`,
    [compId, org_id, user_id],
  );
  if (!rows.length) throw new Error('Component not found');
  return rows[0];
};

// ---------- Servers ----------

exports.listServers = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT server_id, server_name, endpoint_url, security_mode, last_seen
       FROM "tblOpcServers"
      WHERE org_id = $1 AND COALESCE(int_status, 1) = 1
      ORDER BY server_name`,
    [orgId],
  );
  return rows;
};

exports.getServer = async (serverId, orgId) => {
  const { rows } = await getDb().query(
    `SELECT server_id, server_name FROM "tblOpcServers"
      WHERE server_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1`,
    [serverId, orgId],
  );
  return rows[0] || null;
};

exports.touchServer = async (serverId, orgId) => {
  await getDb().query(
    `UPDATE "tblOpcServers" SET last_seen = NOW() WHERE server_id = $1 AND org_id = $2`,
    [serverId, orgId],
  );
};

exports.listMappedPaths = async (serverId, orgId) => {
  const { rows } = await getDb().query(
    `SELECT tag_full_path FROM "tblCompTags"
      WHERE server_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1`,
    [serverId, orgId],
  );
  return new Set(rows.map((r) => r.tag_full_path));
};

// ---------- Tags ----------

exports.listTags = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT tag_id, tag_name, data_type, unit, tag_type
       FROM "tblOpcTags"
      WHERE org_id = $1 AND COALESCE(int_status, 1) = 1
      ORDER BY tag_name`,
    [orgId],
  );
  return rows;
};

// ---------- Component ↔ tag mapping ----------

exports.listCompTags = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT ct.ct_id, ct.server_id, s.server_name, ct.comp_id, c.comp_name,
            c.asset_id, a.text AS asset_name, ct.tag_id, t.tag_name, t.data_type, t.unit, t.tag_type,
            ct.tag_full_path, ct.created_on
       FROM "tblCompTags" ct
       JOIN "tblAssetComponents" c ON c.comp_id = ct.comp_id
       JOIN "tblAssets" a ON a.asset_id = c.asset_id
       JOIN "tblOpcTags" t ON t.tag_id = ct.tag_id
       JOIN "tblOpcServers" s ON s.server_id = ct.server_id
      WHERE ct.org_id = $1 AND COALESCE(ct.int_status, 1) = 1
      ORDER BY a.text, c.comp_name, t.tag_name`,
    [orgId],
  );
  return rows;
};

exports.createCompTag = async (payload) => {
  const serverId = clean(payload.server_id);
  const compId = clean(payload.comp_id);
  const tagPath = clean(payload.tag_full_path);
  const tagName = clean(payload.tag_name);
  const dataType = clean(payload.data_type);
  const unit = clean(payload.unit) || null;
  const tagType = clean(payload.tag_type);
  const { org_id: orgId, user_id: userId } = payload;

  if (!serverId) throw new Error('Server is required');
  if (!compId) throw new Error('Component is required');
  if (!tagPath) throw new Error('OPC tag is required');
  if (!tagName) throw new Error('Tag name is required');
  if (!DATA_TYPES.includes(dataType)) throw new Error(`Data type must be one of ${DATA_TYPES.join(', ')}`);
  if (!TAG_TYPES.includes(tagType)) throw new Error(`Tag type must be one of ${TAG_TYPES.join(', ')}`);

  const client = await getDb().connect();
  try {
    await client.query('BEGIN');

    const comp = await client.query(
      `SELECT comp_id FROM "tblAssetComponents"
        WHERE comp_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1`,
      [compId, orgId],
    );
    if (!comp.rows.length) throw new Error('Component not found');

    const server = await client.query(
      `SELECT server_id FROM "tblOpcServers"
        WHERE server_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1`,
      [serverId, orgId],
    );
    if (!server.rows.length) throw new Error('Server not found');

    const existingMap = await client.query(
      `SELECT ct_id, int_status FROM "tblCompTags" WHERE server_id = $1 AND tag_full_path = $2`,
      [serverId, tagPath],
    );
    if (existingMap.rows.length && Number(existingMap.rows[0].int_status ?? 1) === 1) {
      throw new Error(`${tagPath} is already mapped on this server`);
    }

    let tagId;
    const existingTag = await client.query(
      `SELECT tag_id FROM "tblOpcTags"
        WHERE org_id = $1 AND LOWER(tag_name) = LOWER($2) AND COALESCE(int_status, 1) = 1
        LIMIT 1`,
      [orgId, tagName],
    );
    if (existingTag.rows.length) {
      tagId = existingTag.rows[0].tag_id;
      await client.query(
        `UPDATE "tblOpcTags"
            SET data_type = $2, unit = $3, tag_type = $4, changed_by = $5, changed_on = NOW()
          WHERE tag_id = $1`,
        [tagId, dataType, unit, tagType, userId],
      );
    } else {
      tagId = await generateCustomIdForClient(client, 'opc_tag', 3);
      await client.query(
        `INSERT INTO "tblOpcTags"
           (tag_id, tag_name, data_type, unit, tag_type, org_id, int_status, created_by, created_on, changed_by, changed_on)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, NOW(), $7, NOW())`,
        [tagId, tagName, dataType, unit, tagType, orgId, userId],
      );
    }

    let ctId;
    if (existingMap.rows.length) {
      // Soft-deleted mapping for the same server path: reactivate it (unique server_id + path)
      ctId = existingMap.rows[0].ct_id;
      await client.query(
        `UPDATE "tblCompTags"
            SET comp_id = $2, tag_id = $3, org_id = $4, int_status = 1, changed_by = $5, changed_on = NOW()
          WHERE ct_id = $1`,
        [ctId, compId, tagId, orgId, userId],
      );
    } else {
      ctId = await generateCustomIdForClient(client, 'comp_tag', 3);
      await client.query(
        `INSERT INTO "tblCompTags"
           (ct_id, server_id, comp_id, tag_id, tag_full_path, org_id, int_status, created_by, created_on, changed_by, changed_on)
         VALUES ($1, $2, $3, $4, $5, $6, 1, $7, NOW(), $7, NOW())`,
        [ctId, serverId, compId, tagId, tagPath, orgId, userId],
      );
    }

    await client.query('COMMIT');
    return { ct_id: ctId, tag_id: tagId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteCompTag = async (ctId, { org_id, user_id }) => {
  const cbm = await getDb().query(
    `SELECT 1 FROM "tblCbm" WHERE ct_id = $1 AND COALESCE(int_status, 1) = 1 LIMIT 1`,
    [ctId],
  );
  if (cbm.rows.length) throw new Error('This mapping is used by a condition monitoring rule');

  const { rows } = await getDb().query(
    `UPDATE "tblCompTags"
        SET int_status = 0, changed_by = $3, changed_on = NOW()
      WHERE ct_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1
      RETURNING ct_id`,
    [ctId, org_id, user_id],
  );
  if (!rows.length) throw new Error('Mapping not found');
  return rows[0];
};

// ---------- Condition monitoring (CBM) rules ----------

const NUMERIC_TYPES = ['SHORT', 'LONG', 'REAL4', 'REAL8'];

const OPERATORS = {
  NUMERIC: [
    { value: '>', label: 'Greater than', values: 1 },
    { value: '>=', label: 'Greater than or equal', values: 1 },
    { value: '<', label: 'Less than', values: 1 },
    { value: '<=', label: 'Less than or equal', values: 1 },
    { value: '=', label: 'Equal to', values: 1 },
    { value: '!=', label: 'Not equal to', values: 1 },
    { value: 'BETWEEN', label: 'Between', values: 2 },
    { value: 'OUTSIDE', label: 'Outside range', values: 2 },
  ],
  BOOLEAN: [
    { value: 'IS_TRUE', label: 'Is true', values: 0 },
    { value: 'IS_FALSE', label: 'Is false', values: 0 },
  ],
  STRING: [
    { value: 'EQUALS', label: 'Equals', values: 1 },
    { value: 'NOT_EQUALS', label: 'Not equals', values: 1 },
    { value: 'CONTAINS', label: 'Contains', values: 1 },
  ],
};

const ACTION_TYPES = [
  { value: 'MAINT', label: 'CBM Maintenance' },
  { value: 'INSP', label: 'Inspection' },
];

const operatorFamily = (dataType) => {
  const dt = String(dataType || '').toUpperCase();
  if (NUMERIC_TYPES.includes(dt)) return 'NUMERIC';
  if (dt === 'BOOLEAN') return 'BOOLEAN';
  return 'STRING';
};

const OPERATOR_SYMBOLS = {
  IS_TRUE: 'is true',
  IS_FALSE: 'is false',
  EQUALS: '=',
  NOT_EQUALS: '≠',
  CONTAINS: 'contains',
};

const describeCondition = ({ tag_name, operator, value1, value2, unit }) => {
  const u = unit ? ` ${unit}` : '';
  if (operator === 'BETWEEN') return `${tag_name} between ${value1} and ${value2}${u}`;
  if (operator === 'OUTSIDE') return `${tag_name} outside ${value1} – ${value2}${u}`;
  if (operator === 'IS_TRUE' || operator === 'IS_FALSE') return `${tag_name} ${OPERATOR_SYMBOLS[operator]}`;
  return `${tag_name} ${OPERATOR_SYMBOLS[operator] || operator} ${value1}${u}`;
};

const validateRule = ({ data_type, operator, value1, value2, action_type }) => {
  const family = operatorFamily(data_type);
  const op = OPERATORS[family].find((o) => o.value === operator);
  if (!op) throw new Error(`Operator is not valid for data type ${data_type}`);
  if (!ACTION_TYPES.some((a) => a.value === action_type)) throw new Error('Action must be CBM Maintenance or Inspection');

  const v1 = value1 == null ? '' : String(value1).trim();
  const v2 = value2 == null ? '' : String(value2).trim();
  if (op.values >= 1 && v1 === '') throw new Error('Value is required');
  if (op.values === 2 && v2 === '') throw new Error('Second value is required');
  if (family === 'NUMERIC') {
    if (op.values >= 1 && !Number.isFinite(Number(v1))) throw new Error('Value must be a number');
    if (op.values === 2) {
      if (!Number.isFinite(Number(v2))) throw new Error('Second value must be a number');
      if (Number(v1) > Number(v2)) throw new Error('First value must be less than or equal to the second');
    }
  }
  return {
    value1: op.values >= 1 ? v1 : null,
    value2: op.values === 2 ? v2 : null,
  };
};

const getActiveCompTag = async (ctId, orgId) => {
  const { rows } = await getDb().query(
    `SELECT ct.ct_id, c.asset_id, t.tag_name, t.data_type, t.unit
       FROM "tblCompTags" ct
       JOIN "tblAssetComponents" c ON c.comp_id = ct.comp_id
       JOIN "tblOpcTags" t ON t.tag_id = ct.tag_id
      WHERE ct.ct_id = $1 AND ct.org_id = $2 AND COALESCE(ct.int_status, 1) = 1`,
    [ctId, orgId],
  );
  if (!rows.length) throw new Error('Mapped tag not found');
  return rows[0];
};

exports.listCbmRules = async (orgId) => {
  const { rows } = await getDb().query(
    `SELECT r.cbm_id, r.ct_id, r.asset_id, a.text AS asset_name, c.comp_id, c.comp_name,
            ct.server_id, ct.tag_full_path, t.tag_name, t.data_type, t.unit,
            r.operator, r.value1, r.value2, r.condition, r.action_type,
            r.last_value, r.last_evaluated_on, r.is_met, r.last_triggered_on, r.last_trigger_ref,
            r.created_on
       FROM "tblCbm" r
       JOIN "tblCompTags" ct ON ct.ct_id = r.ct_id
       JOIN "tblAssetComponents" c ON c.comp_id = ct.comp_id
       JOIN "tblAssets" a ON a.asset_id = r.asset_id
       JOIN "tblOpcTags" t ON t.tag_id = ct.tag_id
      WHERE r.org_id = $1 AND COALESCE(r.int_status, 1) = 1
      ORDER BY a.text, c.comp_name, t.tag_name`,
    [orgId],
  );
  return rows;
};

exports.createCbmRule = async (payload) => {
  const ctId = clean(payload.ct_id);
  const operator = clean(payload.operator);
  const actionType = clean(payload.action_type);
  const { org_id: orgId, user_id: userId } = payload;
  if (!ctId) throw new Error('Mapped tag is required');

  const tag = await getActiveCompTag(ctId, orgId);
  const { value1, value2 } = validateRule({ ...tag, operator, value1: payload.value1, value2: payload.value2, action_type: actionType });
  const condition = describeCondition({ ...tag, operator, value1, value2 });

  const cbmId = await generateCustomId('cbm', 3);
  const { rows } = await getDb().query(
    `INSERT INTO "tblCbm"
       (cbm_id, asset_id, ct_id, condition, check_frequency, operator, value1, value2, action_type,
        is_met, org_id, int_status, created_by, created_on, changed_by, changed_on)
     VALUES ($1, $2, $3, $4, 'COLLECTOR', $5, $6, $7, $8, false, $9, 1, $10, NOW(), $10, NOW())
     RETURNING *`,
    [cbmId, tag.asset_id, ctId, condition, operator, value1, value2, actionType, orgId, userId],
  );
  return rows[0];
};

exports.updateCbmRule = async (cbmId, payload) => {
  const ctId = clean(payload.ct_id);
  const operator = clean(payload.operator);
  const actionType = clean(payload.action_type);
  const { org_id: orgId, user_id: userId } = payload;
  if (!ctId) throw new Error('Mapped tag is required');

  const tag = await getActiveCompTag(ctId, orgId);
  const { value1, value2 } = validateRule({ ...tag, operator, value1: payload.value1, value2: payload.value2, action_type: actionType });
  const condition = describeCondition({ ...tag, operator, value1, value2 });

  // A changed condition starts fresh so it can trigger again on the next reading.
  const { rows } = await getDb().query(
    `UPDATE "tblCbm"
        SET asset_id = $2, ct_id = $3, condition = $4, operator = $5, value1 = $6, value2 = $7,
            action_type = $8, is_met = false, changed_by = $10, changed_on = NOW()
      WHERE cbm_id = $1 AND org_id = $9 AND COALESCE(int_status, 1) = 1
      RETURNING *`,
    [cbmId, tag.asset_id, ctId, condition, operator, value1, value2, actionType, orgId, userId],
  );
  if (!rows.length) throw new Error('Rule not found');
  return rows[0];
};

exports.deleteCbmRule = async (cbmId, { org_id, user_id }) => {
  const { rows } = await getDb().query(
    `UPDATE "tblCbm"
        SET int_status = 0, changed_by = $3, changed_on = NOW()
      WHERE cbm_id = $1 AND org_id = $2 AND COALESCE(int_status, 1) = 1
      RETURNING cbm_id`,
    [cbmId, org_id, user_id],
  );
  if (!rows.length) throw new Error('Rule not found');
  return rows[0];
};

exports.listCbmTagPaths = async (serverId, orgId) => {
  const { rows } = await getDb().query(
    `SELECT DISTINCT ct.tag_full_path
       FROM "tblCbm" r
       JOIN "tblCompTags" ct ON ct.ct_id = r.ct_id
      WHERE ct.server_id = $1 AND r.org_id = $2
        AND COALESCE(r.int_status, 1) = 1 AND COALESCE(ct.int_status, 1) = 1
      ORDER BY ct.tag_full_path`,
    [serverId, orgId],
  );
  return rows.map((r) => r.tag_full_path);
};

exports.listActiveRulesForPaths = async (serverId, orgId, paths) => {
  if (!paths.length) return [];
  const { rows } = await getDb().query(
    `SELECT r.cbm_id, r.asset_id, r.operator, r.value1, r.value2, r.action_type, r.is_met,
            ct.tag_full_path, t.tag_name, t.data_type, t.unit
       FROM "tblCbm" r
       JOIN "tblCompTags" ct ON ct.ct_id = r.ct_id
       JOIN "tblOpcTags" t ON t.tag_id = ct.tag_id
      WHERE ct.server_id = $1 AND r.org_id = $2 AND ct.tag_full_path = ANY($3::varchar[])
        AND COALESCE(r.int_status, 1) = 1 AND COALESCE(ct.int_status, 1) = 1`,
    [serverId, orgId, paths],
  );
  return rows;
};

exports.saveRuleEvaluation = async (cbmId, { value, isMet, triggerRef }) => {
  await getDb().query(
    `UPDATE "tblCbm"
        SET last_value = $2, last_evaluated_on = NOW(), is_met = $3,
            last_triggered_on = CASE WHEN $4::varchar IS NULL THEN last_triggered_on ELSE NOW() END,
            last_trigger_ref = COALESCE($4::varchar, last_trigger_ref)
      WHERE cbm_id = $1`,
    [cbmId, value == null ? null : String(value).slice(0, 100), isMet, triggerRef || null],
  );
};

exports.DATA_TYPES = DATA_TYPES;
exports.TAG_TYPES = TAG_TYPES;
exports.OPERATORS = OPERATORS;
exports.ACTION_TYPES = ACTION_TYPES;
exports.operatorFamily = operatorFamily;
