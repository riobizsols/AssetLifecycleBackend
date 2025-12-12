const db = require('../config/db');
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

/**
 * Get QA/Audit certificates based on filters
 * Returns both quality certificates and maintenance completion certificates
 */
const getQAAuditCertificates = async (filters = {}, orgId, userBranchId = null, hasSuperAccess = false) => {
  try {
    const {
      fromDate,
      toDate,
      assets = null,
      assetTypes = null,
      advancedFilters = []
    } = filters;

    // Determine if we have asset-based filters
    const hasAssetBasedFilters = (assets && assets.length > 0) || 
                                  (assetTypes && assetTypes.length > 0) || 
                                  (advancedFilters && advancedFilters.length > 0);

    const dbPool = getDb();
    let filteredAssets = [];
    let assetIds = null;

    // Only build and run asset filter query if we have asset-based filters
    if (hasAssetBasedFilters) {
      // Build asset filter query
      let assetFilterQuery = `
        SELECT DISTINCT a.asset_id, a.text as asset_name, a.asset_type_id, a.serial_number
        FROM "tblAssets" a
        INNER JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        WHERE a.org_id = $1
      `;
      let queryParams = [orgId];
      let paramIndex = 2;

      // Branch filtering (if user doesn't have super access)
      if (!hasSuperAccess && userBranchId) {
        assetFilterQuery += ` AND a.branch_id = $${paramIndex}`;
        queryParams.push(userBranchId);
        paramIndex++;
      }

      // Date range filter (filter by asset created/purchased date or maintenance completion date)
      if (fromDate && toDate) {
        // We'll filter assets that have activities in this date range
        assetFilterQuery += ` AND (
        EXISTS (
          SELECT 1 FROM "tblAssetMaintSch" ams 
          WHERE ams.asset_id = a.asset_id 
          AND ams.org_id = a.org_id
          AND ams.status = 'CO'
          AND ams.act_main_end_date BETWEEN $${paramIndex} AND $${paramIndex + 1}
        )
        OR EXISTS (
          SELECT 1 FROM "tblAssetDocs" ad
          WHERE ad.asset_id = a.asset_id
          AND ad.org_id = a.org_id
        )
          OR a.created_on BETWEEN $${paramIndex} AND $${paramIndex + 1}
        )`;
        queryParams.push(fromDate);
        queryParams.push(toDate);
        paramIndex += 2;
      }

      // Asset selection filter
      if (assets && assets.length > 0) {
        const placeholders = assets.map(() => `$${paramIndex++}`).join(',');
        assetFilterQuery += ` AND a.asset_id IN (${placeholders})`;
        queryParams.push(...assets);
      }

      // Asset type filter
      if (assetTypes && assetTypes.length > 0) {
        const placeholders = assetTypes.map(() => `$${paramIndex++}`).join(',');
        assetFilterQuery += ` AND a.asset_type_id IN (${placeholders})`;
        queryParams.push(...assetTypes);
      }

      // Advanced filters - property value filters
      if (advancedFilters && advancedFilters.length > 0) {
        for (const filter of advancedFilters) {
          if (!filter.property || !filter.operator || !filter.value) continue;

          const propertyName = filter.property.toLowerCase();
          const operator = filter.operator;
          const filterValue = filter.value;

          // Check if this is a numeric comparison (like "more than 1.5 tons")
          const numericMatch = String(filterValue).match(/^([\d.]+)\s*(tons?|kg|kgm|capacity)?$/i);
          const numericValue = numericMatch ? parseFloat(numericMatch[1]) : null;

          if (numericValue !== null) {
            // This is a numeric property filter (e.g., AC more than 1.5 tons)
            const propertyPattern = `%${propertyName}%`;
            assetFilterQuery += ` AND EXISTS (
              SELECT 1 FROM "tblAssetPropValues" apv
              INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
              INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
              WHERE apv.asset_id = a.asset_id
              AND p.org_id = a.org_id
              AND (
                LOWER(p.property) LIKE $${paramIndex}
                OR LOWER(p.property) LIKE '%capacity%'
                OR LOWER(p.property) LIKE '%tons%'
              )
              AND CAST(
                NULLIF(REGEXP_REPLACE(apv.value, '[^0-9.]', '', 'g'), '') 
                AS NUMERIC
              ) ${operator} $${paramIndex + 1}
            )`;
            queryParams.push(propertyPattern);
            queryParams.push(numericValue);
            paramIndex += 2;
          } else {
            // Text-based property filter
            assetFilterQuery += ` AND EXISTS (
              SELECT 1 FROM "tblAssetPropValues" apv
              INNER JOIN "tblAssetTypeProps" atp ON apv.asset_type_prop_id = atp.asset_type_prop_id
              INNER JOIN "tblProps" p ON atp.prop_id = p.prop_id
              WHERE apv.asset_id = a.asset_id
              AND p.org_id = a.org_id
              AND LOWER(p.property) LIKE $${paramIndex}
              AND LOWER(apv.value) LIKE $${paramIndex + 1}
            )`;
            queryParams.push(`%${propertyName}%`);
            queryParams.push(`%${String(filterValue).toLowerCase()}%`);
            paramIndex += 2;
          }
        }
      }

      const assetResult = await dbPool.query(assetFilterQuery, queryParams);
      filteredAssets = assetResult.rows;

      if (filteredAssets.length > 0) {
        assetIds = filteredAssets.map(a => a.asset_id);
      } else {
        // Asset filters were applied but no assets match
        return {
          assets: [],
          certificates: []
        };
      }
    }
    // If no asset-based filters, assetIds stays null and we'll query all maintenance docs

    // Get ALL documents from tblAssetDocs for assets (not just quality certificates)
    // This includes all types of documents uploaded for assets
    let assetDocs = [];
    if (assetIds && assetIds.length > 0) {
      const assetDocsQuery = `
        SELECT 
          'maintenance' as type,
          ad.a_d_id as id,
          ad.asset_id,
          NULL as maintenance_id,
          a.text as asset_name,
          a.serial_number,
          at.text as asset_type_name,
          b.text as branch,
          d.text as department,
          ad.doc_path,
          NULL as date,
          dto.doc_type_text as certificate_type,
          dto.doc_type,
          dto.dto_id,
          NULL as maintenance_type,
          NULL as status,
          NULL as vendor,
          NULL as technician,
          SUBSTRING(ad.doc_path FROM '.*/([^/]+)$') as file_name,
          CASE 
            WHEN dto.doc_type_text ILIKE '%before%' OR dto.doc_type_text ILIKE '%after%' THEN true
            ELSE false
          END as is_before_after
        FROM "tblAssetDocs" ad
        INNER JOIN "tblAssets" a ON ad.asset_id = a.asset_id
        LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
        LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
        LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id AND aa.latest_assignment_flag = true
        LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
        LEFT JOIN "tblDocTypeObjects" dto ON ad.dto_id = dto.dto_id
        WHERE ad.asset_id = ANY($1::text[])
        AND ad.org_id = $2
        ORDER BY ad.a_d_id DESC
      `;
      
      const assetDocsResult = await dbPool.query(assetDocsQuery, [assetIds, orgId]);
      assetDocs = assetDocsResult.rows;
      console.log(`[QA Audit] Asset docs query returned ${assetDocs.length} documents from tblAssetDocs`);
    }

    // Get ALL maintenance documents (including before/after images from supervisor approval)
    // Match by ams_id in tblAssetMaintDocs with maintenance schedule
    let maintenanceCertsQuery = `
      SELECT 
        'maintenance' as type,
        amd.amd_id as id,
        amd.asset_id,
        ams.ams_id as maintenance_id,
        a.text as asset_name,
        a.serial_number,
        at.text as asset_type_name,
        b.text as branch,
        d.text as department,
        amd.doc_path,
        CURRENT_DATE as date,
        dto.doc_type_text as certificate_type,
        dto.doc_type,
        dto.dto_id,
        mt.text as maintenance_type,
        COALESCE(ams.status, 'N/A') as status,
        v.vendor_name as vendor,
        ams.technician_name as technician,
        SUBSTRING(amd.doc_path FROM '.*/([^/]+)$') as file_name,
        CASE 
          WHEN dto.doc_type_text ILIKE '%before%' OR dto.doc_type_text ILIKE '%after%' THEN true
          ELSE false
        END as is_before_after
      FROM "tblAssetMaintDocs" amd
      INNER JOIN "tblAssets" a ON amd.asset_id = a.asset_id
      LEFT JOIN "tblAssetMaintSch" ams ON amd.asset_id = ams.asset_id
      LEFT JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
      LEFT JOIN "tblBranches" b ON a.branch_id = b.branch_id
      LEFT JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id AND aa.latest_assignment_flag = true
      LEFT JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
      LEFT JOIN "tblDocTypeObjects" dto ON amd.dto_id = dto.dto_id
      LEFT JOIN "tblMaintTypes" mt ON ams.maint_type_id = mt.maint_type_id
      LEFT JOIN "tblVendors" v ON ams.vendor_id = v.vendor_id
      WHERE a.org_id = $1
    `;

    // Add asset filter if assets were specified
    let maintenanceParams = [orgId];
    let maintParamIndex = 2;
    
    if (assetIds && assetIds.length > 0) {
      maintenanceCertsQuery += ` AND amd.asset_id = ANY($${maintParamIndex}::text[])`;
      maintenanceParams.push(assetIds);
      maintParamIndex++;
    }

    // Add date range filter for maintenance documents (filter by maintenance schedule date)
    // If no date filter, we still fetch all documents
    // Note: We skip date filtering for maintenance docs since date columns might be time types
    // Date filtering can be done at application level if needed
    // if (fromDate && toDate) {
    //   maintenanceCertsQuery += ` AND (
    //     ams.act_main_end_date BETWEEN $${maintParamIndex} AND $${maintParamIndex + 1}
    //     OR ams.created_on BETWEEN $${maintParamIndex} AND $${maintParamIndex + 1}
    //     OR (ams.act_main_end_date IS NULL AND ams.created_on IS NULL)
    //   )`;
    //   maintenanceParams.push(fromDate, toDate);
    //   maintParamIndex += 2;
    // }

    // Branch filtering for maintenance documents (if user doesn't have super access)
    if (!hasSuperAccess && userBranchId) {
      maintenanceCertsQuery += ` AND a.branch_id = $${maintParamIndex}`;
      maintenanceParams.push(userBranchId);
      maintParamIndex++;
    }

    maintenanceCertsQuery += ` ORDER BY date DESC`;

    const maintenanceCertsResult = await dbPool.query(maintenanceCertsQuery, maintenanceParams);
    const maintenanceCerts = maintenanceCertsResult.rows;
    
    console.log(`[QA Audit] Maintenance docs query returned ${maintenanceCerts.length} documents`);
    console.log(`[QA Audit] Query params:`, maintenanceParams);

    // Get asset type documents (tblATDocs) when asset types are selected
    // These are documents associated with asset types directly, not specific assets
    let assetTypeDocs = [];
    if (assetTypes && assetTypes.length > 0) {
      let assetTypeDocsQuery = `
        SELECT 
          'maintenance' as type,
          atd.atd_id as id,
          NULL as asset_id,
          NULL as maintenance_id,
          NULL as asset_name,
          NULL as serial_number,
          at.text as asset_type_name,
          NULL as branch,
          NULL as department,
          atd.doc_path,
          CURRENT_DATE as date,
          dto.doc_type_text as certificate_type,
          dto.doc_type,
          dto.dto_id,
          NULL as maintenance_type,
          NULL as status,
          NULL as vendor,
          NULL as technician,
          SUBSTRING(atd.doc_path FROM '.*/([^/]+)$') as file_name,
          CASE 
            WHEN dto.doc_type_text ILIKE '%before%' OR dto.doc_type_text ILIKE '%after%' THEN true
            ELSE false
          END as is_before_after
        FROM "tblATDocs" atd
        INNER JOIN "tblAssetTypes" at ON atd.asset_type_id = at.asset_type_id
        LEFT JOIN "tblDocTypeObjects" dto ON atd.dto_id = dto.dto_id
        WHERE atd.asset_type_id = ANY($1::text[])
        AND atd.org_id = $2
      `;

      let assetTypeDocsParams = [assetTypes, orgId];

      // Note: tblATDocs doesn't have a date column, so we can't filter by date
      // We include all asset type documents when asset types are selected

      assetTypeDocsQuery += ` ORDER BY atd.atd_id DESC`;

      try {
        const assetTypeDocsResult = await dbPool.query(assetTypeDocsQuery, assetTypeDocsParams);
        assetTypeDocs = assetTypeDocsResult.rows;
        console.log(`[QA Audit] Asset type docs query returned ${assetTypeDocs.length} documents for asset types:`, assetTypes);
      } catch (error) {
        console.error('[QA Audit] Error fetching asset type docs:', error);
        // Continue execution even if this query fails
      }
    }

    // Combine all certificates
    // Note: We're fetching maintenance documents, so all are marked as 'maintenance' type
    const allCertificates = [...assetDocs, ...maintenanceCerts, ...assetTypeDocs];

    return {
      assets: filteredAssets || [],
      certificates: allCertificates
    };

  } catch (error) {
    console.error('Error in getQAAuditCertificates:', error);
    throw error;
  }
};

module.exports = {
  getQAAuditCertificates
};

