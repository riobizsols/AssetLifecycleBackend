const assetUsageModel = require("../models/assetUsageModel");
const getAssetsForUsageRecording = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId } = req.user || {};

    if (!orgId || !employeeIntId) {
      return res.status(400).json({
        message: "User is not linked to an employee or organization.",
      });
    }

    const assetTypeIds = await assetUsageModel.getUsageEligibleAssetTypeIds(orgId);

    if (!assetTypeIds.length) {
      return res.json({
        assetTypes: [],
        assets: [],
      });
    }

    const assets = await assetUsageModel.getAssignedAssetsForUser(
      employeeIntId,
      orgId,
      assetTypeIds,
      deptId
    );

    return res.json({
      assetTypes: assetTypeIds,
      assets,
    });
  } catch (error) {
    console.error("Error fetching assets for usage recording:", error);
    return res.status(500).json({
      message: "Failed to fetch assets for usage recording.",
      error: error.message,
    });
  }
};

const getUsageHistory = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId } = req.user || {};
    const { assetId } = req.params;

    if (!assetId) {
      return res.status(400).json({ message: "assetId is required." });
    }

    const hasAccess = await assetUsageModel.isAssetAccessibleByUser(
      assetId,
      employeeIntId,
      orgId,
      deptId
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this asset or it is not assigned to you.",
      });
    }

    const history = await assetUsageModel.getUsageHistoryByAsset(assetId);

    return res.json({
      assetId,
      history,
    });
  } catch (error) {
    console.error("Error fetching usage history:", error);
    return res.status(500).json({
      message: "Failed to fetch usage history.",
      error: error.message,
    });
  }
};

const recordUsage = async (req, res) => {
  try {
    const { org_id: orgId, emp_int_id: employeeIntId, dept_id: deptId, user_id: userId } = req.user || {};
    const { asset_id: assetId, usage_counter: usageCounter } = req.body || {};

    if (!assetId || usageCounter === undefined || usageCounter === null) {
      return res.status(400).json({
        message: "asset_id and usage_counter are required.",
      });
    }

    const parsedUsage = Number(usageCounter);
    if (!Number.isInteger(parsedUsage) || parsedUsage < 0) {
      return res.status(400).json({
        message: "usage_counter must be a non-negative integer.",
      });
    }

    const hasAccess = await assetUsageModel.isAssetAccessibleByUser(
      assetId,
      employeeIntId,
      orgId,
      deptId
    );

    if (!hasAccess) {
      return res.status(403).json({
        message: "You do not have access to this asset or it is not assigned to you.",
      });
    }

    const record = await assetUsageModel.createUsageRecord({
      asset_id: assetId,
      usage_counter: parsedUsage,
      created_by: userId,
    });

    return res.status(201).json({
      message: "Usage recorded successfully.",
      record,
    });
  } catch (error) {
    console.error("Error recording asset usage:", error);
    return res.status(500).json({
      message: "Failed to record asset usage.",
      error: error.message,
    });
  }
};

const getUsageReport = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};

    if (!orgId) {
      return res.status(400).json({
        message: "User is not linked to an organization.",
      });
    }

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
      limit,
      offset,
      advancedConditions,
    } = req.query || {};

    // Handle comma-separated values for department, branchId, createdBy
    const parseCommaSeparated = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.includes(',')) {
        return value.split(',').map(v => v.trim()).filter(v => v);
      }
      return [value];
    };

    const hasSuperAccess = req.user?.hasSuperAccess || false;
    const filters = {
      assetId: assetId || null,
      assetTypeId: assetTypeId || null,
      assetTypeIds: assetTypeIds ? (Array.isArray(assetTypeIds) ? assetTypeIds : [assetTypeIds]) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      createdBy: parseCommaSeparated(createdBy),
      usageCounterMin: usageCounterMin ? parseInt(usageCounterMin) : null,
      usageCounterMax: usageCounterMax ? parseInt(usageCounterMax) : null,
      department: parseCommaSeparated(department),
      branchId: (!hasSuperAccess) ? parseCommaSeparated(branchId) : null, // Only add branchId if no super access
      hasSuperAccess: hasSuperAccess, // Pass to model
      limit: limit ? parseInt(limit) : 1000,
      offset: offset ? parseInt(offset) : 0,
      advancedConditions: (() => {
        if (!advancedConditions) return null;
        try {
          if (typeof advancedConditions === 'string') {
            const parsed = JSON.parse(advancedConditions);
            console.log('🔍 [getUsageReport] Parsed advanced conditions from string:', parsed);
            return Array.isArray(parsed) ? parsed : null;
          } else if (Array.isArray(advancedConditions)) {
            console.log('🔍 [getUsageReport] Advanced conditions already an array:', advancedConditions);
            return advancedConditions;
          }
          return null;
        } catch (error) {
          console.error('❌ [getUsageReport] Error parsing advanced conditions:', error);
          console.error('❌ [getUsageReport] Raw advancedConditions:', advancedConditions);
          return null;
        }
      })(),
    };
    
    console.log('🔍 [getUsageReport] Final filters object:', JSON.stringify(filters, null, 2));
    console.log('🔍 [getUsageReport] Advanced conditions in filters:', filters.advancedConditions);

    const data = await assetUsageModel.getUsageReportData(orgId, filters);
    const summary = await assetUsageModel.getUsageReportSummary(orgId, filters);

    return res.json({
      success: true,
      data,
      summary,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: data.length,
      },
    });
  } catch (error) {
    console.error("Error fetching usage report:", error);
    return res.status(500).json({
      message: "Failed to fetch usage report.",
      error: error.message,
    });
  }
};

const getUsageReportFilterOptions = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};

    if (!orgId) {
      return res.status(400).json({
        message: "User is not linked to an organization.",
      });
    }

    // Get asset type IDs from tblOrgSettings where key = asset_type_id
    const assetTypeIds = await assetUsageModel.getUsageEligibleAssetTypeIds(orgId);

    if (!assetTypeIds || assetTypeIds.length === 0) {
      return res.json({
        success: true,
        data: {
          assetTypes: [],
          assets: [],
          departments: [],
          branches: [],
          users: [],
        },
      });
    }

    // Get asset types
    const assetTypesQuery = `
      SELECT asset_type_id, text
      FROM "tblAssetTypes"
      WHERE asset_type_id = ANY($1::text[])
      ORDER BY text
    `;

    // Use tenant database from request context (set by middleware)
    const dbPool = req.db || require("../config/db");
    const assetTypesResult = await dbPool.query(assetTypesQuery, [assetTypeIds]);
    const assetTypes = assetTypesResult.rows;

    // Get all assets for these asset types (not filtered by user)
    const assets = await assetUsageModel.getAllAssetsForAssetTypes(orgId, assetTypeIds);
    
    console.log(`🔍 [getUsageReportFilterOptions] Found ${assets.length} assets for asset types:`, assetTypeIds);
    if (assets.length > 0) {
      console.log(`🔍 [getUsageReportFilterOptions] Sample assets:`, assets.slice(0, 3).map(a => ({
        asset_id: a.asset_id,
        asset_name: a.asset_name,
        description: a.description,
        text: a.text,
        asset_type_name: a.asset_type_name
      })));
    }

    // Get departments from asset assignments for assets with these asset types
    // Logic: If asset type AT054 is in tblOrgSettings, and asset ASS106 (type AT054) is assigned to DPT202,
    // then DPT202 should appear in the dropdown with its department name from tblDepartments.text
    const departmentsQuery = `
      SELECT DISTINCT 
        d.dept_id, 
        CASE 
          WHEN d.text IS NOT NULL AND TRIM(d.text) != '' THEN d.text
          ELSE d.dept_id
        END AS department_name,
        d.text AS raw_text,
        d.org_id
      FROM "tblAssets" a
      INNER JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id
        AND aa.action = 'A'
        AND aa.latest_assignment_flag = true
        AND aa.dept_id IS NOT NULL
      INNER JOIN "tblDepartments" d ON aa.dept_id = d.dept_id
        AND d.org_id = $1
      WHERE a.org_id = $1
        AND a.current_status != 'SCRAPPED'
        AND a.asset_type_id = ANY($2::text[])
        AND d.dept_id IS NOT NULL
      ORDER BY 
        CASE 
          WHEN d.text IS NOT NULL AND TRIM(d.text) != '' THEN d.text
          ELSE d.dept_id
        END
    `;

    const departmentsResult = await dbPool.query(departmentsQuery, [orgId, assetTypeIds]);
    
    console.log(`🔍 [getUsageReportFilterOptions] Raw departments query result:`, departmentsResult.rows.slice(0, 3));
    
    const departments = departmentsResult.rows.map(dept => {
      // Extract department name - use text if available, otherwise use dept_id
      let deptName = '';
      if (dept.department_name && String(dept.department_name).trim() !== '') {
        deptName = String(dept.department_name).trim();
      } else if (dept.raw_text && String(dept.raw_text).trim() !== '') {
        deptName = String(dept.raw_text).trim();
      } else if (dept.dept_id) {
        deptName = String(dept.dept_id);
      } else {
        deptName = 'Unknown Department';
      }
      
      const result = {
        dept_id: dept.dept_id,
        department_name: deptName,
        text: dept.raw_text || dept.dept_id || ''
      };
      
      console.log(`🔍 [getUsageReportFilterOptions] Mapped department:`, {
        dept_id: result.dept_id,
        department_name: result.department_name,
        raw_text: dept.raw_text,
        org_id: dept.org_id
      });
      
      return result;
    });
    
    console.log(`🔍 [getUsageReportFilterOptions] Found ${departments.length} departments for asset types:`, assetTypeIds);
    if (departments.length > 0) {
      console.log(`🔍 [getUsageReportFilterOptions] Sample departments (first 5):`);
      departments.slice(0, 5).forEach(d => {
        console.log(`  - dept_id: "${d.dept_id}", department_name: "${d.department_name}", text: "${d.text}"`);
      });
    } else {
      console.log(`⚠️ [getUsageReportFilterOptions] No departments found. This might mean:`);
      console.log(`  1. No assets with these asset types are assigned to departments`);
      console.log(`  2. Asset assignments don't have dept_id set`);
      console.log(`  3. Departments don't exist in tblDepartments for org_id: ${orgId}`);
    }

    // Get branches from asset assignments for assets with these asset types
    const branchesQuery = `
      SELECT DISTINCT b.branch_id, b.text AS branch_name
      FROM "tblBranches" b
      INNER JOIN "tblAssets" a ON b.branch_id = a.branch_id
      INNER JOIN "tblAssetAssignments" aa ON a.asset_id = aa.asset_id
      WHERE a.org_id = $1
        AND a.current_status != 'SCRAPPED'
        AND a.asset_type_id = ANY($2::text[])
        AND aa.action = 'A'
        AND aa.latest_assignment_flag = true
      ORDER BY b.text
    `;

    const branchesResult = await dbPool.query(branchesQuery, [orgId, assetTypeIds]);
    const branches = branchesResult.rows;

    // Get users from tblAssetUsageReg created_by column
    const usersQuery = `
      SELECT DISTINCT u.user_id, u.full_name AS user_name
      FROM "tblUsers" u
      INNER JOIN "tblAssetUsageReg" aur ON u.user_id = aur.created_by
      INNER JOIN "tblAssets" a ON aur.asset_id = a.asset_id
      WHERE a.org_id = $1
        AND a.current_status != 'SCRAPPED'
        AND a.asset_type_id = ANY($2::text[])
      ORDER BY u.full_name
    `;

    const usersResult = await dbPool.query(usersQuery, [orgId, assetTypeIds]);
    const users = usersResult.rows;

    // Log the response data for debugging
    console.log(`🔍 [getUsageReportFilterOptions] Response summary:`);
    console.log(`  - Asset Types: ${assetTypes.length}`);
    console.log(`  - Assets: ${assets.length}`);
    console.log(`  - Departments: ${departments.length}`);
    if (departments.length > 0) {
      console.log(`  - Sample departments:`, departments.slice(0, 3).map(d => ({
        dept_id: d.dept_id,
        department_name: d.department_name
      })));
    }
    console.log(`  - Branches: ${branches.length}`);
    console.log(`  - Users: ${users.length}`);

    return res.json({
      success: true,
      data: {
        assetTypes,
        assets,
        departments,
        branches,
        users,
      },
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return res.status(500).json({
      message: "Failed to fetch filter options.",
      error: error.message,
    });
  }
};

const exportUsageReportCSV = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};

    if (!orgId) {
      return res.status(400).json({
        message: "User is not linked to an organization.",
      });
    }

    // Get same filters as getUsageReport
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
    } = req.query || {};

    const filters = {
      assetId: assetId || null,
      assetTypeId: assetTypeId || null,
      assetTypeIds: assetTypeIds ? (Array.isArray(assetTypeIds) ? assetTypeIds : [assetTypeIds]) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      createdBy: createdBy || null,
      usageCounterMin: usageCounterMin ? parseInt(usageCounterMin) : null,
      usageCounterMax: usageCounterMax ? parseInt(usageCounterMax) : null,
      department: department || null,
      branchId: branchId || null,
      limit: 10000, // Large limit for export
      offset: 0,
    };

    const data = await assetUsageModel.getUsageReportData(orgId, filters);

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No usage data found for export",
      });
    }

    // Format data for CSV export
    const exportData = data.map(record => ({
      "Usage ID": record.aug_id,
      "Asset ID": record.asset_id,
      "Asset Name": record.asset_name,
      "Serial Number": record.serial_number,
      "Asset Type": record.asset_type_name,
      "Department": record.department_name || "",
      "Branch": record.branch_name || "",
      "Usage Counter": record.usage_counter,
      "Recorded By": record.created_by_name || "",
      "Recorded Date": record.created_on ? new Date(record.created_on).toLocaleString() : "",
      "Employee Name": record.employee_name || "",
      "Asset Description": record.asset_description || "",
    }));

    // Generate CSV
    const { exportToCSV } = require("../utils/exportUtils");
    const fileName = `Usage_Based_Asset_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    
    await exportToCSV(exportData, res);

  } catch (error) {
    console.error("Error exporting usage report to CSV:", error);
    return res.status(500).json({
      message: "Failed to export usage report to CSV.",
      error: error.message,
    });
  }
};

const exportUsageReportPDF = async (req, res) => {
  try {
    const { org_id: orgId } = req.user || {};

    if (!orgId) {
      return res.status(400).json({
        message: "User is not linked to an organization.",
      });
    }

    // Get same filters as getUsageReport
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
    } = req.query || {};

    const hasSuperAccess = req.user?.hasSuperAccess || false;
    const filters = {
      assetId: assetId || null,
      assetTypeId: assetTypeId || null,
      assetTypeIds: assetTypeIds ? (Array.isArray(assetTypeIds) ? assetTypeIds : [assetTypeIds]) : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      createdBy: createdBy || null,
      usageCounterMin: usageCounterMin ? parseInt(usageCounterMin) : null,
      usageCounterMax: usageCounterMax ? parseInt(usageCounterMax) : null,
      department: department || null,
      branchId: (!hasSuperAccess) ? branchId : null, // Only add branchId if no super access
      hasSuperAccess: hasSuperAccess, // Pass to model
      limit: 10000, // Large limit for export
      offset: 0,
    };

    const data = await assetUsageModel.getUsageReportData(orgId, filters);
    const summary = await assetUsageModel.getUsageReportSummary(orgId, filters);

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No usage data found for export",
      });
    }

    // Format data for PDF export
    const exportData = data.map(record => ({
      "Usage ID": record.aug_id,
      "Asset ID": record.asset_id,
      "Asset Name": record.asset_name,
      "Serial Number": record.serial_number,
      "Asset Type": record.asset_type_name,
      "Department": record.department_name || "",
      "Branch": record.branch_name || "",
      "Usage Counter": record.usage_counter,
      "Recorded By": record.created_by_name || "",
      "Recorded Date": record.created_on ? new Date(record.created_on).toLocaleString() : "",
      "Employee Name": record.employee_name || "",
    }));

    // Generate PDF using jsPDF
    const jsPDF = require("jspdf").jsPDF;
    const autoTable = require("jspdf-autotable");
    const doc = new jsPDF("l", "mm", "a4"); // Landscape orientation

    // Add title
    doc.setFontSize(16);
    doc.text("Usage-Based Asset Report", 14, 15);

    // Add summary information
    if (summary) {
      doc.setFontSize(10);
      let yPos = 25;
      doc.text(`Total Assets: ${summary.total_assets || 0}`, 14, yPos);
      yPos += 5;
      doc.text(`Total Records: ${summary.total_records || 0}`, 14, yPos);
      yPos += 5;
      doc.text(`Total Usage: ${summary.total_usage || 0}`, 14, yPos);
      yPos += 5;
      doc.text(`Average Usage: ${Math.round(summary.avg_usage || 0)}`, 14, yPos);
      yPos += 5;
      doc.text(`Min Usage: ${summary.min_usage || 0}`, 14, yPos);
      yPos += 5;
      doc.text(`Max Usage: ${summary.max_usage || 0}`, 14, yPos);
      yPos += 10;
    }

    // Prepare table data
    const tableData = exportData.map(record => [
      record["Usage ID"],
      record["Asset ID"],
      record["Asset Name"],
      record["Serial Number"],
      record["Asset Type"],
      record["Department"],
      record["Branch"],
      record["Usage Counter"],
      record["Recorded By"],
      record["Recorded Date"],
    ]);

    const headers = [
      "Usage ID",
      "Asset ID",
      "Asset Name",
      "Serial Number",
      "Asset Type",
      "Department",
      "Branch",
      "Usage Counter",
      "Recorded By",
      "Recorded Date",
    ];

    // Add table
    autoTable(doc, {
      head: [headers],
      body: tableData,
      startY: summary ? 50 : 25,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [20, 61, 101], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 20 },
    });

    // Add footer with page numbers
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        14,
        doc.internal.pageSize.height - 10
      );
    }

    const fileName = `Usage_Based_Asset_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    
    res.send(Buffer.from(doc.output("arraybuffer")));

  } catch (error) {
    console.error("Error exporting usage report to PDF:", error);
    return res.status(500).json({
      message: "Failed to export usage report to PDF.",
      error: error.message,
    });
  }
};

module.exports = {
  getAssetsForUsageRecording,
  getUsageHistory,
  recordUsage,
  getUsageReport,
  getUsageReportFilterOptions,
  exportUsageReportCSV,
  exportUsageReportPDF,
};

