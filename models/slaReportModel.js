const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get SLA report data with filters
const getSLAReportData = async (filters) => {
  const dbPool = getDb();
  const org_id = filters.org_id;
  
  // Build WHERE conditions dynamically
  const whereConditions = [`v.org_id = $1`, `v.int_status = 1`];
  const queryParams = [org_id];
  let paramIndex = 2;
  
  // Apply filters - build WHERE conditions
  if (filters.vendor_id && filters.vendor_id.length > 0) {
    whereConditions.push(`v.vendor_id = ANY($${paramIndex})`);
    queryParams.push(filters.vendor_id);
    paramIndex++;
  }
  
  // Filter by asset type - need to check in the join before GROUP BY
  if (filters.asset_type_id && filters.asset_type_id.length > 0) {
    whereConditions.push(`at.asset_type_id = ANY($${paramIndex})`);
    queryParams.push(filters.asset_type_id);
    paramIndex++;
  }
  
  // Filter by SLA description (sla_id) - check if any of the selected SLA IDs have values
  if (filters.sla_description && filters.sla_description.length > 0) {
    // Build OR conditions for each selected SLA ID
    const slaConditions = [];
    filters.sla_description.forEach((slaId) => {
      // Extract the number from SLA ID (e.g., "SLA-1" -> 1)
      const slaNum = slaId.replace('SLA-', '');
      slaConditions.push(`(vs."SLA-${slaNum}" IS NOT NULL AND vs."SLA-${slaNum}" != '' AND sd${slaNum}.sla_id = $${paramIndex})`);
      queryParams.push(slaId);
      paramIndex++;
    });
    whereConditions.push(`(${slaConditions.join(' OR ')})`);
  }
  
  // Date range filter using created_on and changed_on from tblVendorSLAs
  // Show records where either created_on or changed_on falls within the date range
  if (filters.dateRange && filters.dateRange.length === 2) {
    const [startDate, endDate] = filters.dateRange;
    if (startDate && endDate) {
      // Filter by date range: check if created_on or changed_on falls within the range
      // A record matches if either created_on OR changed_on is within the range
      whereConditions.push(`(
        (vs.created_on >= $${paramIndex} AND vs.created_on <= $${paramIndex + 1}) OR
        (vs.changed_on >= $${paramIndex} AND vs.changed_on <= $${paramIndex + 1})
      )`);
      queryParams.push(startDate);
      queryParams.push(endDate);
      paramIndex += 2;
    } else if (startDate) {
      whereConditions.push(`(vs.created_on >= $${paramIndex} OR vs.changed_on >= $${paramIndex})`);
      queryParams.push(startDate);
      paramIndex++;
    } else if (endDate) {
      whereConditions.push(`(vs.created_on <= $${paramIndex} OR vs.changed_on <= $${paramIndex})`);
      queryParams.push(endDate);
      paramIndex++;
    }
  }
  
  // Build the complete query with WHERE clause
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // Use GROUP BY to get one row per vendor, with aggregated asset types
  let query = `
    SELECT
      v.vendor_id,
      v.vendor_name,
      v.company_name,
      v.company_email,
      v.contact_person_name,
      v.contact_person_number,
      v.contract_start_date,
      v.contract_end_date,
      vs.vsla_id,
      vs.created_on,
      vs.changed_on,
      vs."SLA-1" as sla_1_value,
      vs."SLA-2" as sla_2_value,
      vs."SLA-3" as sla_3_value,
      vs."SLA-4" as sla_4_value,
      vs."SLA-5" as sla_5_value,
      vs."SLA-6" as sla_6_value,
      vs."SLA-7" as sla_7_value,
      vs."SLA-8" as sla_8_value,
      vs."SLA-9" as sla_9_value,
      vs."SLA-10" as sla_10_value,
      sd1.sla_id as sla_1_id,
      sd1.description as sla_1_description,
      sd2.sla_id as sla_2_id,
      sd2.description as sla_2_description,
      sd3.sla_id as sla_3_id,
      sd3.description as sla_3_description,
      sd4.sla_id as sla_4_id,
      sd4.description as sla_4_description,
      sd5.sla_id as sla_5_id,
      sd5.description as sla_5_description,
      sd6.sla_id as sla_6_id,
      sd6.description as sla_6_description,
      sd7.sla_id as sla_7_id,
      sd7.description as sla_7_description,
      sd8.sla_id as sla_8_id,
      sd8.description as sla_8_description,
      sd9.sla_id as sla_9_id,
      sd9.description as sla_9_description,
      sd10.sla_id as sla_10_id,
      sd10.description as sla_10_description,
      -- Aggregate asset types as comma-separated string
      STRING_AGG(DISTINCT at.text, ', ' ORDER BY at.text) FILTER (WHERE at.text IS NOT NULL) as asset_type_names,
      STRING_AGG(DISTINCT at.asset_type_id::text, ', ' ORDER BY at.asset_type_id::text) FILTER (WHERE at.asset_type_id IS NOT NULL) as asset_type_ids
    FROM "tblVendors" v
    INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
    LEFT JOIN tblsla_desc sd1 ON sd1.sla_id = 'SLA-1'
    LEFT JOIN tblsla_desc sd2 ON sd2.sla_id = 'SLA-2'
    LEFT JOIN tblsla_desc sd3 ON sd3.sla_id = 'SLA-3'
    LEFT JOIN tblsla_desc sd4 ON sd4.sla_id = 'SLA-4'
    LEFT JOIN tblsla_desc sd5 ON sd5.sla_id = 'SLA-5'
    LEFT JOIN tblsla_desc sd6 ON sd6.sla_id = 'SLA-6'
    LEFT JOIN tblsla_desc sd7 ON sd7.sla_id = 'SLA-7'
    LEFT JOIN tblsla_desc sd8 ON sd8.sla_id = 'SLA-8'
    LEFT JOIN tblsla_desc sd9 ON sd9.sla_id = 'SLA-9'
    LEFT JOIN tblsla_desc sd10 ON sd10.sla_id = 'SLA-10'
    LEFT JOIN "tblVendorProdService" vps ON v.vendor_id = vps.vendor_id
    LEFT JOIN "tblProdServs" ps ON vps.prod_serv_id = ps.prod_serv_id AND ps.org_id = v.org_id
    LEFT JOIN "tblAssetTypes" at ON ps.asset_type_id = at.asset_type_id
    ${whereClause}
    GROUP BY v.vendor_id, v.vendor_name, v.company_name, v.company_email, v.contact_person_name, 
             v.contact_person_number, v.contract_start_date, v.contract_end_date, 
             vs.vsla_id, vs.created_on, vs.changed_on, vs."SLA-1", vs."SLA-2", vs."SLA-3", vs."SLA-4", vs."SLA-5",
             vs."SLA-6", vs."SLA-7", vs."SLA-8", vs."SLA-9", vs."SLA-10",
             sd1.sla_id, sd1.description, sd2.sla_id, sd2.description, sd3.sla_id, sd3.description,
             sd4.sla_id, sd4.description, sd5.sla_id, sd5.description, sd6.sla_id, sd6.description,
             sd7.sla_id, sd7.description, sd8.sla_id, sd8.description, sd9.sla_id, sd9.description,
             sd10.sla_id, sd10.description
    ORDER BY v.vendor_name
  `;
  
  // Apply limit and offset
  if (filters.limit) {
    query += ` LIMIT $${paramIndex}`;
    queryParams.push(filters.limit);
    paramIndex++;
  }
  
  if (filters.offset) {
    query += ` OFFSET $${paramIndex}`;
    queryParams.push(filters.offset);
    paramIndex++;
  }
  
  console.log('[SLAReportModel] Query:', query);
  console.log('[SLAReportModel] Params:', queryParams);
  
  const result = await dbPool.query(query, queryParams);
  return result.rows;
};

// Get filter options for SLA reports
const getSLAReportFilterOptions = async (org_id) => {
  console.log(`[SLAReportModel] 🔍 getSLAReportFilterOptions called with org_id: ${org_id}`);
  const dbPool = getDb();
  
  // Get vendors - only those who have SLA records in tblVendorSLAs
  // Use COALESCE to handle multilingual fields - prioritize vendor_name, fallback to company_name
  const vendorsQuery = `
    SELECT DISTINCT 
      v.vendor_id, 
      COALESCE(NULLIF(TRIM(v.vendor_name), ''), v.company_name, v.vendor_id) as vendor_name,
      COALESCE(NULLIF(TRIM(v.company_name), ''), v.vendor_name, v.vendor_id) as company_name
    FROM "tblVendors" v
    INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
    WHERE v.org_id = $1 AND v.int_status = 1
    ORDER BY COALESCE(NULLIF(TRIM(v.vendor_name), ''), v.company_name, v.vendor_id)
  `;
  console.log(`[SLAReportModel] 📊 Executing vendors query with org_id: ${org_id}`);
  const vendorsResult = await dbPool.query(vendorsQuery, [org_id]);
  console.log(`[SLAReportModel] ✅ Found ${vendorsResult.rows.length} vendors with SLA records`);
  
  // Get asset types - show all asset types for the organization
  // This allows filtering by any asset type for vendors with SLA records
  // Use COALESCE to handle multilingual fields - ensure we get a displayable name
  const assetTypesQuery = `
    SELECT DISTINCT 
      at.asset_type_id, 
      COALESCE(NULLIF(TRIM(at.text), ''), at.asset_type_id) as asset_type_name,
      COALESCE(NULLIF(TRIM(at.text), ''), at.asset_type_id) as text
    FROM "tblAssetTypes" at
    WHERE at.org_id = $1 AND at.int_status = 1
    ORDER BY COALESCE(NULLIF(TRIM(at.text), ''), at.asset_type_id)
  `;
  console.log(`[SLAReportModel] 📊 Executing asset types query with org_id: ${org_id}`);
  console.log(`[SLAReportModel] Query:`, assetTypesQuery.replace(/\s+/g, ' ').trim());
  const assetTypesResult = await dbPool.query(assetTypesQuery, [org_id]);
  console.log(`[SLAReportModel] ✅ Found ${assetTypesResult.rows.length} asset types with SLA-assigned vendors (via VendorProdService)`);
  if (assetTypesResult.rows.length > 0) {
    console.log(`[SLAReportModel] 📋 Sample asset types:`, assetTypesResult.rows.slice(0, 3));
  } else {
    console.log(`[SLAReportModel] ⚠️ No asset types found - checking relationship chain...`);
    // Debug query to see what's available - step by step
    const debugStep1 = `
      SELECT COUNT(DISTINCT vs.vendor_id) as vendors_with_sla
      FROM "tblVendorSLAs" vs
      INNER JOIN "tblVendors" v ON vs.vendor_id = v.vendor_id
      WHERE v.org_id = $1 AND v.int_status = 1
    `;
    const debug1 = await dbPool.query(debugStep1, [org_id]);
    console.log(`[SLAReportModel] Step 1 - Vendors with SLA:`, debug1.rows[0]);
    
    const debugStep2 = `
      SELECT COUNT(DISTINCT a.asset_id) as assets_linked_to_vendors
      FROM "tblVendorSLAs" vs
      INNER JOIN "tblVendors" v ON vs.vendor_id = v.vendor_id
      INNER JOIN "tblAssets" a ON (a.service_vendor_id = v.vendor_id OR a.purchase_vendor_id = v.vendor_id)
      WHERE v.org_id = $1 AND v.int_status = 1
        AND a.org_id = $1
    `;
    const debug2 = await dbPool.query(debugStep2, [org_id]);
    console.log(`[SLAReportModel] Step 2 - Assets linked to vendors with SLA:`, debug2.rows[0]);
    
    const debugStep3 = `
      SELECT COUNT(DISTINCT a.asset_type_id) as asset_types_found
      FROM "tblVendorSLAs" vs
      INNER JOIN "tblVendors" v ON vs.vendor_id = v.vendor_id
      INNER JOIN "tblAssets" a ON (a.service_vendor_id = v.vendor_id OR a.purchase_vendor_id = v.vendor_id)
      WHERE v.org_id = $1 AND v.int_status = 1
        AND a.org_id = $1
        AND a.asset_type_id IS NOT NULL
    `;
    const debug3 = await dbPool.query(debugStep3, [org_id]);
    console.log(`[SLAReportModel] Step 3 - Asset types found:`, debug3.rows[0]);
    
    // Show sample data
    const sampleQuery = `
      SELECT 
        vs.vendor_id,
        v.vendor_name,
        a.asset_id,
        a.asset_type_id,
        at.text as asset_type_name
      FROM "tblVendorSLAs" vs
      INNER JOIN "tblVendors" v ON vs.vendor_id = v.vendor_id
      LEFT JOIN "tblAssets" a ON (a.service_vendor_id = v.vendor_id OR a.purchase_vendor_id = v.vendor_id)
      LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      WHERE v.org_id = $1 AND v.int_status = 1
      LIMIT 5
    `;
    const sample = await dbPool.query(sampleQuery, [org_id]);
    console.log(`[SLAReportModel] Sample relationship data:`, sample.rows);
    
    // Show which vendors have SLA but no linked assets
    const vendorsNeedingAssets = `
      SELECT 
        v.vendor_id,
        v.vendor_name,
        COUNT(a.asset_id) as asset_count
      FROM "tblVendors" v
      INNER JOIN "tblVendorSLAs" vs ON v.vendor_id = vs.vendor_id
      LEFT JOIN "tblAssets" a ON (a.service_vendor_id = v.vendor_id OR a.purchase_vendor_id = v.vendor_id) AND a.org_id = v.org_id
      WHERE v.org_id = $1 AND v.int_status = 1
      GROUP BY v.vendor_id, v.vendor_name
      HAVING COUNT(a.asset_id) = 0
    `;
    const vendorsNeeding = await dbPool.query(vendorsNeedingAssets, [org_id]);
    if (vendorsNeeding.rows.length > 0) {
      console.log(`[SLAReportModel] ⚠️ The following vendors have SLA records but NO linked assets:`);
      vendorsNeeding.rows.forEach(v => {
        console.log(`[SLAReportModel]   - ${v.vendor_id}: ${v.vendor_name}`);
      });
      console.log(`[SLAReportModel] 💡 To fix: Link assets to these vendors (set service_vendor_id or purchase_vendor_id on assets)`);
    }
  }
  
  // Get SLA descriptions - all available SLA descriptions from tblsla_desc
  // Use COALESCE to handle multilingual fields - ensure we get a displayable description
  const slaDescriptionsQuery = `
    SELECT DISTINCT 
      sla_id, 
      COALESCE(NULLIF(TRIM(description), ''), sla_id) as description
    FROM tblsla_desc
    ORDER BY sla_id
  `;
  const slaDescriptionsResult = await dbPool.query(slaDescriptionsQuery, []);
  console.log(`[SLAReportModel] Found ${slaDescriptionsResult.rows.length} SLA descriptions`);
  
  return {
    vendors: vendorsResult.rows,
    assetTypes: assetTypesResult.rows,
    slaDescriptions: slaDescriptionsResult.rows
  };
};

module.exports = {
  getSLAReportData,
  getSLAReportFilterOptions
};

