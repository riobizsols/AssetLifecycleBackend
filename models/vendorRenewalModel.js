const { getDb } = require('../utils/dbContext');

/**
 * Create tblVendorRenewal table if it doesn't exist
 * This table stores vendor contract renewal records after approval
 */
const createVendorRenewalTable = async () => {
  const dbPool = getDb();
  
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS "tblVendorRenewal" (
      vr_id VARCHAR(50) PRIMARY KEY,
      wfamsh_id VARCHAR(50) NOT NULL,
      vendor_id VARCHAR(50) NOT NULL,
      vendor_name VARCHAR(255),
      contract_start_date DATE,
      contract_end_date DATE,
      previous_contract_end_date DATE,
      renewal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      renewal_approved_by VARCHAR(50),
      renewal_notes TEXT,
      status VARCHAR(10) DEFAULT 'CO',
      org_id VARCHAR(50) NOT NULL,
      branch_code VARCHAR(50),
      created_by VARCHAR(50),
      created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      changed_by VARCHAR(50),
      changed_on TIMESTAMP,
      CONSTRAINT fk_vendor 
        FOREIGN KEY (vendor_id) 
        REFERENCES "tblVendors" (vendor_id) 
        ON DELETE CASCADE,
      CONSTRAINT fk_workflow 
        FOREIGN KEY (wfamsh_id) 
        REFERENCES "tblWFAssetMaintSch_H" (wfamsh_id) 
        ON DELETE CASCADE
    );
    
    -- Create indexes for better query performance
    CREATE INDEX IF NOT EXISTS idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id);
    CREATE INDEX IF NOT EXISTS idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date);
    
    COMMENT ON TABLE "tblVendorRenewal" IS 'Stores vendor contract renewal records after approval (MT005)';
    COMMENT ON COLUMN "tblVendorRenewal".vr_id IS 'Primary key - Vendor Renewal ID';
    COMMENT ON COLUMN "tblVendorRenewal".wfamsh_id IS 'Workflow maintenance schedule header ID';
    COMMENT ON COLUMN "tblVendorRenewal".vendor_id IS 'Foreign key to tblVendors';
    COMMENT ON COLUMN "tblVendorRenewal".vendor_name IS 'Vendor name for quick reference';
    COMMENT ON COLUMN "tblVendorRenewal".contract_start_date IS 'New contract start date';
    COMMENT ON COLUMN "tblVendorRenewal".contract_end_date IS 'New contract end date';
    COMMENT ON COLUMN "tblVendorRenewal".previous_contract_end_date IS 'Previous contract end date before renewal';
    COMMENT ON COLUMN "tblVendorRenewal".renewal_date IS 'Date when renewal was completed';
    COMMENT ON COLUMN "tblVendorRenewal".renewal_approved_by IS 'User who approved the renewal';
    COMMENT ON COLUMN "tblVendorRenewal".renewal_notes IS 'Notes about the renewal';
    COMMENT ON COLUMN "tblVendorRenewal".status IS 'Status of the renewal (CO=Completed)';
  `;
  
  try {
    await dbPool.query(createTableQuery);
    console.log('✅ tblVendorRenewal table created successfully');
    return { success: true, message: 'Table created successfully' };
  } catch (error) {
    console.error('Error creating tblVendorRenewal table:', error);
    throw error;
  }
};

/**
 * Generate next VR_ID (Vendor Renewal ID)
 */
const getNextVRId = async () => {
  const dbPool = getDb();
  
  const query = `
    SELECT vr_id 
    FROM "tblVendorRenewal" 
    ORDER BY CAST(SUBSTRING(vr_id FROM 'VR([0-9]+)') AS INTEGER) DESC 
    LIMIT 1
  `;
  
  try {
    const result = await dbPool.query(query);
    
    if (result.rows.length === 0) {
      return 'VR001';
    }
    
    const lastId = result.rows[0].vr_id;
    const match = lastId.match(/VR(\d+)/);
    
    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return `VR${String(nextNum).padStart(3, '0')}`;
    }
    
    return 'VR001';
  } catch (error) {
    // If table doesn't exist yet, return first ID
    if (error.code === '42P01') {
      return 'VR001';
    }
    throw error;
  }
};

/**
 * Insert vendor renewal record after approval
 * @param {Object} renewalData - Vendor renewal data
 * @param {string} renewalData.wfamsh_id - Workflow maintenance schedule header ID
 * @param {string} renewalData.vendor_id - Vendor ID
 * @param {string} renewalData.vendor_name - Vendor name
 * @param {Date} renewalData.contract_start_date - New contract start date
 * @param {Date} renewalData.contract_end_date - New contract end date
 * @param {Date} renewalData.previous_contract_end_date - Previous contract end date
 * @param {string} renewalData.renewal_approved_by - User who approved
 * @param {string} renewalData.renewal_notes - Renewal notes
 * @param {string} renewalData.org_id - Organization ID
 * @param {string} renewalData.branch_code - Branch code
 * @param {string} renewalData.created_by - Creator user ID
 */
const insertVendorRenewal = async (renewalData) => {
  const dbPool = getDb();
  
  try {
    // Generate next VR ID
    const vr_id = await getNextVRId();
    
    const query = `
      INSERT INTO "tblVendorRenewal" (
        vr_id,
        wfamsh_id,
        vendor_id,
        vendor_name,
        contract_start_date,
        contract_end_date,
        previous_contract_end_date,
        renewal_date,
        renewal_approved_by,
        renewal_notes,
        status,
        org_id,
        branch_code,
        created_by,
        created_on
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, $8, $9, 'CO', $10, $11, $12, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    const values = [
      vr_id,
      renewalData.wfamsh_id,
      renewalData.vendor_id,
      renewalData.vendor_name,
      renewalData.contract_start_date || null,
      renewalData.contract_end_date || null,
      renewalData.previous_contract_end_date || null,
      renewalData.renewal_approved_by || 'SYSTEM',
      renewalData.renewal_notes || null,
      renewalData.org_id,
      renewalData.branch_code || null,
      renewalData.created_by || 'SYSTEM'
    ];
    
    const result = await dbPool.query(query, values);
    
    console.log(`✅ Vendor renewal record created: ${vr_id} for vendor ${renewalData.vendor_id}`);
    
    return {
      success: true,
      vr_id: vr_id,
      data: result.rows[0]
    };
  } catch (error) {
    console.error('Error inserting vendor renewal record:', error);
    throw error;
  }
};

/**
 * Get all vendor renewal records
 * @param {string} orgId - Organization ID
 * @param {string} branchCode - Branch code (optional)
 * @param {boolean} hasSuperAccess - Whether user has super access
 */
const getAllVendorRenewals = async (orgId, branchCode, hasSuperAccess = false) => {
  const dbPool = getDb();
  
  let query = `
    SELECT 
      vr.*,
      v.company_name,
      v.contact_person_name,
      v.contact_person_email,
      v.contact_person_number,
      wfh.pl_sch_date,
      wfh.act_sch_date,
      wfh.created_on as workflow_created_on
    FROM "tblVendorRenewal" vr
    LEFT JOIN "tblVendors" v ON vr.vendor_id = v.vendor_id
    LEFT JOIN "tblWFAssetMaintSch_H" wfh ON vr.wfamsh_id = wfh.wfamsh_id
    WHERE vr.org_id = $1
  `;
  
  const params = [orgId];
  
  // Apply branch filter only if user doesn't have super access
  if (!hasSuperAccess && branchCode) {
    query += ` AND vr.branch_code = $2`;
    params.push(branchCode);
  }
  
  query += ` ORDER BY vr.renewal_date DESC`;
  
  try {
    const result = await dbPool.query(query, params);
    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    console.error('Error fetching vendor renewal records:', error);
    throw error;
  }
};

/**
 * Get vendor renewal record by ID
 * @param {string} vrId - Vendor Renewal ID
 * @param {string} orgId - Organization ID
 */
const getVendorRenewalById = async (vrId, orgId) => {
  const dbPool = getDb();
  
  const query = `
    SELECT 
      vr.*,
      v.company_name,
      v.company_email,
      v.contact_person_name,
      v.contact_person_email,
      v.contact_person_number,
      v.address_line1,
      v.address_line2,
      v.city,
      v.state,
      v.pincode,
      v.gst_number,
      v.cin_number,
      wfh.pl_sch_date,
      wfh.act_sch_date,
      wfh.created_on as workflow_created_on,
      wfh.created_by as workflow_created_by
    FROM "tblVendorRenewal" vr
    LEFT JOIN "tblVendors" v ON vr.vendor_id = v.vendor_id
    LEFT JOIN "tblWFAssetMaintSch_H" wfh ON vr.wfamsh_id = wfh.wfamsh_id
    WHERE vr.vr_id = $1 AND vr.org_id = $2
  `;
  
  try {
    const result = await dbPool.query(query, [vrId, orgId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Vendor renewal record not found'
      };
    }
    
    return {
      success: true,
      data: result.rows[0]
    };
  } catch (error) {
    console.error('Error fetching vendor renewal record:', error);
    throw error;
  }
};

/**
 * Get vendor renewal records by vendor ID
 * @param {string} vendorId - Vendor ID
 * @param {string} orgId - Organization ID
 */
const getVendorRenewalsByVendorId = async (vendorId, orgId) => {
  const dbPool = getDb();
  
  const query = `
    SELECT 
      vr.*,
      wfh.pl_sch_date,
      wfh.act_sch_date,
      wfh.created_on as workflow_created_on
    FROM "tblVendorRenewal" vr
    LEFT JOIN "tblWFAssetMaintSch_H" wfh ON vr.wfamsh_id = wfh.wfamsh_id
    WHERE vr.vendor_id = $1 AND vr.org_id = $2
    ORDER BY vr.renewal_date DESC
  `;
  
  try {
    const result = await dbPool.query(query, [vendorId, orgId]);
    return {
      success: true,
      data: result.rows
    };
  } catch (error) {
    console.error('Error fetching vendor renewal records by vendor ID:', error);
    throw error;
  }
};

module.exports = {
  createVendorRenewalTable,
  getNextVRId,
  insertVendorRenewal,
  getAllVendorRenewals,
  getVendorRenewalById,
  getVendorRenewalsByVendorId
};
