const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get asset lifecycle data with all necessary joins
const getAssetLifecycleData = async (filters = {}) => {
  console.log('🔍 [AssetLifecycleModel] Received filters:', JSON.stringify(filters, null, 2));
  
  const {
    purchaseDateRange,
    commissionedDateRange,
    assetUsageHistory,
    currentStatus,
    scrapDateRange,
    scrapLocation,
    scrappedBy,
    buyer,
    saleDateRange,
    saleAmount,
    branch_id,
    advancedConditions,
    limit = 1000,
    offset = 0
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramCount = 0;

  // Add branch_id filter first
  if (branch_id) {
    paramCount++;
    whereConditions.push(`a.branch_id = $${paramCount}`);
    queryParams.push(branch_id);
  }

  // Build dynamic WHERE conditions
  if (purchaseDateRange && purchaseDateRange.length === 2 && 
      purchaseDateRange[0] && purchaseDateRange[0].trim() !== '' && 
      purchaseDateRange[1] && purchaseDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`purchase_date >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`purchase_date <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  if (commissionedDateRange && commissionedDateRange.length === 2 && 
      commissionedDateRange[0] && commissionedDateRange[0].trim() !== '' && 
      commissionedDateRange[1] && commissionedDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`commissioned_date >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`commissioned_date <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (assetUsageHistory && assetUsageHistory.length > 0) {
    // Asset usage history is a computed field with formatted text, so we need to use LIKE
    const usageConditions = assetUsageHistory.map(usage => {
      paramCount++;
      if (usage === 'No Assignment') {
        // Exact match for "No Assignment"
        return `asset_usage_history = $${paramCount}`;
      } else {
        // Map user-friendly labels back to action codes for filtering
        const actionCode = usage === 'Assigned' ? 'A' : 
                          usage === 'Unassigned' ? 'U' : 
                          usage === 'Returned' ? 'R' : 
                          usage === 'Transferred' ? 'T' : usage;
        
        // Match the action at the end of the formatted string: "Assigned to: Department - ACTION"
        return `asset_usage_history ILIKE $${paramCount}`;
      }
    });
    queryParams.push(...assetUsageHistory.map(usage => {
      if (usage === 'No Assignment') {
        return usage;
      } else {
        // Map user-friendly labels back to action codes for filtering
        const actionCode = usage === 'Assigned' ? 'A' : 
                          usage === 'Unassigned' ? 'U' : 
                          usage === 'Returned' ? 'R' : 
                          usage === 'Transferred' ? 'T' : usage;
        return `% - ${actionCode}`;
      }
    }));
    whereConditions.push(`(${usageConditions.join(' OR ')})`);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (scrapDateRange && scrapDateRange.length === 2 && 
      scrapDateRange[0] && scrapDateRange[0].trim() !== '' && 
      scrapDateRange[1] && scrapDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`scrap_date >= $${paramCount}`);
    queryParams.push(scrapDateRange[0]);
    paramCount++;
    whereConditions.push(`scrap_date <= $${paramCount}`);
    queryParams.push(scrapDateRange[1]);
  }

  if (scrapLocation && scrapLocation.length > 0) {
    paramCount++;
    whereConditions.push(`scrap_location = ANY($${paramCount})`);
    queryParams.push(scrapLocation);
  }

  if (scrappedBy && scrappedBy.length > 0) {
    paramCount++;
    whereConditions.push(`scrapped_by = ANY($${paramCount})`);
    queryParams.push(scrappedBy);
  }

  if (buyer && buyer.length > 0) {
    paramCount++;
    whereConditions.push(`buyer = ANY($${paramCount})`);
    queryParams.push(buyer);
  }

  if (saleDateRange && saleDateRange.length === 2 && 
      saleDateRange[0] && saleDateRange[0].trim() !== '' && 
      saleDateRange[1] && saleDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`sale_date >= $${paramCount}`);
    queryParams.push(saleDateRange[0]);
    paramCount++;
    whereConditions.push(`sale_date <= $${paramCount}`);
    queryParams.push(saleDateRange[1]);
  }

  if (saleAmount) {
    paramCount++;
    whereConditions.push(`sale_amount >= $${paramCount}`);
    queryParams.push(saleAmount);
  }

  // Process advanced conditions
  if (advancedConditions && advancedConditions.length > 0) {
    console.log('🔍 [AssetLifecycleModel] Processing advanced conditions:', advancedConditions);
    advancedConditions.forEach(condition => {
      if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
        const { field, op, val } = condition;
        
        // Map field keys to CTE column names (since WHERE clause is applied to final SELECT)
        const fieldMapping = {
          'assetId': 'asset_id',
          'assetName': 'asset_name',
          'category': 'category',
          'location': 'location',
          'branchId': 'branch_id',
          'department': 'department',
          'vendor': 'vendor',
          'purchaseDateRange': 'purchase_date',
          'commissionedDateRange': 'commissioned_date',
          'assetUsageHistory': 'asset_usage_history',
          'currentStatus': 'current_status',
          'scrapDateRange': 'scrap_date',
          'scrapLocation': 'scrap_location',
          'scrappedBy': 'scrapped_by',
          'buyer': 'buyer',
          'saleDateRange': 'sale_date',
          'saleAmount': 'sale_amount'
        };
        
        const dbField = fieldMapping[field];
        console.log(`🔍 [AssetLifecycleModel] Processing condition: field=${field}, op=${op}, val=${val}, dbField=${dbField}`);
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
            case 'in range':
              // Handle date range - val should be an array [startDate, endDate]
              if (Array.isArray(val) && val.length === 2) {
                const startDate = val[0] && val[0].trim() !== '' ? val[0] : null;
                const endDate = val[1] && val[1].trim() !== '' ? val[1] : null;
                
                if (startDate && endDate) {
                  // Both dates provided - use range
                  paramCount++;
                  conditionClause = `${dbField} >= $${paramCount - 1} AND ${dbField} <= $${paramCount}`;
                  queryParams.push(startDate);
                  queryParams.push(endDate);
                } else if (startDate && !endDate) {
                  // Only start date provided - use "after" logic
                  conditionClause = `${dbField} >= $${paramCount}`;
                  queryParams.push(startDate);
                } else if (!startDate && endDate) {
                  // Only end date provided - use "before" logic
                  conditionClause = `${dbField} <= $${paramCount}`;
                  queryParams.push(endDate);
                } else {
                  console.log(`⚠️ [AssetLifecycleModel] Invalid date range format - at least one date must be provided: ${val}`);
                  conditionClause = null; // Skip this condition
                }
              } else {
                console.log(`⚠️ [AssetLifecycleModel] Invalid date range format - must be an array: ${val}`);
                conditionClause = null; // Skip this condition
              }
              break;
            case 'before':
              conditionClause = `${dbField} < $${paramCount}`;
              queryParams.push(val);
              break;
            case 'after':
              conditionClause = `${dbField} > $${paramCount}`;
              queryParams.push(val);
              break;
            default:
              // Default to equals
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
          }
          
          if (conditionClause) {
            whereConditions.push(conditionClause);
          }
          console.log(`✅ [AssetLifecycleModel] Added condition: ${conditionClause}`);
        }
      }
    });
    console.log('🔍 [AssetLifecycleModel] Final where conditions:', whereConditions);
  }

  // Add pagination parameters
  paramCount++;
  queryParams.push(limit);
  paramCount++;
  queryParams.push(offset);

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  console.log('🔍 [AssetLifecycleModel] Final WHERE clause:', whereClause);
  console.log('🔍 [AssetLifecycleModel] Query parameters:', queryParams);

  const query = `
    WITH latest_scrap AS (
      SELECT DISTINCT ON (asset_id) 
        asset_id, asd_id, scrapped_date, location, scrapped_by, notes
      FROM "tblAssetScrapDet"
      ORDER BY asset_id, scrapped_date DESC
    ),
    asset_lifecycle AS (
      SELECT 
        a.asset_id,
        a.text as asset_name,
        at.text as category,
        COALESCE(b.text, 'No Location') as location,
        COALESCE(d.text, 'Unassigned') as department,
        COALESCE(v.vendor_name, vs.vendor_name, 'No Vendor') as vendor,
        a.purchased_on as purchase_date,
        a.purchased_on as commissioned_date,
        CASE 
          WHEN aa.action IS NOT NULL THEN CONCAT('Assigned to: ', COALESCE(d.text, 'Unknown Department'), ' - ', COALESCE(aa.action::text, 'Unknown Action'))
          ELSE 'No Assignment'
        END as asset_usage_history,
        CASE 
          WHEN ssh.buyer_name IS NOT NULL THEN 'Scrap Sold'
          WHEN ls.scrapped_date IS NOT NULL THEN 'Scrapped'
          WHEN a.current_status = 'Active' THEN 'In-Use'
          ELSE a.current_status
        END as current_status,
        ls.scrapped_date as scrap_date,
        ls.location as scrap_location,
        ls.scrapped_by as scrapped_by,
        ssh.buyer_name as buyer,
        ssh.sale_date as sale_date,
        CASE 
          WHEN ssh.total_sale_value IS NULL THEN 0
          WHEN array_length(ssh.total_sale_value, 1) IS NULL THEN 0
          ELSE CAST(ssh.total_sale_value[1] AS DECIMAL)
        END as sale_amount,
        a.serial_number,
        a.description,
        a.asset_type_id,
        a.branch_id,
        a.purchase_vendor_id,
        a.service_vendor_id,
        a.purchased_cost,
        a.current_book_value,
        a.accumulated_depreciation,
        a.useful_life_years,
        a.warranty_period,
        a.expiry_date,
        a.created_on,
        a.changed_on,
        ls.notes as scrap_notes,
        ssh.buyer_company,
        ssh.buyer_phone,
        ssh.invoice_no,
        ssh.po_no,
        ssh.collection_date
      FROM "tblAssets" a
      LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
      LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
      LEFT JOIN "tblVendors" vs ON a.service_vendor_id = vs.vendor_id
      LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
        AND aa.latest_assignment_flag = true
      LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
      LEFT JOIN latest_scrap ls ON a.asset_id = ls.asset_id
      LEFT JOIN "tblScrapSales_D" ssd ON ls.asd_id = ssd.asd_id
      LEFT JOIN "tblScrapSales_H" ssh ON ssd.ssh_id = ssh.ssh_id
    )
    SELECT 
      asset_id as "Asset ID",
      asset_name as "Asset Name",
      category as "Category",
      location as "Location",
      department as "Department",
      vendor as "Vendor",
      purchase_date as "Purchase Date",
      commissioned_date as "Commissioned Date",
      asset_usage_history as "Asset Usage History",
      current_status as "Current Status",
      scrap_date as "Scrap Date",
      scrap_location as "Scrap Location",
      scrapped_by as "Scrapped By",
      buyer as "Buyer",
      sale_date as "Sale Date",
      sale_amount as "Sale Amount",
      serial_number,
      description,
      asset_type_id,
      branch_id,
      purchase_vendor_id,
      service_vendor_id,
      purchased_cost,
      current_book_value,
      accumulated_depreciation,
      useful_life_years,
      warranty_period,
      expiry_date,
      created_on,
      changed_on,
      scrap_notes,
      buyer_company,
      buyer_phone,
      invoice_no,
      po_no,
      collection_date
    FROM asset_lifecycle
    ${whereClause.replace(/a\.asset_id/g, 'asset_id').replace(/a\.text/g, 'asset_name').replace(/at\.text/g, 'category').replace(/b\.text/g, 'location').replace(/d\.text/g, 'department').replace(/v\.vendor_name/g, 'vendor').replace(/vs\.vendor_name/g, 'vendor').replace(/a\.purchased_on/g, 'purchase_date').replace(/a\.current_status/g, 'current_status').replace(/asd\.scrapped_date/g, 'scrap_date').replace(/asd\.location/g, 'scrap_location').replace(/asd\.scrapped_by/g, 'scrapped_by').replace(/ssh\.buyer_name/g, 'buyer').replace(/ssh\.sale_date/g, 'sale_date').replace(/ssh\.total_sale_value/g, 'sale_amount').replace(/a\.branch_id/g, 'branch_id')}
    ORDER BY created_on DESC
    LIMIT $${paramCount - 1} OFFSET $${paramCount}
  `;

  console.log('🔍 [AssetLifecycleModel] Executing query:', query);
  
  try {
    const dbPool = getDb();

    const result = await dbPool.query(query, queryParams);
    console.log('🔍 [AssetLifecycleModel] Query result count:', result.rows.length);
    return result;
  } catch (error) {
    console.error('❌ [AssetLifecycleModel] Database query error:', error);
    // Re-throw the error to be handled by the controller
    throw error;
  }
};

// Get total count for pagination
const getAssetLifecycleCount = async (filters = {}) => {
  const {
    purchaseDateRange,
    commissionedDateRange,
    assetUsageHistory,
    currentStatus,
    scrapDateRange,
    scrapLocation,
    scrappedBy,
    buyer,
    saleDateRange,
    saleAmount,
    branch_id,
    advancedConditions
  } = filters;

  let whereConditions = [];
  let queryParams = [];
  let paramCount = 0;

  // Add branch_id filter first
  if (branch_id) {
    paramCount++;
    whereConditions.push(`a.branch_id = $${paramCount}`);
    queryParams.push(branch_id);
  }

  // Build dynamic WHERE conditions (same as above)
  if (purchaseDateRange && purchaseDateRange.length === 2 && 
      purchaseDateRange[0] && purchaseDateRange[0].trim() !== '' && 
      purchaseDateRange[1] && purchaseDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`purchase_date >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`purchase_date <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  if (commissionedDateRange && commissionedDateRange.length === 2 && 
      commissionedDateRange[0] && commissionedDateRange[0].trim() !== '' && 
      commissionedDateRange[1] && commissionedDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`commissioned_date >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`commissioned_date <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (assetUsageHistory && assetUsageHistory.length > 0) {
    // Asset usage history is a computed field with formatted text, so we need to use LIKE
    const usageConditions = assetUsageHistory.map(usage => {
      paramCount++;
      if (usage === 'No Assignment') {
        // Exact match for "No Assignment"
        return `asset_usage_history = $${paramCount}`;
      } else {
        // Map user-friendly labels back to action codes for filtering
        const actionCode = usage === 'Assigned' ? 'A' : 
                          usage === 'Unassigned' ? 'U' : 
                          usage === 'Returned' ? 'R' : 
                          usage === 'Transferred' ? 'T' : usage;
        
        // Match the action at the end of the formatted string: "Assigned to: Department - ACTION"
        return `asset_usage_history ILIKE $${paramCount}`;
      }
    });
    queryParams.push(...assetUsageHistory.map(usage => {
      if (usage === 'No Assignment') {
        return usage;
      } else {
        // Map user-friendly labels back to action codes for filtering
        const actionCode = usage === 'Assigned' ? 'A' : 
                          usage === 'Unassigned' ? 'U' : 
                          usage === 'Returned' ? 'R' : 
                          usage === 'Transferred' ? 'T' : usage;
        return `% - ${actionCode}`;
      }
    }));
    whereConditions.push(`(${usageConditions.join(' OR ')})`);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (scrapDateRange && scrapDateRange.length === 2 && 
      scrapDateRange[0] && scrapDateRange[0].trim() !== '' && 
      scrapDateRange[1] && scrapDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`scrap_date >= $${paramCount}`);
    queryParams.push(scrapDateRange[0]);
    paramCount++;
    whereConditions.push(`scrap_date <= $${paramCount}`);
    queryParams.push(scrapDateRange[1]);
  }

  if (scrapLocation && scrapLocation.length > 0) {
    paramCount++;
    whereConditions.push(`scrap_location = ANY($${paramCount})`);
    queryParams.push(scrapLocation);
  }

  if (scrappedBy && scrappedBy.length > 0) {
    paramCount++;
    whereConditions.push(`scrapped_by = ANY($${paramCount})`);
    queryParams.push(scrappedBy);
  }

  if (buyer && buyer.length > 0) {
    paramCount++;
    whereConditions.push(`buyer = ANY($${paramCount})`);
    queryParams.push(buyer);
  }

  if (saleDateRange && saleDateRange.length === 2 && 
      saleDateRange[0] && saleDateRange[0].trim() !== '' && 
      saleDateRange[1] && saleDateRange[1].trim() !== '') {
    paramCount++;
    whereConditions.push(`sale_date >= $${paramCount}`);
    queryParams.push(saleDateRange[0]);
    paramCount++;
    whereConditions.push(`sale_date <= $${paramCount}`);
    queryParams.push(saleDateRange[1]);
  }

  if (saleAmount) {
    paramCount++;
    whereConditions.push(`sale_amount >= $${paramCount}`);
    queryParams.push(saleAmount);
  }

  // Process advanced conditions (same logic as in getAssetLifecycleData)
  if (advancedConditions && advancedConditions.length > 0) {
    advancedConditions.forEach(condition => {
      if (condition.field && condition.op && condition.val !== undefined && condition.val !== '') {
        const { field, op, val } = condition;
        
        // Map field keys to CTE column names (since WHERE clause is applied to final SELECT)
        const fieldMapping = {
          'assetId': 'asset_id',
          'assetName': 'asset_name',
          'category': 'category',
          'location': 'location',
          'branchId': 'branch_id',
          'department': 'department',
          'vendor': 'vendor',
          'purchaseDateRange': 'purchase_date',
          'commissionedDateRange': 'commissioned_date',
          'assetUsageHistory': 'asset_usage_history',
          'currentStatus': 'current_status',
          'scrapDateRange': 'scrap_date',
          'scrapLocation': 'scrap_location',
          'scrappedBy': 'scrapped_by',
          'buyer': 'buyer',
          'saleDateRange': 'sale_date',
          'saleAmount': 'sale_amount'
        };
        
        const dbField = fieldMapping[field];
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
            case 'in range':
              // Handle date range - val should be an array [startDate, endDate]
              if (Array.isArray(val) && val.length === 2) {
                const startDate = val[0] && val[0].trim() !== '' ? val[0] : null;
                const endDate = val[1] && val[1].trim() !== '' ? val[1] : null;
                
                if (startDate && endDate) {
                  // Both dates provided - use range
                  paramCount++;
                  conditionClause = `${dbField} >= $${paramCount - 1} AND ${dbField} <= $${paramCount}`;
                  queryParams.push(startDate);
                  queryParams.push(endDate);
                } else if (startDate && !endDate) {
                  // Only start date provided - use "after" logic
                  conditionClause = `${dbField} >= $${paramCount}`;
                  queryParams.push(startDate);
                } else if (!startDate && endDate) {
                  // Only end date provided - use "before" logic
                  conditionClause = `${dbField} <= $${paramCount}`;
                  queryParams.push(endDate);
                } else {
                  console.log(`⚠️ [AssetLifecycleModel] Invalid date range format - at least one date must be provided: ${val}`);
                  conditionClause = null; // Skip this condition
                }
              } else {
                console.log(`⚠️ [AssetLifecycleModel] Invalid date range format - must be an array: ${val}`);
                conditionClause = null; // Skip this condition
              }
              break;
            case 'before':
              conditionClause = `${dbField} < $${paramCount}`;
              queryParams.push(val);
              break;
            case 'after':
              conditionClause = `${dbField} > $${paramCount}`;
              queryParams.push(val);
              break;
            default:
              // Default to equals
              conditionClause = `${dbField} = $${paramCount}`;
              queryParams.push(val);
          }
          
          if (conditionClause) {
            whereConditions.push(conditionClause);
          }
        }
      }
    });
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    WITH latest_scrap AS (
      SELECT DISTINCT ON (asset_id) 
        asset_id, asd_id, scrapped_date, location, scrapped_by, notes
      FROM "tblAssetScrapDet"
      ORDER BY asset_id, scrapped_date DESC
    ),
    asset_lifecycle AS (
      SELECT 
        a.asset_id,
        a.text as asset_name,
        at.text as category,
        COALESCE(b.text, 'No Location') as location,
        COALESCE(d.text, 'Unassigned') as department,
        COALESCE(v.vendor_name, vs.vendor_name, 'No Vendor') as vendor,
        a.purchased_on as purchase_date,
        a.purchased_on as commissioned_date,
        CASE 
          WHEN aa.action IS NOT NULL THEN CONCAT('Assigned to: ', COALESCE(d.text, 'Unknown Department'), ' - ', COALESCE(aa.action::text, 'Unknown Action'))
          ELSE 'No Assignment'
        END as asset_usage_history,
        CASE 
          WHEN ssh.buyer_name IS NOT NULL THEN 'Scrap Sold'
          WHEN ls.scrapped_date IS NOT NULL THEN 'Scrapped'
          WHEN a.current_status = 'Active' THEN 'In-Use'
          ELSE a.current_status
        END as current_status,
        ls.scrapped_date as scrap_date,
        ls.location as scrap_location,
        ls.scrapped_by as scrapped_by,
        ssh.buyer_name as buyer,
        ssh.sale_date as sale_date,
        CASE 
          WHEN ssh.total_sale_value IS NULL THEN 0
          WHEN array_length(ssh.total_sale_value, 1) IS NULL THEN 0
          ELSE CAST(ssh.total_sale_value[1] AS DECIMAL)
        END as sale_amount,
        a.branch_id
      FROM "tblAssets" a
      LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
      LEFT JOIN "tblVendors" v ON a.purchase_vendor_id = v.vendor_id
      LEFT JOIN "tblVendors" vs ON a.service_vendor_id = vs.vendor_id
      LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id 
        AND aa.latest_assignment_flag = true
      LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
      LEFT JOIN latest_scrap ls ON a.asset_id = ls.asset_id
      LEFT JOIN "tblScrapSales_D" ssd ON ls.asd_id = ssd.asd_id
      LEFT JOIN "tblScrapSales_H" ssh ON ssd.ssh_id = ssh.ssh_id
    )
    SELECT COUNT(*) as total
    FROM asset_lifecycle
    ${whereClause.replace(/a\.asset_id/g, 'asset_id').replace(/a\.text/g, 'asset_name').replace(/at\.text/g, 'category').replace(/b\.text/g, 'location').replace(/d\.text/g, 'department').replace(/v\.vendor_name/g, 'vendor').replace(/vs\.vendor_name/g, 'vendor').replace(/a\.purchased_on/g, 'purchase_date').replace(/a\.current_status/g, 'current_status').replace(/asd\.scrapped_date/g, 'scrap_date').replace(/asd\.location/g, 'scrap_location').replace(/asd\.scrapped_by/g, 'scrapped_by').replace(/ssh\.buyer_name/g, 'buyer').replace(/ssh\.sale_date/g, 'sale_date').replace(/ssh\.total_sale_value/g, 'sale_amount').replace(/a\.branch_id/g, 'branch_id')}
  `;

  try {
    const dbPool = getDb();

    const result = await dbPool.query(query, queryParams);
    return result.rows[0].total;
  } catch (error) {
    console.error('❌ [AssetLifecycleModel] Count query error:', error);
    throw error;
  }
};

// Get filter options for dropdowns
const getAssetLifecycleFilterOptions = async () => {
  const query = `
    SELECT 
      (SELECT JSON_AGG(DISTINCT at.text) FROM "tblAssetTypes" at 
       INNER JOIN "tblAssets" a ON a.asset_type_id = at.asset_type_id) as categories,
      (SELECT JSON_AGG(DISTINCT b.text) FROM "tblBranches" b 
       INNER JOIN "tblAssets" a ON a.branch_id = b.branch_id) as locations,
      (SELECT JSON_AGG(DISTINCT d.text) FROM "tblDepartments" d 
       INNER JOIN "tblAssetAssignments" aa ON aa.dept_id = d.dept_id 
       WHERE aa.latest_assignment_flag = true) as departments,
      (SELECT JSON_AGG(DISTINCT COALESCE(v.vendor_name, vs.vendor_name)) 
       FROM "tblVendors" v 
       INNER JOIN "tblAssets" a ON a.purchase_vendor_id = v.vendor_id
       LEFT JOIN "tblVendors" vs ON a.service_vendor_id = vs.vendor_id) as vendors,
      (SELECT JSON_AGG(DISTINCT CASE 
        WHEN ssh.buyer_name IS NOT NULL THEN 'Scrap Sold'
        WHEN asd.scrapped_date IS NOT NULL THEN 'Scrapped'
        WHEN a.current_status = 'Active' THEN 'In-Use'
        ELSE a.current_status
      END) FROM "tblAssets" a
      LEFT JOIN "tblAssetScrapDet" asd ON a.asset_id = asd.asset_id
      LEFT JOIN "tblScrapSales_D" ssd ON asd.asd_id = ssd.asd_id
      LEFT JOIN "tblScrapSales_H" ssh ON ssd.ssh_id = ssh.ssh_id
      WHERE a.current_status IS NOT NULL) as current_statuses,
      (SELECT JSON_AGG(DISTINCT 
         CASE 
           WHEN aa.action = 'A' THEN 'Assigned'
           WHEN aa.action = 'U' THEN 'Unassigned'
           WHEN aa.action = 'R' THEN 'Returned'
           WHEN aa.action = 'T' THEN 'Transferred'
           ELSE aa.action
         END
       ) FROM "tblAssetAssignments" aa 
       WHERE aa.action IS NOT NULL AND aa.latest_assignment_flag = true) as asset_usage_history,
      (SELECT JSON_AGG(DISTINCT asd.location) FROM "tblAssetScrapDet" asd 
       WHERE asd.location IS NOT NULL AND asd.location != '') as scrap_locations,
      (SELECT JSON_AGG(DISTINCT asd.scrapped_by) FROM "tblAssetScrapDet" asd 
       WHERE asd.scrapped_by IS NOT NULL AND asd.scrapped_by != '') as scrapped_by_users,
      (SELECT JSON_AGG(DISTINCT ssh.buyer_name) FROM "tblScrapSales_H" ssh 
       WHERE ssh.buyer_name IS NOT NULL AND ssh.buyer_name != '') as buyers
  `;

  try {
    const dbPool = getDb();

    const result = await dbPool.query(query);
    return result.rows[0];
  } catch (error) {
    console.error('❌ [AssetLifecycleModel] Filter options query error:', error);
    throw error;
  }
};

module.exports = {
  getAssetLifecycleData,
  getAssetLifecycleCount,
  getAssetLifecycleFilterOptions
};
