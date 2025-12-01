const db = require("../config/db");
const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();


// Get asset register data with all necessary joins (Updated version with new fields)
const getAssetRegisterData = async (filters = {}) => {
  const {
    assetId,
    department,
    employee,
    vendor,
    poNumber,
    invoiceNumber,
    category,
    location,
    purchaseDateRange,
    commissionedDateRange,
    currentStatus,
    cost,
    status,
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
    whereConditions.push(`d.dept_id = ANY($${paramCount})`);
    queryParams.push(department);
  }

  if (employee && employee.length > 0) {
    paramCount++;
    whereConditions.push(`e.employee_id = ANY($${paramCount})`);
    queryParams.push(employee);
  }

  if (vendor && vendor.length > 0) {
    paramCount++;
    whereConditions.push(`(v.vendor_id = ANY($${paramCount}) OR vs.vendor_id = ANY($${paramCount}))`);
    queryParams.push(vendor);
  }

  if (poNumber) {
    paramCount++;
    whereConditions.push(`a.po_number ILIKE $${paramCount}`);
    queryParams.push(`%${poNumber}%`);
  }

  if (invoiceNumber) {
    paramCount++;
    whereConditions.push(`a.invoice_number ILIKE $${paramCount}`);
    queryParams.push(`%${invoiceNumber}%`);
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

  if (purchaseDateRange && purchaseDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  if (commissionedDateRange && commissionedDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.commissioned_date >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`a.commissioned_date <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (cost) {
    paramCount++;
    whereConditions.push(`a.purchased_cost >= $${paramCount}`);
    queryParams.push(cost);
  }

  if (status && status.length > 0) {
    paramCount++;
    whereConditions.push(`a.status = ANY($${paramCount})`);
    queryParams.push(status);
  }

  // Add pagination parameters
  paramCount++;
  queryParams.push(limit);
  paramCount++;
  queryParams.push(offset);

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      a.asset_id as "Asset ID",
      a.text as "Asset Name",
      COALESCE(d.text, 'Unassigned') as "Department",
      COALESCE(e.name, 'Unassigned') as "Assigned Employee",
      COALESCE(v.text, vs.text, 'No Vendor') as "Vendor",
      COALESCE(a.po_number, 'N/A') as "PO Number",
      COALESCE(a.invoice_number, 'N/A') as "Invoice Number",
      at.text as "Category",
      COALESCE(b.text, 'No Location') as "Location",
      a.purchased_on as "Purchase Date",
      COALESCE(a.commissioned_date, a.purchased_on) as "Commissioned Date",
      a.current_status as "Current Status",
      a.purchased_cost as "Cost",
      COALESCE(a.status, a.current_status) as "Status",
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
    LEFT JOIN "tblEmployees" e ON aa.employee_id = e.employee_id
    ${whereClause}
    ORDER BY a.created_on DESC
    LIMIT $${paramCount - 1} OFFSET $${paramCount}
  `;

  const dbPool = getDb();

  return await dbPool.query(query, queryParams);
};

// Get total count for pagination (Updated version)
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
    purchaseDateRange,
    commissionedDateRange,
    currentStatus,
    cost,
    status
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
    whereConditions.push(`d.dept_id = ANY($${paramCount})`);
    queryParams.push(department);
  }

  if (employee && employee.length > 0) {
    paramCount++;
    whereConditions.push(`e.employee_id = ANY($${paramCount})`);
    queryParams.push(employee);
  }

  if (vendor && vendor.length > 0) {
    paramCount++;
    whereConditions.push(`(v.vendor_id = ANY($${paramCount}) OR vs.vendor_id = ANY($${paramCount}))`);
    queryParams.push(vendor);
  }

  if (poNumber) {
    paramCount++;
    whereConditions.push(`a.po_number ILIKE $${paramCount}`);
    queryParams.push(`%${poNumber}%`);
  }

  if (invoiceNumber) {
    paramCount++;
    whereConditions.push(`a.invoice_number ILIKE $${paramCount}`);
    queryParams.push(`%${invoiceNumber}%`);
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

  if (purchaseDateRange && purchaseDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.purchased_on >= $${paramCount}`);
    queryParams.push(purchaseDateRange[0]);
    paramCount++;
    whereConditions.push(`a.purchased_on <= $${paramCount}`);
    queryParams.push(purchaseDateRange[1]);
  }

  if (commissionedDateRange && commissionedDateRange.length === 2) {
    paramCount++;
    whereConditions.push(`a.commissioned_date >= $${paramCount}`);
    queryParams.push(commissionedDateRange[0]);
    paramCount++;
    whereConditions.push(`a.commissioned_date <= $${paramCount}`);
    queryParams.push(commissionedDateRange[1]);
  }

  if (currentStatus && currentStatus.length > 0) {
    paramCount++;
    whereConditions.push(`a.current_status = ANY($${paramCount})`);
    queryParams.push(currentStatus);
  }

  if (cost) {
    paramCount++;
    whereConditions.push(`a.purchased_cost >= $${paramCount}`);
    queryParams.push(cost);
  }

  if (status && status.length > 0) {
    paramCount++;
    whereConditions.push(`a.status = ANY($${paramCount})`);
    queryParams.push(status);
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
    LEFT JOIN "tblEmployees" e ON aa.employee_id = e.employee_id
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
      (SELECT JSON_AGG(DISTINCT v.text) FROM "tblVendors" v) as vendors,
      (SELECT JSON_AGG(DISTINCT a.current_status) FROM "tblAssets" a WHERE a.current_status IS NOT NULL) as current_statuses,
      (SELECT JSON_AGG(DISTINCT a.status) FROM "tblAssets" a WHERE a.status IS NOT NULL) as statuses
  `;

  const dbPool = getDb();


  const result = await dbPool.query(query);
  return result.rows[0];
};

module.exports = {
  getAssetRegisterData,
  getAssetRegisterCount,
  getAssetRegisterFilterOptions
};
