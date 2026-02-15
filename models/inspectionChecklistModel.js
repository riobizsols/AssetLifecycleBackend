const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

const getDb = () => getDbFromContext();

const getColumns = async () => {
  const dbPool = getDb();
  const result = await dbPool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_schema = 'public' AND table_name = 'tblInspectionChecklist'`
  );
  
  const columns = result.rows.map(row => row.column_name.toLowerCase());
  return {
    id: columns.includes('ic_id') ? 'ic_id' : 'id',
    question: columns.includes('inspection_question') ? 'inspection_question' : 'question',
    responseTypeId: columns.includes('irtd_id') ? 'irtd_id' : 'res_type_id',
    expectedValue: columns.includes('expected_value') ? 'expected_value' : 'exp_value',
    minRange: columns.includes('min_range') ? 'min_range' : 'min_val',
    maxRange: columns.includes('max_range') ? 'max_range' : 'max_val',
    triggerMaintenance: columns.includes('trigger_maintenance') ? 'trigger_maintenance' : 'trigger_maint',
    createdBy: columns.includes('created_by') ? 'created_by' : 'createdby',
    createdOn: columns.includes('created_on') ? 'created_on' : 'createdon'
  };
};

const getAllChecklists = async (orgId) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    
    // Using double quotes for case-sensitive table names
    const query = `
      SELECT ic.*, 
             CASE 
               WHEN rt."Name" = 'QN' THEN 'Quantitative'
               ELSE 'Qualitative'
             END as res_type_name
      FROM "tblInspectionChecklist" ic
      LEFT JOIN "tblInspResTypeDet" rt ON ic.${cols.responseTypeId} = rt."IRTD_Id"
      WHERE ic.org_id = $1 OR ic.org_id = 'default'
      ORDER BY ic.${cols.question} ASC
    `;
    
    const result = await dbPool.query(query, [orgId]);
    
    return result.rows.map(row => ({
      ic_id: row[cols.id],
      inspection_question: row[cols.question],
      irtd_id: row[cols.responseTypeId],
      res_type_name: row.res_type_name || '-',
      expected_value: row[cols.expectedValue],
      min_range: row[cols.minRange],
      max_range: row[cols.maxRange],
      trigger_maintenance: row[cols.triggerMaintenance],
      created_by: row[cols.createdBy],
      created_on: row[cols.createdOn]
    }));
  } catch (error) {
    console.error('Error fetching checklists:', error);
    throw error;
  }
};

const createChecklist = async (data) => {
  try {
    const dbPool = getDb();
    const cols = await getColumns();
    const id = generateCustomId('IC');
    
    const query = `
      INSERT INTO "tblInspectionChecklist" (
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
      data.irtd_id,
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
      updates.push(`${cols.responseTypeId} = $${paramCount++}`);
      values.push(data.irtd_id);
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
      UPDATE "tblInspectionChecklist" 
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
      DELETE FROM "tblInspectionChecklist" 
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
    
    // Using double quotes for case-sensitive table and column names
    // Filtering to get only one representative for Quantitative and one for Qualitative
    // as requested by the user to show only 2 values.
    const query = `
      SELECT "IRTD_Id", "Name" 
      FROM "tblInspResTypeDet"
      WHERE "IRTD_Id" IN ('IRTD_QN_001', 'IRTD_QL_YES_NO_001')
      ORDER BY "Name" DESC
    `;
    
    const result = await dbPool.query(query);
    return result.rows.map(row => ({
      irtd_id: row.IRTD_Id,
      name: row.Name === 'QN' ? 'Quantitative' : 'Qualitative'
    }));
  } catch (error) {
    console.error('Error fetching response types:', error);
    throw error;
  }
};

module.exports = {
  getAllChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  getResponseTypes
};
