const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get asset register data with all necessary joins
const getAssetRegisterData = async (filters = {}) => {
  console.log('🔍 [AssetRegisterModel] Received filters:', JSON.stringify(filters, null, 2));
  
  const {
    assetId,
    department,
    employee,
    vendor,
    poNumber,
    invoiceNumber,
    category,
    location,
    branch_id,
    purchaseDateRange,
    commissionedDateRange,
    currentStatus,
    cost,
    status,
    advancedConditions,
    orgId,
    org_id,
    limit = 1000,
    offset = 0
  } = filters;
  
  // Store orgId for use in property filters
  filters.orgId = orgId || org_id;

  let whereConditions = [];
  let queryParams = [];
  let paramCount = 0;

  // Build dynamic WHERE conditions
  if (assetId) {
    paramCount++;
    whereConditions.push(`a.asset_id ILIKE $${paramCount}`);
    queryParams.push(`%${assetId}%`);
  }

  if (department && department.length > 0) {
    paramCount++;
    whereConditions.push(`d.text = ANY($${paramCount})`);
    queryParams.push(department);
  }

  if (employee && employee.length > 0) {
    paramCount++;
    whereConditions.push(`e.name = ANY($${paramCount})`);
    queryParams.push(employee);
  }

  if (vendor && vendor.length > 0) {
    paramCount++;
    whereConditions.push(`(v.vendor_name = ANY($${paramCount}) OR vs.vendor_name = ANY($${paramCount}))`);
    queryParams.push(vendor);
  }

  // Note: po_number and invoice_number fields don't exist in current schema
  // Since these fields are hardcoded to 'N/A' in the SELECT, we need to filter them out
  // when specific values are searched (since 'N/A' will never match real PO/Invoice numbers)
  if (poNumber) {
    paramCount++;
    whereConditions.push(`'N/A' ILIKE $${paramCount}`);
    queryParams.push(`%${poNumber}%`);
    console.log(`🔍 [AssetRegisterModel] Added PO Number filter: 'N/A' ILIKE '%${poNumber}%'`);
  }

  if (invoiceNumber) {
    paramCount++;
    whereConditions.push(`'N/A' ILIKE $${paramCount}`);
    queryParams.push(`%${invoiceNumber}%`);
    console.log(`🔍 [AssetRegisterModel] Added Invoice Number filter: 'N/A' ILIKE '%${invoiceNumber}%'`);
  }

  if (category && category.length > 0) {
    paramCount++;
    whereConditions.push(`at.text = ANY($${paramCount})`);
    queryParams.push(category);
  }

  if (location && location.length > 0) {
    paramCount++;
    whereConditions.push(`b.text = ANY($${paramCount})`);
    queryParams.push(location);
  }

  // Apply branch filter only if user doesn't have super access
  if (branch_id && !filters.hasSuperAccess) {
    paramCount++;
    whereConditions.push(`a.branch_id = $${paramCount}`);
    queryParams.push(branch_id);
  }

  if (purchaseDateRange && purchaseDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  // Note: commissioned_date field doesn't exist in current schema
  // Using purchased_on as fallback until the field is added to the database
  if (commissionedDateRange && commissionedDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (cost) {
    paramCount++;
    whereConditions.push(`CAST(a.purchased_cost AS DECIMAL) >= $${paramCount}`);
    queryParams.push(cost);
  }

  // Note: status field doesn't exist in current schema
  // Using current_status as fallback until the field is added to the database
  if (status && status.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(status);
  }

  // Process advanced conditions
  if (advancedConditions && advancedConditions.length > 0) {
    console.log('🔍 [AssetRegisterModel] Processing advanced conditions:', advancedConditions);
    advancedConditions.forEach(condition => {
      if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
        const { field, op, val } = condition;
        
        // Handle property-value filter separately
        if (field === 'property' && val && typeof val === 'object' && val.property && val.value) {
          const propertyName = val.property;
          const propertyValue = val.value;
          
          paramCount++;
          const orgIdParam = paramCount;
          queryParams.push(filters.orgId || filters.org_id || 'ORG001'); // Get orgId from filters
          
          paramCount++;
          const propertyNameParam = paramCount;
          queryParams.push(propertyName);
          
          paramCount++;
          const propertyValueParam = paramCount;
          queryParams.push(propertyValue);
          
          // Add EXISTS clause for property-value match
          // Try direct join first (matching getAssetProperties pattern)
          // If that doesn't work, also try join through tblAssetTypeProps
          const propertyCondition = `(EXISTS (
            SELECT 1 FROM "tblAssetPropValues" apv
            LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
            WHERE apv.asset_id = a.asset_id
            AND a.org_id = $${orgIdParam}
            AND LOWER(COALESCE(p.property, '')) = LOWER($${propertyNameParam})
            AND LOWER(apv.value) = LOWER($${propertyValueParam})
            AND p.property IS NOT NULL
          ) OR EXISTS (
            SELECT 1 FROM "tblAssetPropValues" apv
            INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
            INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
            WHERE apv.asset_id = a.asset_id
            AND a.org_id = $${orgIdParam}
            AND LOWER(p.property) = LOWER($${propertyNameParam})
            AND LOWER(apv.value) = LOWER($${propertyValueParam})
          ))`;
          
          whereConditions.push(propertyCondition);
          console.log(`✅ [AssetRegisterModel] Added property filter: ${propertyName} = ${propertyValue} (params: ${orgIdParam}, ${propertyNameParam}, ${propertyValueParam})`);
          console.log(`✅ [AssetRegisterModel] Added property filter: ${propertyName} = ${propertyValue}`);
          return;
        }
        
        // Map field keys to database columns
        const fieldMapping = {
          'assetId': 'a.asset_id',
          'assetName': 'a.text',
          'department': 'd.text',
          'employee': 'e.name',
          'vendor': 'COALESCE(v.vendor_name, vs.vendor_name)',
          'poNumber': "'N/A'",
          'invoiceNumber': "'N/A'",
          'category': 'at.text',
          'location': 'b.text',
          'branchId': 'a.branch_id',
          'purchaseDateRange': 'a.purchased_on',
          'commissionedDateRange': 'a.purchased_on',
          'currentStatus': 'a.current_status',
          'cost': 'CAST(a.purchased_cost AS DECIMAL)',
          'status': 'a.current_status'
        };
        
        const dbField = fieldMapping[field];
        console.log(`🔍 [AssetRegisterModel] Processing condition: field=${field}, op=${op}, val=${val}, dbField=${dbField}`);
        if (dbField) {
          paramCount++;
          let conditionClause = '';
          
          switch (op) {
            case '=':
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
              break;
            case 'contains':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`%${val}%`);
              break;
            case 'starts with':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`${val}%`);
              break;
            case 'ends with':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`%${val}`);
              break;
            case '>':
              conditionClause = `${dbField} > $${paramCount}`;
              queryParams.push(val);
              break;
            case '<':
              conditionClause = `${dbField} < $${paramCount}`;
              queryParams.push(val);
              break;
            case '>=':
              conditionClause = `${dbField} >= $${paramCount}`;
              queryParams.push(val);
              break;
            case '<=':
              conditionClause = `${dbField} <= $${paramCount}`;
              queryParams.push(val);
              break;
            case '!=':
              conditionClause = `${dbField} != $${paramCount}`;
              queryParams.push(val);
              break;
            case 'has any':
              conditionClause = `${dbField} = ANY($${paramCount})`;
              queryParams.push(Array.isArray(val) ? val : [val]);
              break;
            case 'has all':
              conditionClause = `${dbField} @> $${paramCount}`;
              queryParams.push(JSON.stringify(Array.isArray(val) ? val : [val]));
              break;
            case 'has none':
              conditionClause = `NOT (${dbField} && $${paramCount})`;
              queryParams.push(JSON.stringify(Array.isArray(val) ? val : [val]));
              break;
            default:
              // Default to equals
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
          }
          
          whereConditions.push(conditionClause);
          console.log(`✅ [AssetRegisterModel] Added condition: ${conditionClause}`);
        }
      }
    });
    console.log('🔍 [AssetRegisterModel] Final where conditions:', whereConditions);
  }

  // Add pagination parameters
  paramCount++;
  queryParams.push(limit);
  paramCount++;
  queryParams.push(offset);

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  console.log('🔍 [AssetRegisterModel] Final WHERE clause:', whereClause);
  console.log('🔍 [AssetRegisterModel] Query parameters:', queryParams);

  const query = `
    SELECT 
      a.asset_id as "Asset ID",
      a.text as "Asset Name",
      COALESCE(d.text, 'Unassigned') as "Department",
      COALESCE(e.name, 'Unassigned') as "Assigned Employee",
      COALESCE(v.vendor_name, vs.vendor_name, 'No Vendor') as "Vendor",
      'N/A' as "PO Number",
      'N/A' as "Invoice Number",
      at.text as "Category",
      COALESCE(b.text, 'No Location') as "Location",
      a.purchased_on as "Purchase Date",
      a.purchased_on as "Commissioned Date",
      a.current_status as "Current Status",
      CAST(a.purchased_cost AS DECIMAL) as "Cost",
      a.current_status as "Status",
      a.serial_number,
      a.description as "description",
      a.asset_type_id,
      a.branch_id,
      a.purchase_vendor_id,
      a.service_vendor_id,
      a.expiry_date,
      a.warranty_period,
      a.created_on,
      a.changed_on,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'property', p.property,
              'value', apv.value
            )
          )
          FROM "tblAssetPropValues" apv
          LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
          WHERE apv.asset_id = a.asset_id
          AND apv.value IS NOT NULL
          AND apv.value != ''
          AND p.property IS NOT NULL
        ),
        '[]'::json
      ) as "Properties"
    FROM "tblAssets" a
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
    LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
    LEFT JOIN "tblVendors" vs ON a.service_vendor_id = vs.vendor_id
    LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
      AND aa.action = 'A' 
      AND aa.latest_assignment_flag = true
    LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
    LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
    ${whereClause}
    ORDER BY a.created_on DESC
    LIMIT $${paramCount - 1} OFFSET $${paramCount}
  `;

  console.log('🔍 [AssetRegisterModel] Executing query:', query);
  const dbPool = getDb();

  const result = await dbPool.query(query, queryParams);
  console.log('🔍 [AssetRegisterModel] Query result count:', result.rows.length);
  
  return result;
};

// Get total count for pagination
const getAssetRegisterCount = async (filters = {}) => {
  const {
    assetId,
    department,
    employee,
    vendor,
    poNumber,
    invoiceNumber,
    category,
    location,
    branch_id,
    purchaseDateRange,
    commissionedDateRange,
    currentStatus,
    cost,
    status,
    advancedConditions
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramCount = 0;

  // Build dynamic WHERE conditions (same as above)
  if (assetId) {
    paramCount++;
    whereConditions.push(`a.asset_id ILIKE $${paramCount}`);
    queryParams.push(`%${assetId}%`);
  }

  if (department && department.length > 0) {
    paramCount++;
    whereConditions.push(`d.text = ANY($${paramCount})`);
    queryParams.push(department);
  }

  if (employee && employee.length > 0) {
    paramCount++;
    whereConditions.push(`e.name = ANY($${paramCount})`);
    queryParams.push(employee);
  }

  if (vendor && vendor.length > 0) {
    paramCount++;
    whereConditions.push(`(v.vendor_name = ANY($${paramCount}) OR vs.vendor_name = ANY($${paramCount}))`);
    queryParams.push(vendor);
  }

  // Note: po_number and invoice_number fields don't exist in current schema
  // Since these fields are hardcoded to 'N/A' in the SELECT, we need to filter them out
  // when specific values are searched (since 'N/A' will never match real PO/Invoice numbers)
  if (poNumber) {
    paramCount++;
    whereConditions.push(`'N/A' ILIKE $${paramCount}`);
    queryParams.push(`%${poNumber}%`);
    console.log(`🔍 [AssetRegisterModel] Added PO Number filter: 'N/A' ILIKE '%${poNumber}%'`);
  }

  if (invoiceNumber) {
    paramCount++;
    whereConditions.push(`'N/A' ILIKE $${paramCount}`);
    queryParams.push(`%${invoiceNumber}%`);
    console.log(`🔍 [AssetRegisterModel] Added Invoice Number filter: 'N/A' ILIKE '%${invoiceNumber}%'`);
  }

  if (category && category.length > 0) {
    paramCount++;
    whereConditions.push(`at.text = ANY($${paramCount})`);
    queryParams.push(category);
  }

  if (location && location.length > 0) {
    paramCount++;
    whereConditions.push(`b.text = ANY($${paramCount})`);
    queryParams.push(location);
  }

  // Apply branch filter only if user doesn't have super access
  if (branch_id && !filters.hasSuperAccess) {
    paramCount++;
    whereConditions.push(`a.branch_id = $${paramCount}`);
    queryParams.push(branch_id);
  }

  if (purchaseDateRange && purchaseDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  // Note: commissioned_date field doesn't exist in current schema
  // Using purchased_on as fallback until the field is added to the database
  if (commissionedDateRange && commissionedDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (cost) {
    paramCount++;
    whereConditions.push(`CAST(a.purchased_cost AS DECIMAL) >= $${paramCount}`);
    queryParams.push(cost);
  }

  // Note: status field doesn't exist in current schema
  // Using current_status as fallback until the field is added to the database
  if (status && status.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(status);
  }

  // Process advanced conditions (same logic as in getAssetRegisterData)
  if (advancedConditions && advancedConditions.length > 0) {
    advancedConditions.forEach(condition => {
      if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
        const { field, op, val } = condition;
        
        // Map field keys to database columns
        const fieldMapping = {
          'assetId': 'a.asset_id',
          'assetName': 'a.text',
          'department': 'd.text',
          'employee': 'e.name',
          'vendor': 'COALESCE(v.vendor_name, vs.vendor_name)',
          'poNumber': "'N/A'",
          'invoiceNumber': "'N/A'",
          'category': 'at.text',
          'location': 'b.text',
          'branchId': 'a.branch_id',
          'purchaseDateRange': 'a.purchased_on',
          'commissionedDateRange': 'a.purchased_on',
          'currentStatus': 'a.current_status',
          'cost': 'CAST(a.purchased_cost AS DECIMAL)',
          'status': 'a.current_status'
        };
        
        const dbField = fieldMapping[field];
        console.log(`🔍 [AssetRegisterModel] Processing condition: field=${field}, op=${op}, val=${val}, dbField=${dbField}`);
        if (dbField) {
          paramCount++;
          let conditionClause = '';
          
          switch (op) {
            case '=':
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
              break;
            case 'contains':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`%${val}%`);
              break;
            case 'starts with':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`${val}%`);
              break;
            case 'ends with':
              conditionClause = `${dbField} ILIKE $${paramCount}`;
              queryParams.push(`%${val}`);
              break;
            case '>':
              conditionClause = `${dbField} > $${paramCount}`;
              queryParams.push(val);
              break;
            case '<':
              conditionClause = `${dbField} < $${paramCount}`;
              queryParams.push(val);
              break;
            case '>=':
              conditionClause = `${dbField} >= $${paramCount}`;
              queryParams.push(val);
              break;
            case '<=':
              conditionClause = `${dbField} <= $${paramCount}`;
              queryParams.push(val);
              break;
            case '!=':
              conditionClause = `${dbField} != $${paramCount}`;
              queryParams.push(val);
              break;
            case 'has any':
              conditionClause = `${dbField} = ANY($${paramCount})`;
              queryParams.push(Array.isArray(val) ? val : [val]);
              break;
            case 'has all':
              conditionClause = `${dbField} @> $${paramCount}`;
              queryParams.push(JSON.stringify(Array.isArray(val) ? val : [val]));
              break;
            case 'has none':
              conditionClause = `NOT (${dbField} && $${paramCount})`;
              queryParams.push(JSON.stringify(Array.isArray(val) ? val : [val]));
              break;
            default:
              // Default to equals
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
          }
          
          whereConditions.push(conditionClause);
        }
      }
    });
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT COUNT(*) as total
    FROM "tblAssets" a
    LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
    LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
    LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
    LEFT JOIN "tblVendors" vs ON a.service_vendor_id = vs.vendor_id
    LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
      AND aa.action = 'A' 
      AND aa.latest_assignment_flag = true
    LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
    LEFT JOIN "tblEmployees" e ON aa.employee_int_id = e.emp_int_id
    ${whereClause}
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query, queryParams);
  return result.rows[0].total;
};

// Get filter options for dropdowns
const getAssetRegisterFilterOptions = async () => {
  const query = `
    SELECT 
      (SELECT JSON_AGG(DISTINCT at.text) FROM "tblAssetTypes" at WHERE at.int_status = 1) as categories,
      (SELECT JSON_AGG(DISTINCT b.text) FROM "tblBranches" b) as locations,
      (SELECT JSON_AGG(DISTINCT d.text) FROM "tblDepartments" d) as departments,
      (SELECT JSON_AGG(DISTINCT e.name) FROM "tblEmployees" e) as employees,
      (SELECT JSON_AGG(DISTINCT v.vendor_name) FROM "tblVendors" v) as vendors,
      (SELECT JSON_AGG(DISTINCT a.current_status) FROM "tblAssets" a WHERE a.current_status IS NOT NULL) as current_statuses,
      (SELECT JSON_AGG(DISTINCT a.current_status) FROM "tblAssets" a WHERE a.current_status IS NOT NULL) as statuses
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query);
  return result.rows[0];
};

// Get distinct values for a property from tblAssetPropValues
// Following the pattern from assetModel.getAssetProperties (direct join)
const getPropertyValues = async (propertyName, orgId, assetId = null) => {
  console.log('🔍 [getPropertyValues] Query params:', { propertyName, orgId, assetId });
  const dbPool = getDb();
  let query;
  let params;
  let result;

  // Use direct join (asset_type_prop_id = prop_id) matching the pattern in assetModel
  if (assetId) {
    query = `
      SELECT DISTINCT apv.value
      FROM "tblAssetPropValues" apv
      LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
      INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
      WHERE a.asset_id = $1
      AND a.org_id = $2
      AND LOWER(p.property) = LOWER($3)
      AND (p.org_id = $2 OR p.org_id IS NULL)
      AND (p.int_status = 1 OR p.int_status IS NULL)
      AND apv.value IS NOT NULL
      AND apv.value != ''
      ORDER BY apv.value
    `;
    params = [assetId, orgId, propertyName];
  } else {
    query = `
      SELECT DISTINCT apv.value
      FROM "tblAssetPropValues" apv
      LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
      INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
      WHERE LOWER(p.property) = LOWER($1)
      AND p.org_id = $2
      AND a.org_id = $2
      AND p.int_status = 1
      AND apv.value IS NOT NULL
      AND apv.value != ''
      ORDER BY apv.value
    `;
    params = [propertyName, orgId];
  }

  result = await dbPool.query(query, params);

  // If no results, try joining through tblAssetTypeProps
  if (result.rows.length === 0) {
    console.log('⚠️ [getPropertyValues] No results with direct join, trying through tblAssetTypeProps');
    if (assetId) {
      query = `
        SELECT DISTINCT apv.value
        FROM "tblAssetPropValues" apv
        INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
        INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
        INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
        WHERE a.asset_id = $1
        AND a.org_id = $2
        AND LOWER(p.property) = LOWER($3)
        AND p.org_id = $2
        AND p.int_status = 1
        AND apv.value IS NOT NULL
        AND apv.value != ''
        ORDER BY apv.value
      `;
      params = [assetId, orgId, propertyName];
    } else {
      query = `
        SELECT DISTINCT apv.value
        FROM "tblAssetPropValues" apv
        INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
        INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
        INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
        WHERE LOWER(p.property) = LOWER($1)
        AND p.org_id = $2
        AND a.org_id = $2
        AND p.int_status = 1
        AND apv.value IS NOT NULL
        AND apv.value != ''
        ORDER BY apv.value
      `;
      params = [propertyName, orgId];
    }
    result = await dbPool.query(query, params);
  }

  console.log('✅ [getPropertyValues] Found values:', result.rows.length);
  if (result.rows.length > 0) {
    console.log('📋 Sample values:', result.rows.slice(0, 3).map(r => r.value));
  }
  return result.rows.map(row => row.value);
};

// Get properties for a specific asset
// Following the pattern from assetModel.getAssetProperties
// Uses: tblAssetPropValues -> tblProps (direct join on asset_type_prop_id = prop_id)
const getAssetProperties = async (assetId, orgId) => {
  // First check if asset has any property values
  const debugQuery = `SELECT COUNT(*) as count FROM "tblAssetPropValues" WHERE asset_id = $1`;
  const dbPool = getDb();
  const debugResult = await dbPool.query(debugQuery, [assetId]);
  console.log('🔍 [getAssetProperties] Asset has', debugResult.rows[0].count, 'property value entries');

  const query = `
    SELECT DISTINCT
      p.prop_id,
      p.property
    FROM "tblAssetPropValues" apv
    LEFT JOIN "tblProps" p ON apv.asset_type_prop_id = p.prop_id
    INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
    WHERE a.asset_id = $1
    AND a.org_id = $2
    AND (p.org_id = $2 OR p.org_id IS NULL)
    AND (p.int_status = 1 OR p.int_status IS NULL)
    AND apv.value IS NOT NULL
    AND apv.value != ''
    AND p.property IS NOT NULL
    ORDER BY p.property
  `;

  console.log('🔍 [getAssetProperties] Query params:', { assetId, orgId });
  const result = await dbPool.query(query, [assetId, orgId]);
  
  console.log('✅ [getAssetProperties] Query result:', result.rows.length, 'properties');
  if (result.rows.length > 0) {
    console.log('📋 Sample properties:', result.rows.slice(0, 3));
  } else {
    // Try alternative join if no results
    console.log('⚠️ [getAssetProperties] No results, trying alternative join through tblAssetTypeProps');
    const altQuery = `
      SELECT DISTINCT
        p.prop_id,
        p.property
      FROM "tblAssetPropValues" apv
      INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
      INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
      INNER JOIN "tblAssets" a ON apv.asset_id = a.asset_id
      WHERE a.asset_id = $1
      AND a.org_id = $2
      AND p.org_id = $2
      AND p.int_status = 1
      AND apv.value IS NOT NULL
      AND apv.value != ''
      ORDER BY p.property
    `;
    const altResult = await dbPool.query(altQuery, [assetId, orgId]);
    console.log('✅ [getAssetProperties] Alternative query result:', altResult.rows.length, 'properties');
    return altResult.rows;
  }
  
  return result.rows;
};

module.exports = {
  getAssetRegisterData,
  getAssetRegisterCount,
  getAssetRegisterFilterOptions,
  getPropertyValues,
  getAssetProperties
};
    