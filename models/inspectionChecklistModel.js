const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

/** Normalize any legacy/code/id value to full display name stored in DB. */
function normalizeResponseTypeName(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const upper = raw.toUpperCase();
  if (upper === 'QUANTITATIVE' || upper === 'QN' || upper.startsWith('IRTD_QN')) {
    return 'Quantitative';
  }
  if (
    upper === 'QUALITATIVE' ||
    upper === 'QL' ||
    upper.startsWith('IRTD_QL') ||
    upper.startsWith('QL_')
  ) {
    return 'Qualitative';
  }
  return raw;
}

async function resolveResponseTypeNameFromIrtd(dbPool, irtdId) {
  if (!irtdId) return null;
  const direct = normalizeResponseTypeName(irtdId);
  if (direct === 'Quantitative' || direct === 'Qualitative') {
    // Prefer Det.name when available so DB remains source of truth
    const result = await dbPool.query(
      `SELECT name FROM "tblInspResTypeDet" WHERE irtd_id = $1 LIMIT 1`,
      [irtdId]
    );
    if (result.rows[0]?.name) {
      return normalizeResponseTypeName(result.rows[0].name);
    }
    return direct;
  }
  return direct;
}

async function resolveRepresentativeIrtdId(dbPool, responseTypeName) {
  const name = normalizeResponseTypeName(responseTypeName);
  if (!name) return null;
  const result = await dbPool.query(
    `
      SELECT irtd_id
      FROM "tblInspResTypeDet"
      WHERE name = $1
      ORDER BY irtd_id ASC
      LIMIT 1
    `,
    [name]
  );
  return result.rows[0]?.irtd_id || null;
}

const getColumns = async () => {
  const dbPool = getDb();
  try {
    const result = await dbPool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'tblInspCheckList'`
    );
    
    const columns = result.rows.map(row => row.column_name.toLowerCase());
    return {
      id: columns.includes('insp_check_id') ? 'insp_check_id' : (columns.includes('ic_id') ? 'ic_id' : 'id'),
      question: columns.includes('inspection_text') ? 'inspection_text' : (columns.includes('inspection_question') ? 'inspection_question' : 'question'),
      responseTypeId: columns.includes('response_type') ? 'response_type' : (columns.includes('irtd_id') ? 'irtd_id' : 'res_type_id'),
      expectedValue: columns.includes('expected_value') ? 'expected_value' : 'exp_value',
      minRange: columns.includes('min_range') ? 'min_range' : 'min_val',
      maxRange: columns.includes('max_range') ? 'max_range' : 'max_val',
      triggerMaintenance: columns.includes('trigger_maintenance') ? 'trigger_maintenance' : 'trigger_maint',
      createdBy: columns.includes('created_by') ? 'created_by' : 'createdby',
      createdOn: columns.includes('created_on') ? 'created_on' : 'createdon'
    };
  } catch (err) {
    console.error('Error getting columns for tblInspCheckList:', err);
    return {
      id: 'insp_check_id',
      question: 'inspection_text',
      responseTypeId: 'response_type',
      expectedValue: 'expected_value',
      minRange: 'min_range',
      maxRange: 'max_range',
      triggerMaintenance: 'trigger_maintenance',
      createdBy: 'created_by',
      createdOn: 'created_on'
    };
  }
};

const getAllChecklists = async (orgId) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();

    const query = `
      SELECT ic.*,
             ic.${cols.responseTypeId} as res_type_name,
             (
               SELECT d.irtd_id
               FROM "tblInspResTypeDet" d
               WHERE d.name = ic.${cols.responseTypeId}
               ORDER BY d.irtd_id ASC
               LIMIT 1
             ) as irtd_id
      FROM "tblInspCheckList" ic
      WHERE (ic.org_id = $1 OR ic.org_id = 'default')
      ORDER BY ic.${cols.question} ASC
    `;
    
    const result = await dbPool.query(query, [orgId]);
    
    return result.rows.map(row => {
      const responseType = normalizeResponseTypeName(row[cols.responseTypeId]);
      return {
        ic_id: row[cols.id],
        inspection_question: row[cols.question],
        response_type: responseType,
        irtd_id: row.irtd_id,
        res_type_name: normalizeResponseTypeName(row.res_type_name) || responseType || '-',
        expected_value: row[cols.expectedValue],
        min_range: row[cols.minRange],
        max_range: row[cols.maxRange],
        trigger_maintenance: row[cols.triggerMaintenance],
        created_by: row[cols.createdBy],
        created_on: row[cols.createdOn]
      };
    });
  } catch (error) {
    console.error('Error fetching checklists:', error);
    throw error;
  }
};

const createChecklist = async (data) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    const id = await generateCustomId('IC');
    const dbResponseType =
      (await resolveResponseTypeNameFromIrtd(dbPool, data.irtd_id)) ||
      normalizeResponseTypeName(data.irtd_id);
    
    const query = `
      INSERT INTO "tblInspCheckList" (
        ${cols.id}, 
        ${cols.question}, 
        ${cols.responseTypeId}, 
        ${cols.expectedValue}, 
        ${cols.minRange}, 
        ${cols.maxRange}, 
        ${cols.triggerMaintenance},
        ${cols.createdBy},
        org_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const result = await dbPool.query(query, [
      id,
      data.inspection_question,
      dbResponseType,
      data.expected_value || null,
      data.min_range || null,
      data.max_range || null,
      data.trigger_maintenance || false,
      data.created_by,
      data.org_id || 'default'
    ]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating checklist:', error);
    throw error;
  }
};

const updateChecklist = async (id, data) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (data.inspection_question !== undefined) {
      updates.push(`${cols.question} = $${paramCount++}`);
      values.push(data.inspection_question);
    }
    if (data.irtd_id !== undefined) {
      const dbResponseType =
        (await resolveResponseTypeNameFromIrtd(dbPool, data.irtd_id)) ||
        normalizeResponseTypeName(data.irtd_id);
      updates.push(`${cols.responseTypeId} = $${paramCount++}`);
      values.push(dbResponseType);
    }
    if (data.expected_value !== undefined) {
      updates.push(`${cols.expectedValue} = $${paramCount++}`);
      values.push(data.expected_value);
    }
    if (data.min_range !== undefined) {
      updates.push(`${cols.minRange} = $${paramCount++}`);
      values.push(data.min_range);
    }
    if (data.max_range !== undefined) {
      updates.push(`${cols.maxRange} = $${paramCount++}`);
      values.push(data.max_range);
    }
    if (data.trigger_maintenance !== undefined) {
      updates.push(`${cols.triggerMaintenance} = $${paramCount++}`);
      values.push(data.trigger_maintenance);
    }
    
    if (updates.length === 0) {
      throw new Error('No fields to update');
    }
    
    values.push(id);
    
    const query = `
      UPDATE "tblInspCheckList" 
      SET ${updates.join(', ')}
      WHERE ${cols.id} = $${paramCount}
      RETURNING *
    `;
    
    const result = await dbPool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating checklist:', error);
    throw error;
  }
};

const deleteChecklist = async (id) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    
    const query = `
      DELETE FROM "tblInspCheckList" 
      WHERE ${cols.id} = $1
      RETURNING ${cols.id}
    `;
    
    const result = await dbPool.query(query, [id]);
    return result.rowCount > 0;
  } catch (error) {
    console.error('Error deleting checklist:', error);
    throw error;
  }
};

const getResponseTypes = async () => {
  try {
    const dbPool = getDb();

    // One representative row per full name from tblInspResTypeDet
    const query = `
      SELECT DISTINCT ON (name) irtd_id, name
      FROM "tblInspResTypeDet"
      WHERE name IN ('Quantitative', 'Qualitative')
      ORDER BY name DESC, irtd_id ASC
    `;

    const result = await dbPool.query(query);
    return result.rows.map((row) => ({
      irtd_id: row.irtd_id,
      name: row.name,
    }));
  } catch (error) {
    console.error('Error fetching response types:', error);
    throw error;
  }
};

const getChecklistById = async (id, orgId) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    const result = await dbPool.query(
      `SELECT * FROM "tblInspCheckList" WHERE ${cols.id} = $1 AND org_id = $2`,
      [id, orgId]
    );
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    const responseType = normalizeResponseTypeName(row[cols.responseTypeId]);
    const irtdId = await resolveRepresentativeIrtdId(dbPool, responseType);
    
    return {
      ic_id: row[cols.id],
      inspection_question: row[cols.question],
      response_type: responseType,
      irtd_id: irtdId,
      expected_value: row[cols.expectedValue],
      min_range: row[cols.minRange],
      max_range: row[cols.maxRange],
      trigger_maintenance: row[cols.triggerMaintenance]
    };
  } catch (error) {
    console.error('Error fetching checklist by ID:', error);
    throw error;
  }
};

module.exports = {
  getAllChecklists,
  getChecklistById,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getResponseTypes,
  normalizeResponseTypeName,
};
