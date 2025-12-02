const { getDbFromContext } = require('../utils/dbContext');

// Helper function to get database connection (tenant pool or default)
const getDb = () => getDbFromContext();

// Get vendor SLA records by maintenance schedule ID
// Returns a single row with all SLA columns
const getVendorSLARecordsByMaintenance = async (amsId) => {
  const dbPool = getDb();
  const query = `
    SELECT 
      vslar_id,
      vendor_id,
      ams_id,
      sla1_value,
      sla2_value,
      sla3_value,
      sla4_value,
      sla5_value,
      sla6_value,
      sla7_value,
      sla8_value,
      sla9_value,
      sla10_value,
      sla1_tech_name,
      sla2_tech_name,
      sla3_tech_name,
      sla4_tech_name,
      sla5_tech_name,
      sla6_tech_name,
      sla7_tech_name,
      sla8_tech_name,
      sla9_tech_name,
      sla10_tech_name,
      sla1_phone,
      sla2_phone,
      sla3_phone,
      sla4_phone,
      sla5_phone,
      sla6_phone,
      sla7_phone,
      sla8_phone,
      sla9_phone,
      sla10_phone,
      sla_rating,
      created_at,
      updated_at
    FROM "tblvendorslarecs"
    WHERE ams_id = $1
    LIMIT 1
  `;
  
  const result = await dbPool.query(query, [amsId]);
  return result.rows[0] || null;
};

// Create or update vendor SLA records for a maintenance schedule
// Takes records array and transforms to single row with columns
const upsertVendorSLARecords = async (recordsData) => {
  const dbPool = getDb();
  const { vendor_id, ams_id, records, user_id, org_id } = recordsData;
  
  // Check if record exists
  const existing = await getVendorSLARecordsByMaintenance(ams_id);
  
  // Build column values from records array
  // Map SLA-1 to sla1_value, SLA-2 to sla2_value, etc.
  const columnData = {
    sla1_value: null,
    sla2_value: null,
    sla3_value: null,
    sla4_value: null,
    sla5_value: null,
    sla6_value: null,
    sla7_value: null,
    sla8_value: null,
    sla9_value: null,
    sla10_value: null,
    sla1_tech_name: null,
    sla2_tech_name: null,
    sla3_tech_name: null,
    sla4_tech_name: null,
    sla5_tech_name: null,
    sla6_tech_name: null,
    sla7_tech_name: null,
    sla8_tech_name: null,
    sla9_tech_name: null,
    sla10_tech_name: null,
    sla1_phone: null,
    sla2_phone: null,
    sla3_phone: null,
    sla4_phone: null,
    sla5_phone: null,
    sla6_phone: null,
    sla7_phone: null,
    sla8_phone: null,
    sla9_phone: null,
    sla10_phone: null,
    sla_rating: null
  };
  
  // Process records array and map to columns
  // Map SLA-1 to sla1_value, SLA-2 to sla2_value, etc.
  // Only process SLAs that have data (filled columns from tblVendorSLAs)
  // Use single rating from the first record (all records have the same rating)
  let singleRating = null;
  if (records && Array.isArray(records)) {
    records.forEach(record => {
      // Extract SLA number from sla_id (e.g., "SLA-1" -> 1, "SLA-2" -> 2)
      const slaNumber = record.sla_id ? parseInt(record.sla_id.replace('SLA-', '')) : null;
      if (slaNumber && slaNumber >= 1 && slaNumber <= 10) {
        // Map to corresponding columns: SLA-1 -> sla1_value, sla1_tech_name, sla1_phone
        columnData[`sla${slaNumber}_value`] = record.sla_value || null;
        columnData[`sla${slaNumber}_tech_name`] = record.technician_name || null;
        columnData[`sla${slaNumber}_phone`] = record.technician_phno || null;
        // Get rating from first record (single rating for all SLAs)
        if (!singleRating && record.rating && record.rating.trim() !== '') {
          const ratingValue = parseFloat(record.rating);
          if (!isNaN(ratingValue)) {
            singleRating = ratingValue;
          }
        }
      }
    });
  }
  
  // Set single rating value (can be null if not provided)
  if (singleRating !== null) {
    columnData.sla_rating = singleRating;
  } else {
    // If no rating provided, keep existing rating or set to null
    if (existing && existing.sla_rating) {
      columnData.sla_rating = existing.sla_rating;
    } else {
      columnData.sla_rating = null;
    }
  }
  
  const now = new Date();
  
  if (existing) {
    // Update existing record
    const updateQuery = `
      UPDATE "tblvendorslarecs" SET
        vendor_id = $1,
        sla1_value = $2,
        sla2_value = $3,
        sla3_value = $4,
        sla4_value = $5,
        sla5_value = $6,
        sla6_value = $7,
        sla7_value = $8,
        sla8_value = $9,
        sla9_value = $10,
        sla10_value = $11,
        sla1_tech_name = $12,
        sla2_tech_name = $13,
        sla3_tech_name = $14,
        sla4_tech_name = $15,
        sla5_tech_name = $16,
        sla6_tech_name = $17,
        sla7_tech_name = $18,
        sla8_tech_name = $19,
        sla9_tech_name = $20,
        sla10_tech_name = $21,
        sla1_phone = $22,
        sla2_phone = $23,
        sla3_phone = $24,
        sla4_phone = $25,
        sla5_phone = $26,
        sla6_phone = $27,
        sla7_phone = $28,
        sla8_phone = $29,
        sla9_phone = $30,
        sla10_phone = $31,
        sla_rating = $32,
        updated_at = $33
      WHERE ams_id = $34
      RETURNING *
    `;
    
    const values = [
      vendor_id,
      columnData.sla1_value,
      columnData.sla2_value,
      columnData.sla3_value,
      columnData.sla4_value,
      columnData.sla5_value,
      columnData.sla6_value,
      columnData.sla7_value,
      columnData.sla8_value,
      columnData.sla9_value,
      columnData.sla10_value,
      columnData.sla1_tech_name,
      columnData.sla2_tech_name,
      columnData.sla3_tech_name,
      columnData.sla4_tech_name,
      columnData.sla5_tech_name,
      columnData.sla6_tech_name,
      columnData.sla7_tech_name,
      columnData.sla8_tech_name,
      columnData.sla9_tech_name,
      columnData.sla10_tech_name,
      columnData.sla1_phone,
      columnData.sla2_phone,
      columnData.sla3_phone,
      columnData.sla4_phone,
      columnData.sla5_phone,
      columnData.sla6_phone,
      columnData.sla7_phone,
      columnData.sla8_phone,
      columnData.sla9_phone,
      columnData.sla10_phone,
      columnData.sla_rating,
      now,
      ams_id
    ];
    
    const result = await dbPool.query(updateQuery, values);
    return result.rows[0];
  } else {
    // Insert new record
    const { generateCustomId } = require("../utils/idGenerator");
    const vslar_id = await generateCustomId("vendor_sla_rec", 3);
    
    const insertQuery = `
      INSERT INTO "tblvendorslarecs" (
        vslar_id,
        vendor_id,
        ams_id,
        sla1_value,
        sla2_value,
        sla3_value,
        sla4_value,
        sla5_value,
        sla6_value,
        sla7_value,
        sla8_value,
        sla9_value,
        sla10_value,
        sla1_tech_name,
        sla2_tech_name,
        sla3_tech_name,
        sla4_tech_name,
        sla5_tech_name,
        sla6_tech_name,
        sla7_tech_name,
        sla8_tech_name,
        sla9_tech_name,
        sla10_tech_name,
        sla1_phone,
        sla2_phone,
        sla3_phone,
        sla4_phone,
        sla5_phone,
        sla6_phone,
        sla7_phone,
        sla8_phone,
        sla9_phone,
        sla10_phone,
        sla_rating,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36
      )
      RETURNING *
    `;
    
    const values = [
      vslar_id,
      vendor_id,
      ams_id,
      columnData.sla1_value,
      columnData.sla2_value,
      columnData.sla3_value,
      columnData.sla4_value,
      columnData.sla5_value,
      columnData.sla6_value,
      columnData.sla7_value,
      columnData.sla8_value,
      columnData.sla9_value,
      columnData.sla10_value,
      columnData.sla1_tech_name,
      columnData.sla2_tech_name,
      columnData.sla3_tech_name,
      columnData.sla4_tech_name,
      columnData.sla5_tech_name,
      columnData.sla6_tech_name,
      columnData.sla7_tech_name,
      columnData.sla8_tech_name,
      columnData.sla9_tech_name,
      columnData.sla10_tech_name,
      columnData.sla1_phone,
      columnData.sla2_phone,
      columnData.sla3_phone,
      columnData.sla4_phone,
      columnData.sla5_phone,
      columnData.sla6_phone,
      columnData.sla7_phone,
      columnData.sla8_phone,
      columnData.sla9_phone,
      columnData.sla10_phone,
      columnData.sla_rating,
      now,
      now
    ];
    
    const result = await dbPool.query(insertQuery, values);
    return result.rows[0];
  }
};

module.exports = {
  getVendorSLARecordsByMaintenance,
  upsertVendorSLARecords
};
