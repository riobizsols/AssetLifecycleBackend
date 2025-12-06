const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

const { generateCustomId } = require("../utils/idGenerator");

const ASSET_TYPE_REGEX = /^AT[0-9]+$/i;

const normalizeAssetTypeId = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return ASSET_TYPE_REGEX.test(trimmed) ? trimmed : null;
};

const getUsageEligibleAssetTypeIds = async (orgId) => {
  const query = `
    SELECT key, value
    FROM "tblOrgSettings"
    WHERE org_id = $1
      AND (
        key ~* '^AT[0-9]+$'
        OR key = 'at_id_usage_based'
      )
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [orgId]);
  const assetTypeIds = new Set();

  result.rows.forEach(({ key, value }) => {
    // Only use key as asset_type_id if it matches the pattern
    const normalizedKey = normalizeAssetTypeId(key);
    
    if (normalizedKey) {
      assetTypeIds.add(normalizedKey);
    }

    // Also check value if key is 'at_id_usage_based'
    if (key === "at_id_usage_based") {
      const normalizedValue = normalizeAssetTypeId(value);
      if (normalizedValue) {
        assetTypeIds.add(normalizedValue);
      }
    }
  });

  return Array.from(assetTypeIds);
};

const getAssignedAssetsForUser = async (employeeIntId, orgId, assetTypeIds, deptId = null) => {
  if (!assetTypeIds || assetTypeIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (a.asset_id)
      a.asset_id,
      a.asset_type_id,
      COALESCE(NULLIF(a.description, ''), a.text, a.asset_id) AS asset_name,
      a.serial_number,
      a.description,
      a.text,
      aa.asset_assign_id,
      aa.action_on AS assigned_on,
      aa.dept_id AS assigned_dept_id,
      CASE 
        WHEN aa.employee_int_id = $1 THEN 'USER'
        WHEN $4::text IS NOT NULL AND aa.dept_id = $4::text THEN 'DEPARTMENT'
        ELSE 'UNKNOWN'
      END AS assignment_scope
    FROM "tblAssetAssignments" aa
    INNER JOIN "tblAssets" a ON aa.asset_id = a.asset_id
    WHERE aa.action = 'A'
      AND aa.latest_assignment_flag = true
      AND a.org_id = $2
      AND a.asset_type_id = ANY($3::text[])
      AND a.current_status != 'SCRAPPED'
      AND (
        aa.employee_int_id = $1
        OR ($4::text IS NOT NULL AND aa.dept_id = $4::text)
      )
    ORDER BY a.asset_id, assignment_scope
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [employeeIntId, orgId, assetTypeIds, deptId]);
  return result.rows;
};

const isAssetAccessibleByUser = async (assetId, employeeIntId, orgId, deptId = null) => {
  const query = `
    SELECT 1
    FROM "tblAssetAssignments" aa
    INNER JOIN "tblAssets" a ON aa.asset_id = a.asset_id
    WHERE aa.asset_id = $1
      AND aa.action = 'A'
      AND aa.latest_assignment_flag = true
      AND a.org_id = $3
      AND a.current_status != 'SCRAPPED'
      AND (
        aa.employee_int_id = $2
        OR ($4::text IS NOT NULL AND aa.dept_id = $4::text)
      )
    LIMIT 1
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [assetId, employeeIntId, orgId, deptId]);
  return result.rows.length > 0;
};

const createUsageRecord = async ({ asset_id, usage_counter, created_by }) => {
  const aug_id = await generateCustomId("asset_usage");

  const query = `
    INSERT INTO "tblAssetUsageReg" (aug_id, asset_id, usage_counter, created_by, created_on)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    RETURNING aug_id, asset_id, usage_counter, created_by, created_on
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [aug_id, asset_id, usage_counter, created_by]);
  return result.rows[0];
};

const getUsageHistoryByAsset = async (assetId) => {
  const query = `
    SELECT 
      aur.aug_id,
      aur.asset_id,
      aur.usage_counter,
      aur.created_by,
      aur.created_on,
      u.full_name AS created_by_name
    FROM "tblAssetUsageReg" aur
    LEFT JOIN "tblUsers" u ON aur.created_by = u.user_id
    WHERE aur.asset_id = $1
    ORDER BY aur.created_on DESC
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [assetId]);
  return result.rows;
};

const getUsageReportData = async (orgId, filters = {}) => {
  const {
    assetId,
    assetTypeId,
    assetTypeIds,
    dateFrom,
    dateTo,
    createdBy,
    usageCounterMin,
    usageCounterMax,
    department,
    branchId,
    limit = 1000,
    offset = 0,
    advancedConditions,
  } = filters;

  let query = `
    SELECT 
      aur.aug_id,
      aur.asset_id,
      aur.usage_counter,
      aur.created_by,
      aur.created_on,
      u.full_name AS created_by_name,
      COALESCE(NULLIF(a.description, ''), a.text, a.asset_id) AS asset_name,
      a.serial_number,
      a.description AS asset_description,
      a.text,
      a.asset_type_id,
      at.text AS asset_type_name,
      a.branch_id,
      COALESCE(b.text, 'No Branch') AS branch_name,
      aa.dept_id AS department_id,
      COALESCE(d.text, 'Unassigned') AS department_name,
      e.name AS employee_name,
      e.employee_id
    FROM "tblAssetUsageReg" aur
    INNER JOIN "tblAssets" a ON aur.asset_id = a.asset_id
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblUsers" u ON aur.created_by = u.user_id
    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
    LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
      AND aa.action = 'A' 
      AND aa.latest_assignment_flag = true
    LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
    LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
    WHERE a.org_id = $1
      AND a.current_status != 'SCRAPPED'
  `;

  const params = [orgId];
  let paramIndex = 2;

  if (assetId) {
    query += ` AND aur.asset_id = $${paramIndex}`;
    params.push(assetId);
    paramIndex++;
  }

  if (assetTypeId) {
    query += ` AND a.asset_type_id = $${paramIndex}`;
    params.push(assetTypeId);
    paramIndex++;
  }

  if (assetTypeIds && Array.isArray(assetTypeIds) && assetTypeIds.length > 0) {
    query += ` AND a.asset_type_id = ANY($${paramIndex}::text[])`;
    params.push(assetTypeIds);
    paramIndex++;
  }

  if (dateFrom) {
    // If dateFrom is just a date string (YYYY-MM-DD), add time to cover start of day
    // This ensures we capture all records from that day
    const fromDate = dateFrom.includes(' ') ? dateFrom : `${dateFrom} 00:00:00`;
    query += ` AND aur.created_on >= $${paramIndex}::timestamp`;
    params.push(fromDate);
    paramIndex++;
  }

  if (dateTo) {
    // If dateTo is just a date string (YYYY-MM-DD), add time to cover end of day
    // This ensures we capture all records from that day, especially when dateFrom === dateTo (single day)
    const toDate = dateTo.includes(' ') ? dateTo : `${dateTo} 23:59:59`;
    query += ` AND aur.created_on <= $${paramIndex}::timestamp`;
    params.push(toDate);
    paramIndex++;
  }

  if (createdBy && Array.isArray(createdBy) && createdBy.length > 0) {
    query += ` AND aur.created_by = ANY($${paramIndex}::text[])`;
    params.push(createdBy);
    paramIndex++;
  } else if (createdBy && !Array.isArray(createdBy)) {
    query += ` AND aur.created_by = $${paramIndex}`;
    params.push(createdBy);
    paramIndex++;
  }

  if (usageCounterMin !== undefined && usageCounterMin !== null) {
    query += ` AND aur.usage_counter >= $${paramIndex}`;
    params.push(usageCounterMin);
    paramIndex++;
  }

  if (usageCounterMax !== undefined && usageCounterMax !== null) {
    query += ` AND aur.usage_counter <= $${paramIndex}`;
    params.push(usageCounterMax);
    paramIndex++;
  }

  if (department && Array.isArray(department) && department.length > 0) {
    query += ` AND aa.dept_id = ANY($${paramIndex}::text[])`;
    params.push(department);
    paramIndex++;
  } else if (department && !Array.isArray(department)) {
    query += ` AND aa.dept_id = $${paramIndex}`;
    params.push(department);
    paramIndex++;
  }

  // Apply branch filter only if user doesn't have super access
  if (!filters.hasSuperAccess) {
    if (branchId && Array.isArray(branchId) && branchId.length > 0) {
      query += ` AND a.branch_id = ANY($${paramIndex}::text[])`;
      params.push(branchId);
      paramIndex++;
    } else if (branchId && !Array.isArray(branchId)) {
      query += ` AND a.branch_id = $${paramIndex}`;
      params.push(branchId);
      paramIndex++;
    }
  }

  // Process advanced conditions
  if (advancedConditions && Array.isArray(advancedConditions) && advancedConditions.length > 0) {
    console.log('🔍 [AssetUsageModel] Processing advanced conditions:', JSON.stringify(advancedConditions, null, 2));
    advancedConditions.forEach((condition, index) => {
      console.log(`🔍 [AssetUsageModel] Processing condition ${index + 1}:`, condition);
      
      // Skip invalid conditions
      if (!condition.field || (!condition.op && !condition.operator) || condition.val === undefined || condition.val === null || condition.val === '') {
        console.log(`⚠️ [AssetUsageModel] Skipping invalid condition:`, condition);
        return;
      }
      
      // Skip if value is empty string or empty array
      if (typeof condition.val === 'string' && condition.val.trim() === '') {
        console.log(`⚠️ [AssetUsageModel] Skipping condition with empty value:`, condition);
        return;
      }
      if (Array.isArray(condition.val) && condition.val.length === 0) {
        console.log(`⚠️ [AssetUsageModel] Skipping condition with empty array:`, condition);
        return;
      }
      
      const { field } = condition;
      const op = condition.op || condition.operator;
      let val = condition.val;
      
      // Map frontend field names to database column names
      let dbField = '';
      let needsSpecialHandling = false;
      
      console.log(`🔍 [AssetUsageModel] Original field: ${field}, op: ${op}, val:`, val);
      
      switch (field) {
        case 'assetId':
          dbField = 'aur.asset_id';
          break;
        case 'assetName':
          // For asset name, use description or text
          dbField = 'COALESCE(NULLIF(a.description, \'\'), a.text, a.asset_id)';
          needsSpecialHandling = true;
          break;
        case 'serialNumber':
          dbField = 'a.serial_number';
          break;
        case 'assetType':
          dbField = 'at.text';
          break;
        case 'department':
          dbField = 'COALESCE(d.text, \'Unassigned\')';
          needsSpecialHandling = true;
          break;
        case 'branch':
          dbField = 'COALESCE(b.text, \'No Branch\')';
          needsSpecialHandling = true;
          break;
        case 'dateRange':
        case 'recordedDate':
          dbField = 'aur.created_on';
          break;
        case 'createdBy':
        case 'recordedBy':
          dbField = 'u.full_name';
          break;
        case 'usageCounter':
        case 'usageCounterMin':
        case 'usageCounterMax':
          dbField = 'aur.usage_counter';
          break;
        case 'employeeName':
          dbField = 'e.name';
          break;
        case 'assetDescription':
          dbField = 'a.description';
          break;
        default:
          console.warn(`⚠️ [AssetUsageModel] Unknown field: ${field}, skipping condition`);
          return;
      }
      
      console.log(`🔍 [AssetUsageModel] Mapped field: ${dbField}, op: ${op}, val:`, val);
      
      // Handle different operators
      if (op === '=' || op === 'equals') {
        if (Array.isArray(val)) {
          // Handle IN operator for multiselect
          if (val.length > 0) {
            const placeholders = val.map((_, i) => `$${paramIndex + i}`).join(', ');
            query += ` AND ${dbField} IN (${placeholders})`;
            val.forEach(v => params.push(v));
            paramIndex += val.length;
          }
        } else {
          if (needsSpecialHandling && (field === 'assetName' || field === 'department' || field === 'branch')) {
            query += ` AND LOWER(${dbField}) = LOWER($${paramIndex})`;
          } else {
            query += ` AND ${dbField} = $${paramIndex}`;
          }
          params.push(val);
          paramIndex++;
        }
      } else if (op === '!=' || op === 'not equals') {
        if (Array.isArray(val)) {
          // Handle NOT IN operator for multiselect
          if (val.length > 0) {
            const placeholders = val.map((_, i) => `$${paramIndex + i}`).join(', ');
            query += ` AND ${dbField} NOT IN (${placeholders})`;
            val.forEach(v => params.push(v));
            paramIndex += val.length;
          }
        } else {
          if (needsSpecialHandling && (field === 'assetName' || field === 'department' || field === 'branch')) {
            query += ` AND LOWER(${dbField}) != LOWER($${paramIndex})`;
          } else {
            query += ` AND ${dbField} != $${paramIndex}`;
          }
          params.push(val);
          paramIndex++;
        }
      } else if (op === 'contains' || op === 'like' || op === 'starts with' || op === 'ends with') {
        let pattern = '';
        if (op === 'contains' || op === 'like') {
          pattern = `%${val}%`;
        } else if (op === 'starts with') {
          pattern = `${val}%`;
        } else if (op === 'ends with') {
          pattern = `%${val}`;
        }
        
        if (field === 'assetName') {
          // For asset name, check both description and text
          query += ` AND (LOWER(COALESCE(NULLIF(a.description, ''), '')) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(a.text, '')) LIKE LOWER($${paramIndex}))`;
        } else {
          query += ` AND LOWER(${dbField}) LIKE LOWER($${paramIndex})`;
        }
        params.push(pattern);
        paramIndex++;
      } else if (op === 'not contains' || op === 'not like') {
        const pattern = `%${val}%`;
        if (field === 'assetName') {
          // For asset name, check both description and text
          query += ` AND NOT (LOWER(COALESCE(NULLIF(a.description, ''), '')) LIKE LOWER($${paramIndex}) OR LOWER(COALESCE(a.text, '')) LIKE LOWER($${paramIndex}))`;
        } else {
          query += ` AND LOWER(${dbField}) NOT LIKE LOWER($${paramIndex})`;
        }
        params.push(pattern);
        paramIndex++;
      } else if (op === '>=' || op === 'greater than or equal') {
        query += ` AND ${dbField} >= $${paramIndex}`;
        params.push(parseFloat(val) || 0);
        paramIndex++;
      } else if (op === '<=' || op === 'less than or equal') {
        query += ` AND ${dbField} <= $${paramIndex}`;
        params.push(parseFloat(val) || 0);
        paramIndex++;
      } else if (op === '>' || op === 'greater than') {
        query += ` AND ${dbField} > $${paramIndex}`;
        params.push(parseFloat(val) || 0);
        paramIndex++;
      } else if (op === '<' || op === 'less than') {
        query += ` AND ${dbField} < $${paramIndex}`;
        params.push(parseFloat(val) || 0);
        paramIndex++;
      } else if (op === 'in range') {
        // For date range or number range
        if (Array.isArray(val) && val.length === 2) {
          query += ` AND ${dbField} >= $${paramIndex} AND ${dbField} <= $${paramIndex + 1}`;
          params.push(val[0]);
          params.push(val[1]);
          paramIndex += 2;
        }
      } else if (op === 'before') {
        // For dates
        if (field === 'dateRange' || field === 'recordedDate') {
          query += ` AND ${dbField} < $${paramIndex}::timestamp`;
        } else {
          query += ` AND ${dbField} < $${paramIndex}`;
        }
        params.push(val);
        paramIndex++;
      } else if (op === 'after') {
        // For dates
        if (field === 'dateRange' || field === 'recordedDate') {
          query += ` AND ${dbField} > $${paramIndex}::timestamp`;
        } else {
          query += ` AND ${dbField} > $${paramIndex}`;
        }
        params.push(val);
        paramIndex++;
      } else if (op === 'is null' || op === 'is empty') {
        query += ` AND (${dbField} IS NULL OR ${dbField} = '')`;
      } else if (op === 'is not null' || op === 'is not empty') {
        query += ` AND (${dbField} IS NOT NULL AND ${dbField} != '')`;
      } else if (op === 'has any') {
        // For multiselect - at least one value matches
        if (Array.isArray(val) && val.length > 0) {
          const placeholders = val.map((_, i) => `$${paramIndex + i}`).join(', ');
          query += ` AND ${dbField} IN (${placeholders})`;
          val.forEach(v => params.push(v));
          paramIndex += val.length;
        }
      } else if (op === 'has all') {
        // For multiselect - all values must match (requires AND conditions)
        if (Array.isArray(val) && val.length > 0) {
          val.forEach(v => {
            query += ` AND ${dbField} = $${paramIndex}`;
            params.push(v);
            paramIndex++;
          });
        }
      } else if (op === 'has none') {
        // For multiselect - none of the values match
        if (Array.isArray(val) && val.length > 0) {
          const placeholders = val.map((_, i) => `$${paramIndex + i}`).join(', ');
          query += ` AND ${dbField} NOT IN (${placeholders})`;
          val.forEach(v => params.push(v));
          paramIndex += val.length;
        }
      } else {
        console.warn(`⚠️ [AssetUsageModel] Unknown operator: ${op}, skipping condition`);
        return;
      }
      
      console.log(`✅ [AssetUsageModel] Added condition: ${dbField} ${op}`, val);
    });
    
    console.log(`🔍 [AssetUsageModel] Query after advanced conditions:`, query);
    console.log(`🔍 [AssetUsageModel] Query parameters after advanced conditions:`, params);
  }

  query += ` ORDER BY aur.created_on DESC`;

  if (limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(limit);
    paramIndex++;
  }

  if (offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(offset);
    paramIndex++;
  }

  const dbPool = getDb();


  const result = await dbPool.query(query, params);
  return result.rows;
};

const getUsageReportSummary = async (orgId, filters = {}) => {
  const {
    assetTypeId,
    assetTypeIds,
    dateFrom,
    dateTo,
    department,
    branchId,
  } = filters;

  let query = `
    SELECT 
      COUNT(DISTINCT aur.asset_id) AS total_assets,
      COUNT(aur.aug_id) AS total_records,
      SUM(aur.usage_counter) AS total_usage,
      AVG(aur.usage_counter) AS avg_usage,
      MIN(aur.usage_counter) AS min_usage,
      MAX(aur.usage_counter) AS max_usage,
      MIN(aur.created_on) AS first_record_date,
      MAX(aur.created_on) AS last_record_date
    FROM "tblAssetUsageReg" aur
    INNER JOIN "tblAssets" a ON aur.asset_id = a.asset_id
    LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
      AND aa.action = 'A' 
      AND aa.latest_assignment_flag = true
    WHERE a.org_id = $1
      AND a.current_status != 'SCRAPPED'
  `;

  const params = [orgId];
  let paramIndex = 2;

  if (assetTypeId) {
    query += ` AND a.asset_type_id = $${paramIndex}`;
    params.push(assetTypeId);
    paramIndex++;
  }

  if (assetTypeIds && Array.isArray(assetTypeIds) && assetTypeIds.length > 0) {
    query += ` AND a.asset_type_id = ANY($${paramIndex}::text[])`;
    params.push(assetTypeIds);
    paramIndex++;
  }

  if (dateFrom) {
    query += ` AND aur.created_on >= $${paramIndex}::timestamp`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    query += ` AND aur.created_on <= $${paramIndex}::timestamp`;
    params.push(dateTo);
    paramIndex++;
  }

  if (department && Array.isArray(department) && department.length > 0) {
    query += ` AND aa.dept_id = ANY($${paramIndex}::text[])`;
    params.push(department);
    paramIndex++;
  } else if (department && !Array.isArray(department)) {
    query += ` AND aa.dept_id = $${paramIndex}`;
    params.push(department);
    paramIndex++;
  }

  // Apply branch filter only if user doesn't have super access
  if (!filters.hasSuperAccess) {
    if (branchId && Array.isArray(branchId) && branchId.length > 0) {
      query += ` AND a.branch_id = ANY($${paramIndex}::text[])`;
      params.push(branchId);
      paramIndex++;
    } else if (branchId && !Array.isArray(branchId)) {
      query += ` AND a.branch_id = $${paramIndex}`;
      params.push(branchId);
      paramIndex++;
    }
  }

  const dbPool = getDb();


  const result = await dbPool.query(query, params);
  return result.rows[0] || null;
};

const getAllAssetsForAssetTypes = async (orgId, assetTypeIds) => {
  if (!assetTypeIds || assetTypeIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT
      a.asset_id,
      a.asset_type_id,
      COALESCE(NULLIF(a.description, ''), a.text, a.asset_id) AS asset_name,
      a.serial_number,
      a.description,
      a.text,
      a.branch_id,
      at.text AS asset_type_name
    FROM "tblAssets" a
    INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    WHERE a.org_id = $1
      AND a.asset_type_id = ANY($2::text[])
      AND a.current_status != 'SCRAPPED'
    ORDER BY a.asset_id
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, [orgId, assetTypeIds]);
  return result.rows;
};

module.exports = {
  getUsageEligibleAssetTypeIds,
  getAssignedAssetsForUser,
  isAssetAccessibleByUser,
  createUsageRecord,
  getUsageHistoryByAsset,
  getUsageReportData,
  getUsageReportSummary,
  getAllAssetsForAssetTypes,
};

