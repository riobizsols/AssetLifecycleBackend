// Controller to fetch SLA descriptions from tblSLA_Desc
const getSLADescriptions = async (req, res) => {
  try {
    const dbPool = req.db || require("../config/db");
    
    // Table name is tblsla_desc (all lowercase, no quotes needed)
    const query = `
      SELECT 
        sla_id,
        description
      FROM tblsla_desc
      ORDER BY sla_id
    `;
    
    const result = await dbPool.query(query);
    console.log(`[SLAController] ✅ Successfully fetched from tblsla_desc, found ${result.rows.length} rows`);
    if (result.rows.length > 0) {
      console.log(`[SLAController] Sample data:`, result.rows[0]);
    }
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("[SLAController] Error fetching SLA descriptions:", error);
    console.error("[SLAController] Error stack:", error.stack);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch SLA descriptions",
      message: error.message 
    });
  }
};

module.exports = {
  getSLADescriptions
};

