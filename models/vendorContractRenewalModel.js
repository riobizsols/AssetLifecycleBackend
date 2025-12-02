const { getDb } = require('../utils/dbContext');
const maintenanceScheduleModel = require('./maintenanceScheduleModel');

/**
 * Create a vendor contract renewal workflow (MT005)
 * Similar to maintenance workflow but for vendor contract renewal
 */
const createVendorContractRenewalWorkflow = async (vendor) => {
  const dbPool = getDb();
  
  try {
    // Generate workflow header ID using WFAMSH_ format
    const wfamshId = await maintenanceScheduleModel.getNextWFAMSHId();
    
    // Get admin job role (usually JR001 or similar - adjust based on your system)
    const adminRoleQuery = `
      SELECT job_role_id 
      FROM "tblJobRoles" 
      WHERE text ILIKE '%admin%' OR text ILIKE '%system%'
      ORDER BY job_role_id
      LIMIT 1
    `;
    const adminRoleResult = await dbPool.query(adminRoleQuery);
    
    if (adminRoleResult.rows.length === 0) {
      throw new Error('No admin role found. Please configure admin role in tblJobRoles');
    }
    
    const adminJobRoleId = adminRoleResult.rows[0].job_role_id;
    
    // Create workflow header
    const headerData = {
      wfamsh_id: wfamshId,
      at_main_freq_id: null, // Not applicable for contract renewal
      maint_type_id: 'MT005', // Vendor Contract Renewal
      asset_id: null, // No asset for vendor contract renewal
      group_id: null,
      vendor_id: vendor.vendor_id,
      pl_sch_date: vendor.contract_end_date, // Contract end date
      act_sch_date: null,
      status: 'IN', // Initial status
      created_by: 'SYSTEM',
      org_id: vendor.org_id,
      branch_code: vendor.branch_code
    };
    
    await maintenanceScheduleModel.insertWorkflowMaintenanceScheduleHeader(headerData);
    
    // Generate workflow detail ID
    const wfamsdId = await maintenanceScheduleModel.getNextWFAMSDId();
    
    // Create workflow detail for admin approval
    // Format contract end date to just the date part (YYYY-MM-DD)
    const contractEndDate = vendor.contract_end_date ? 
      (vendor.contract_end_date instanceof Date ? 
        vendor.contract_end_date.toISOString().split('T')[0] : 
        vendor.contract_end_date.toString().split('T')[0]) : 
      'N/A';
    
    // Get a default department ID (use first department or empty string)
    const deptQuery = `SELECT dept_id FROM "tblDepartments" WHERE org_id = $1 ORDER BY dept_id LIMIT 1`;
    const deptResult = await dbPool.query(deptQuery, [vendor.org_id]);
    const defaultDeptId = deptResult.rows.length > 0 ? deptResult.rows[0].dept_id : '';
    
    const detailData = {
      wfamsd_id: wfamsdId,
      wfamsh_id: wfamshId,
      job_role_id: adminJobRoleId,
      user_id: null, // Role-based, no specific user
      dept_id: defaultDeptId, // Use default department or empty string
      sequence: 1,
      status: 'AP', // Approval Pending
      notes: `Vendor Contract Renewal: ${vendor.vendor_name} (${vendor.vendor_id}) - Ends: ${contractEndDate}`,
      created_by: 'SYSTEM',
      org_id: vendor.org_id
    };
    
    await maintenanceScheduleModel.insertWorkflowMaintenanceScheduleDetail(detailData);
    
    console.log(`✅ Created vendor contract renewal workflow ${wfamshId} for vendor ${vendor.vendor_id}`);
    
    return {
      wfamsh_id: wfamshId,
      vendor_id: vendor.vendor_id,
      status: 'created'
    };
  } catch (error) {
    console.error(`Error creating vendor contract renewal workflow for ${vendor.vendor_id}:`, error);
    throw error;
  }
};

/**
 * Deactivate vendors with expired contracts that haven't been renewed
 */
const deactivateExpiredVendors = async (todayDate) => {
  const dbPool = getDb();
  
  try {
    // Find vendors with expired contracts that haven't been renewed
    const expiredVendorsQuery = `
      UPDATE "tblVendors" v
      SET int_status = 0,
          changed_by = 'SYSTEM',
          changed_on = CURRENT_TIMESTAMP
      WHERE v.contract_end_date IS NOT NULL
        AND v.contract_end_date::date < $1::date
        AND v.int_status = 1
        AND NOT EXISTS (
          SELECT 1 
          FROM "tblWFAssetMaintSch_H" wfh
          WHERE wfh.vendor_id = v.vendor_id
            AND wfh.maint_type_id = 'MT005'
            AND wfh.status = 'CO'
        )
      RETURNING v.vendor_id, v.vendor_name, v.contract_end_date
    `;
    
    const result = await dbPool.query(expiredVendorsQuery, [todayDate]);
    
    console.log(`Deactivated ${result.rows.length} vendor(s) with expired contracts:`);
    result.rows.forEach(vendor => {
      console.log(`   - ${vendor.vendor_name} (${vendor.vendor_id}) - Contract ended: ${vendor.contract_end_date}`);
    });
    
    return {
      deactivated: result.rows.length,
      vendors: result.rows
    };
  } catch (error) {
    console.error('Error deactivating expired vendors:', error);
    throw error;
  }
};

module.exports = {
  createVendorContractRenewalWorkflow,
  deactivateExpiredVendors
};

