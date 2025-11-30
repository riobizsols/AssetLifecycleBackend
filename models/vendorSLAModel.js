const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get vendor SLAs by vendor_id (returns one row with all 10 SLA columns)
const getVendorSLAs = async (vendorId) => {
  const dbPool = getDb();
  const query = `
    SELECT 
      vs.vsla_id,
      vs.vendor_id,
      vs."SLA-1",
      vs."SLA-2",
      vs."SLA-3",
      vs."SLA-4",
      vs."SLA-5",
      vs."SLA-6",
      vs."SLA-7",
      vs."SLA-8",
      vs."SLA-9",
      vs."SLA-10",
      vs.created_by,
      vs.created_on,
      vs.changed_by,
      vs.changed_on,
      vs.int_status
    FROM "tblVendorSLAs" vs
    WHERE vs.vendor_id = $1
  `;
  
  const result = await dbPool.query(query, [vendorId]);
  return result.rows[0] || null; // Return single row or null
};

// Create or update vendor SLA (one row per vendor)
const upsertVendorSLA = async (vendorSLA) => {
  const dbPool = getDb();
  
  // Check if record exists
  const existing = await getVendorSLAs(vendorSLA.vendor_id);
  
  if (existing) {
    // Update existing record
    const query = `
      UPDATE "tblVendorSLAs" SET
        "SLA-1" = $1,
        "SLA-2" = $2,
        "SLA-3" = $3,
        "SLA-4" = $4,
        "SLA-5" = $5,
        "SLA-6" = $6,
        "SLA-7" = $7,
        "SLA-8" = $8,
        "SLA-9" = $9,
        "SLA-10" = $10,
        changed_by = $11,
        changed_on = $12
      WHERE vendor_id = $13
      RETURNING *;
    `;

    const values = [
      vendorSLA["SLA-1"] || null,
      vendorSLA["SLA-2"] || null,
      vendorSLA["SLA-3"] || null,
      vendorSLA["SLA-4"] || null,
      vendorSLA["SLA-5"] || null,
      vendorSLA["SLA-6"] || null,
      vendorSLA["SLA-7"] || null,
      vendorSLA["SLA-8"] || null,
      vendorSLA["SLA-9"] || null,
      vendorSLA["SLA-10"] || null,
      vendorSLA.changed_by,
      vendorSLA.changed_on || new Date(),
      vendorSLA.vendor_id
    ];

    const { rows } = await dbPool.query(query, values);
    return rows[0];
  } else {
    // Create new record
    const query = `
      INSERT INTO "tblVendorSLAs" (
        vsla_id,
        vendor_id,
        "SLA-1",
        "SLA-2",
        "SLA-3",
        "SLA-4",
        "SLA-5",
        "SLA-6",
        "SLA-7",
        "SLA-8",
        "SLA-9",
        "SLA-10",
        created_by,
        created_on,
        changed_by,
        changed_on,
        int_status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING *;
    `;

    const values = [
      vendorSLA.vsla_id,
      vendorSLA.vendor_id,
      vendorSLA["SLA-1"] || null,
      vendorSLA["SLA-2"] || null,
      vendorSLA["SLA-3"] || null,
      vendorSLA["SLA-4"] || null,
      vendorSLA["SLA-5"] || null,
      vendorSLA["SLA-6"] || null,
      vendorSLA["SLA-7"] || null,
      vendorSLA["SLA-8"] || null,
      vendorSLA["SLA-9"] || null,
      vendorSLA["SLA-10"] || null,
      vendorSLA.created_by || null,
      vendorSLA.created_on || new Date(),
      vendorSLA.changed_by || null,
      vendorSLA.changed_on || new Date(),
      vendorSLA.int_status || 1
    ];

    const { rows } = await dbPool.query(query, values);
    return rows[0];
  }
};

// Delete vendor SLA
const deleteVendorSLA = async (vendorId) => {
  const dbPool = getDb();
  const query = 'DELETE FROM "tblVendorSLAs" WHERE vendor_id = $1 RETURNING *;';
  const { rows } = await dbPool.query(query, [vendorId]);
  return rows[0] || null;
};

module.exports = {
  getVendorSLAs,
  upsertVendorSLA,
  deleteVendorSLA
};
