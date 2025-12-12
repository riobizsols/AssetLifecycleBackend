const { getDbFromContext } = require('../utils/dbContext');
const { generateCustomId } = require('../utils/idGenerator');

// Helper function to get database connection
const getDb = () => getDbFromContext();

/**
 * Get all column access configurations for an organization
 */
const getAllColumnAccessConfigs = async (orgId, filters = {}) => {
  const { jobRoleId, tableName } = filters;
  
  let query = `
    SELECT 
      column_access_id,
      job_role_id,
      table_name,
      field_name,
      access_level,
      org_id,
      created_on,
      created_by,
      changed_on,
      changed_by
    FROM "tblColumnAccessConfig"
    WHERE org_id = $1
  `;
  
  const params = [orgId];
  let paramIndex = 2;
  
  if (jobRoleId) {
    query += ` AND job_role_id = $${paramIndex}`;
    params.push(jobRoleId);
    paramIndex++;
  }
  
  if (tableName) {
    query += ` AND table_name = $${paramIndex}`;
    params.push(tableName);
    paramIndex++;
  }
  
  query += ` ORDER BY job_role_id, table_name, field_name`;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, params);
  return result.rows;
};

/**
 * Get column access configuration by ID
 */
const getColumnAccessConfigById = async (columnAccessId, orgId) => {
  const query = `
    SELECT 
      column_access_id,
      job_role_id,
      table_name,
      field_name,
      access_level,
      org_id,
      created_on,
      created_by,
      changed_on,
      changed_by
    FROM "tblColumnAccessConfig"
    WHERE column_access_id = $1 AND org_id = $2
  `;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, [columnAccessId, orgId]);
  return result.rows[0] || null;
};

/**
 * Create or update column access configuration
 */
const upsertColumnAccessConfig = async (data, userId) => {
  const { jobRoleId, tableName, fieldName, accessLevel, orgId } = data;
  
  // Check if record exists
  const existingQuery = `
    SELECT column_access_id
    FROM "tblColumnAccessConfig"
    WHERE job_role_id = $1 
      AND table_name = $2 
      AND field_name = $3 
      AND org_id = $4
  `;
  
  const dbPool = getDb();
  const existingResult = await dbPool.query(existingQuery, [jobRoleId, tableName, fieldName, orgId]);
  
  if (existingResult.rows.length > 0) {
    // Update existing record
    const columnAccessId = existingResult.rows[0].column_access_id;
    const updateQuery = `
      UPDATE "tblColumnAccessConfig"
      SET access_level = $1,
          changed_on = CURRENT_TIMESTAMP,
          changed_by = $2
      WHERE column_access_id = $3
      RETURNING *
    `;
    const updateResult = await dbPool.query(updateQuery, [accessLevel, userId, columnAccessId]);
    return updateResult.rows[0];
  } else {
    // Create new record
    const columnAccessId = await generateCustomId("column_access");
    const insertQuery = `
      INSERT INTO "tblColumnAccessConfig" (
        column_access_id,
        job_role_id,
        table_name,
        field_name,
        access_level,
        org_id,
        created_by,
        created_on
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const insertResult = await dbPool.query(insertQuery, [
      columnAccessId,
      jobRoleId,
      tableName,
      fieldName,
      accessLevel,
      orgId,
      userId
    ]);
    return insertResult.rows[0];
  }
};

/**
 * Delete column access configuration
 */
const deleteColumnAccessConfig = async (columnAccessId, orgId) => {
  const query = `
    DELETE FROM "tblColumnAccessConfig"
    WHERE column_access_id = $1 AND org_id = $2
    RETURNING *
  `;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, [columnAccessId, orgId]);
  return result.rows[0] || null;
};

/**
 * Bulk upsert column access configurations
 */
const bulkUpsertColumnAccessConfigs = async (configs, userId, orgId) => {
  const dbPool = getDb();
  
  try {
    await dbPool.query('BEGIN');
    
    const results = [];
    for (const config of configs) {
      const { jobRoleId, tableName, fieldName, accessLevel } = config;
      
      // Check if record exists
      const existingQuery = `
        SELECT column_access_id
        FROM "tblColumnAccessConfig"
        WHERE job_role_id = $1 
          AND table_name = $2 
          AND field_name = $3 
          AND org_id = $4
      `;
      const existingResult = await dbPool.query(existingQuery, [jobRoleId, tableName, fieldName, orgId]);
      
      if (existingResult.rows.length > 0) {
        // Update existing
        const columnAccessId = existingResult.rows[0].column_access_id;
        const updateQuery = `
          UPDATE "tblColumnAccessConfig"
          SET access_level = $1,
              changed_on = CURRENT_TIMESTAMP,
              changed_by = $2
          WHERE column_access_id = $3
          RETURNING *
        `;
        const updateResult = await dbPool.query(updateQuery, [accessLevel, userId, columnAccessId]);
        results.push(updateResult.rows[0]);
      } else {
        // Insert new
        const columnAccessId = await generateCustomId("column_access");
        const insertQuery = `
          INSERT INTO "tblColumnAccessConfig" (
            column_access_id,
            job_role_id,
            table_name,
            field_name,
            access_level,
            org_id,
            created_by,
            created_on
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          RETURNING *
        `;
        const insertResult = await dbPool.query(insertQuery, [
          columnAccessId,
          jobRoleId,
          tableName,
          fieldName,
          accessLevel,
          orgId,
          userId
        ]);
        results.push(insertResult.rows[0]);
      }
    }
    
    await dbPool.query('COMMIT');
    return results;
  } catch (error) {
    await dbPool.query('ROLLBACK');
    throw error;
  }
};

/**
 * Get column access for a specific job role and table
 */
const getColumnAccessForJobRoleAndTable = async (jobRoleId, tableName, orgId) => {
  const query = `
    SELECT 
      field_name,
      access_level
    FROM "tblColumnAccessConfig"
    WHERE job_role_id = $1 
      AND table_name = $2 
      AND org_id = $3
  `;
  
  const dbPool = getDb();
  const result = await dbPool.query(query, [jobRoleId, tableName, orgId]);
  
  // Convert to map for easier lookup
  const accessMap = {};
  result.rows.forEach(row => {
    accessMap[row.field_name] = row.access_level;
  });
  
  return accessMap;
};

module.exports = {
  getAllColumnAccessConfigs,
  getColumnAccessConfigById,
  upsertColumnAccessConfig,
  deleteColumnAccessConfig,
  bulkUpsertColumnAccessConfigs,
  getColumnAccessForJobRoleAndTable
};

