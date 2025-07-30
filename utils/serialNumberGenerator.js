const pool = require('../config/db');

/**
 * Convert asset type ID to serial number format
 * AST001 -> 01, AST002 -> 02, AST010 -> 10, etc.
 */
const convertAssetTypeToSerialFormat = (assetTypeId) => {
  if (assetTypeId.startsWith('AST')) {
    // Extract number from AST001, AST002, etc.
    const numericPart = assetTypeId.replace('AST', '');
    return parseInt(numericPart).toString().padStart(2, '0');
  } else {
    // Fallback for other formats
    return assetTypeId.toString().padStart(2, '0');
  }
};

/**
 * Generate serial number with format: AssetType + Year + Month + 5-digit sequence
 * Example: 01250700301 (AssetType: AST001 -> 01, Year: 25, Month: 07, Sequence: 00301)
 */
const generateSerialNumber = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of year
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
    
    // Convert asset type ID to serial format (AST001 -> 01)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    // Check if record exists for this asset type, year, and month
    const checkQuery = `
      SELECT current_sequence, last_used_serial 
      FROM tblAssetSerialNumbers 
      WHERE asset_type_id = $1 AND year = $2 AND month = $3 AND org_id = $4
    `;
    
    const checkResult = await pool.query(checkQuery, [formattedAssetTypeId, year, month, orgId]);
    
    let newSequence;
    let serialNumber;
    
    if (checkResult.rows.length > 0) {
      // Record exists, increment sequence
      newSequence = checkResult.rows[0].current_sequence + 1;
      
      // Update existing record
      const updateQuery = `
        UPDATE tblAssetSerialNumbers 
        SET current_sequence = $1, 
            last_used_serial = $2, 
            updated_on = CURRENT_TIMESTAMP 
        WHERE asset_type_id = $3 AND year = $4 AND month = $5 AND org_id = $6
      `;
      
      serialNumber = `${formattedAssetTypeId}${year}${month}${newSequence.toString().padStart(5, '0')}`;
      
      await pool.query(updateQuery, [newSequence, serialNumber, formattedAssetTypeId, year, month, orgId]);
      
      console.log(`📝 Updated serial number: ${serialNumber} (Sequence: ${newSequence})`);
    } else {
      // Record doesn't exist, create new one
      newSequence = 1;
      serialNumber = `${formattedAssetTypeId}${year}${month}${newSequence.toString().padStart(5, '0')}`;
      
      const insertQuery = `
        INSERT INTO tblAssetSerialNumbers 
        (asset_type_id, year, month, current_sequence, last_used_serial, org_id) 
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      await pool.query(insertQuery, [formattedAssetTypeId, year, month, newSequence, serialNumber, orgId]);
      
      console.log(`📝 Created new serial number: ${serialNumber} (Sequence: ${newSequence})`);
    }
    
    return {
      success: true,
      serialNumber: serialNumber,
      sequence: newSequence,
      assetTypeId: formattedAssetTypeId,
      year: year,
      month: month,
      orgId: orgId
    };
    
  } catch (error) {
    console.error('❌ Error generating serial number:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get current sequence for an asset type
 */
const getCurrentSequence = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Convert asset type ID to serial format (AST001 -> 01)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    const query = `
      SELECT current_sequence, last_used_serial 
      FROM tblAssetSerialNumbers 
      WHERE asset_type_id = $1 AND year = $2 AND month = $3 AND org_id = $4
    `;
    
    const result = await pool.query(query, [formattedAssetTypeId, year, month, orgId]);
    
    if (result.rows.length > 0) {
      return {
        success: true,
        currentSequence: result.rows[0].current_sequence,
        lastUsedSerial: result.rows[0].last_used_serial,
        assetTypeId: formattedAssetTypeId,
        year: year,
        month: month
      };
    } else {
      return {
        success: true,
        currentSequence: 0,
        lastUsedSerial: null,
        assetTypeId: formattedAssetTypeId,
        year: year,
        month: month
      };
    }
    
  } catch (error) {
    console.error('❌ Error getting current sequence:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get serial number statistics
 */
const getSerialNumberStats = async (orgId = 'ORG001') => {
  try {
    const query = `
      SELECT 
        asset_type_id,
        year,
        month,
        current_sequence,
        last_used_serial,
        created_on,
        updated_on
      FROM tblAssetSerialNumbers 
      WHERE org_id = $1
      ORDER BY asset_type_id, year DESC, month DESC
    `;
    
    const result = await pool.query(query, [orgId]);
    
    return {
      success: true,
      stats: result.rows
    };
    
  } catch (error) {
    console.error('❌ Error getting serial number stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  generateSerialNumber,
  getCurrentSequence,
  getSerialNumberStats,
  convertAssetTypeToSerialFormat
}; 