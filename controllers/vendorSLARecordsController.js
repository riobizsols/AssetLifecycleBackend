const vendorSLARecordsModel = require("../models/vendorSLARecordsModel");

// Get vendor SLA records by maintenance schedule ID
// Returns a single row, transforms to array format for frontend
exports.getVendorSLARecordsByMaintenance = async (req, res) => {
  try {
    const { maintenanceId } = req.params;
    const record = await vendorSLARecordsModel.getVendorSLARecordsByMaintenance(maintenanceId);
    
    if (!record) {
      return res.json({
        success: true,
        data: [],
        message: "No SLA records found for this maintenance schedule"
      });
    }
    
    // Transform single row with columns to array format for frontend
    const recordsArray = [];
    const overallRating = record.sla_rating || null;
    
    for (let i = 1; i <= 10; i++) {
      const slaValue = record[`sla${i}_value`];
      const techName = record[`sla${i}_tech_name`];
      const phone = record[`sla${i}_phone`];
      
      // Only include if at least one field has a value
      if (slaValue || techName || phone) {
        recordsArray.push({
          sla_id: `SLA-${i}`,
          sla_value: slaValue || null,
          technician_name: techName || null,
          technician_phno: phone || null,
          // Distribute the overall rating to each SLA (since table has single rating field)
          rating: overallRating || null
        });
      }
    }
    
    res.json({
      success: true,
      data: recordsArray,
      message: "Vendor SLA records retrieved successfully"
    });
  } catch (error) {
    console.error("Get vendor SLA records error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch vendor SLA records",
      message: error.message
    });
  }
};

// Create or update vendor SLA records for a maintenance schedule
exports.upsertVendorSLARecords = async (req, res) => {
  try {
    const { maintenanceId } = req.params;
    const { vendor_id, records } = req.body;
    const user_id = req.user?.user_id;
    const org_id = req.user?.org_id;
    
    if (!vendor_id || !records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: "vendor_id and records array are required"
      });
    }
    
    const recordsData = {
      vendor_id,
      ams_id: maintenanceId,
      records,
      user_id,
      org_id
    };
    
    const savedRecord = await vendorSLARecordsModel.upsertVendorSLARecords(recordsData);
    
    res.json({
      success: true,
      data: savedRecord,
      message: "Vendor SLA records saved successfully"
    });
  } catch (error) {
    console.error("Save vendor SLA records error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save vendor SLA records",
      message: error.message
    });
  }
};
