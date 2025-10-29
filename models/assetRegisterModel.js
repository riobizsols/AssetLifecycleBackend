const db = require("../config/db");

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
    limit = 1000,
    offset = 0
  } = filters;

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

  if (branch_id) {
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
      a.description,
      a.asset_type_id,
      a.branch_id,
      a.purchase_vendor_id,
      a.service_vendor_id,
      a.expiry_date,
      a.warranty_period,
      a.created_on,
      a.changed_on
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
  const result = await db.query(query, queryParams);
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

  if (branch_id) {
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

  const result = await db.query(query, queryParams);
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

  const result = await db.query(query);
  return result.rows[0];
};

module.exports = {
  getAssetRegisterData,
  getAssetRegisterCount,
  getAssetRegisterFilterOptions
};
    