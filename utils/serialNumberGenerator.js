const pool = require('../config/db');
const { generateCustomId } = require('./idGenerator');

/**
 * Convert asset type ID to serial number format
 * AT001 -> 01, AT002 -> 02, AT003 -> 03, etc.
 * This follows the format: [AssetTypeCode (2 digits)] + [Year (2 digits)] + [Month (2 digits)] + [Running Number (5 digits)]
 */
const convertAssetTypeToSerialFormat = (assetTypeId) => {
  if (assetTypeId.startsWith('AT')) {
    // Extract number from AT001, AT002, etc.
    const numericPart = assetTypeId.replace('AT', '');
    const assetTypeNumber = parseInt(numericPart);
    
    // Take the last two digits of the asset type number
    return assetTypeNumber.toString().padStart(2, '0');
  } else {
    // Fallback for other formats
    return assetTypeId.toString().padStart(2, '0');
  }
};

/**
 * Add serial number to print queue
 */
const addToPrintQueue = async (serialNumber, orgId, createdBy) => {
  try {
    // Generate psnq_id using the existing ID generation logic
    const psnqId = await generateCustomId("psnq", 3);
    
    const query = `
      INSERT INTO "tblPrintSerialNoQueue" 
      (psnq_id, serial_no, status, created_by, created_on, org_id)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      psnqId, 
      serialNumber, 
      'PN', // Pending status
      createdBy, 
      orgId
    ]);
    
    console.log(`📋 Added to print queue: ${serialNumber} (Queue ID: ${psnqId})`);
    
    return {
      success: true,
      queueRecord: result.rows[0]
    };
  } catch (error) {
    console.error('❌ Error adding to print queue:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Generate serial number with format: AssetType + Year + Month + 5-digit sequence
 * Example: 1250700301 (AssetType: AST001 -> 12, Year: 50, Month: 07, Sequence: 00301)
 * This function ONLY PREVIEWS the next serial number - does NOT increment the database
 * The sequence is only incremented when an asset is actually created
 */
const generateSerialNumber = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of year
    const reversedYear = year.split('').reverse().join(''); // Reverse the year: 25 -> 50
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
    
    // Convert asset type ID to serial format (AST001 -> 12)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    // Get current sequence from tblAssetTypes table (READ ONLY - no increment)
    const seqQuery = `
      SELECT COALESCE(last_gen_seq_no, 0) AS current_seq
      FROM "tblAssetTypes" 
      WHERE asset_type_id = $1
    `;
    
    const seqResult = await pool.query(seqQuery, [assetTypeId]);
    
    if (seqResult.rows.length === 0) {
      throw new Error(`Asset type ${assetTypeId} not found`);
    }
    
    const currentSeq = parseInt(seqResult.rows[0].current_seq) || 0;
    const nextSequence = currentSeq + 1; // Preview the NEXT sequence (current + 1)
    
    console.log(`🔍 Debug: currentSeq type: ${typeof currentSeq}, value: ${currentSeq}`);
    console.log(`🔍 Debug: nextSequence type: ${typeof nextSequence}, value: ${nextSequence}`);
    
    // Generate the serial number (preview only)
    const serialNumber = `${formattedAssetTypeId}${reversedYear}${month}${nextSequence.toString().padStart(5, '0')}`;
    
    console.log(`👀 Preview serial number: ${serialNumber} (Current DB: ${currentSeq}, Next: ${nextSequence}) for asset type: ${assetTypeId}`);
    
    return {
      success: true,
      serialNumber: serialNumber,
      sequence: nextSequence,
      assetTypeId: formattedAssetTypeId,
      year: year,
      month: month,
      orgId: orgId,
      isPreview: true
    };
    
  } catch (error) {
    console.error('❌ Error previewing serial number:', error);
    return {
      success: false,
      error: error.message
    };
  }
};



/**
 * Generate serial number and add to print queue
 */
const generateSerialNumberAndQueue = async (assetTypeId, orgId, createdBy) => {
  try {
    const serialResult = await generateSerialNumber(assetTypeId, orgId);
    
    if (serialResult.success) {
      const queueResult = await addToPrintQueue(
        serialResult.serialNumber, 
        orgId, 
        createdBy
      );
      
      return {
        ...serialResult,
        queuedForPrint: queueResult.success,
        queueId: queueResult.queueRecord?.psnq_id,
        printQueueRecord: queueResult.queueRecord
      };
    }
    
    return serialResult;
  } catch (error) {
    console.error('❌ Error generating serial number and queuing:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get current sequence for an asset type from tblAssetTypes table
 */
const getCurrentSequence = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const reversedYear = year.split('').reverse().join(''); // Reverse the year: 25 -> 50
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Convert asset type ID to serial format (AST001 -> 12)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    // Get current sequence from tblAssetTypes table
    const query = `
      SELECT COALESCE(last_gen_seq_no, 0) as current_sequence
      FROM "tblAssetTypes" 
      WHERE asset_type_id = $1
    `;
    
    const result = await pool.query(query, [assetTypeId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        error: `Asset type ${assetTypeId} not found`
      };
    }
    
    const currentSequence = parseInt(result.rows[0].current_sequence) || 0;
    
    // Generate the last used serial number for display
    const lastUsedSerial = `${formattedAssetTypeId}${reversedYear}${month}${currentSequence.toString().padStart(5, '0')}`;
    
    return {
      success: true,
      currentSequence: currentSequence,
      lastUsedSerial: lastUsedSerial,
      assetTypeId: formattedAssetTypeId,
      year: year,
      month: month
    };
    
  } catch (error) {
    console.error('❌ Error getting current sequence:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Preview the next serial number without incrementing the sequence
 * This is for display purposes only
 */
const previewNextSerialNumber = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const reversedYear = year.split('').reverse().join('');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Convert asset type ID to serial format (AST001 -> 12)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    // Get current sequence from tblAssetTypes table (READ ONLY)
    const query = `
      SELECT COALESCE(last_gen_seq_no, 0) as current_sequence
      FROM "tblAssetTypes" 
      WHERE asset_type_id = $1
    `;
    
    const result = await pool.query(query, [assetTypeId]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        error: `Asset type ${assetTypeId} not found`
      };
    }
    
    const currentSequence = parseInt(result.rows[0].current_sequence) || 0;
    const nextSequence = currentSequence + 1;
    
    console.log(`🔍 Debug preview: currentSequence type: ${typeof currentSequence}, value: ${currentSequence}`);
    console.log(`🔍 Debug preview: nextSequence type: ${typeof nextSequence}, value: ${nextSequence}`);
    
    // Generate the next serial number (preview only)
    const nextSerial = `${formattedAssetTypeId}${reversedYear}${month}${nextSequence.toString().padStart(5, '0')}`;
    
    console.log(`👀 Preview next serial number: ${nextSerial} (Current: ${currentSequence}, Next: ${nextSequence}) for asset type: ${assetTypeId}`);
    
    return {
      success: true,
      serialNumber: nextSerial,
      sequence: nextSequence,
      assetTypeId: formattedAssetTypeId,
      year: year,
      month: month,
      orgId: orgId,
      isPreview: true
    };
    
  } catch (error) {
    console.error('❌ Error previewing next serial number:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get print queue items
 */
const getPrintQueue = async (orgId = 'ORG001', status = null) => {
  try {
    let query = `
      SELECT 
        psnq_id,
        serial_no,
        status,
        created_by,
        created_on,
        org_id
      FROM "tblPrintSerialNoQueue" 
      WHERE org_id = $1
    `;
    
    const params = [orgId];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += ` ORDER BY created_on DESC`;
    
    const result = await pool.query(query, params);
    
    return {
      success: true,
      queueItems: result.rows
    };
    
  } catch (error) {
    console.error('❌ Error getting print queue:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Update print queue item status
 */
const updatePrintQueueStatus = async (psnqId, status, orgId = 'ORG001') => {
  try {
    const query = `
      UPDATE "tblPrintSerialNoQueue" 
      SET status = $1
      WHERE psnq_id = $2 AND org_id = $3
      RETURNING *
    `;
    
    const result = await pool.query(query, [status, psnqId, orgId]);
    
    if (result.rows.length > 0) {
      return {
        success: true,
        updatedRecord: result.rows[0]
      };
    } else {
      return {
        success: false,
        error: 'Queue item not found'
      };
    }
    
  } catch (error) {
    console.error('❌ Error updating print queue status:', error);
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
        SUBSTRING(serial_no, 1, 2) as asset_type_id,
        SUBSTRING(serial_no, 3, 2) as year,
        SUBSTRING(serial_no, 5, 2) as month,
        COUNT(*) as count,
        MIN(created_on) as first_created,
        MAX(created_on) as last_created
      FROM "tblPrintSerialNoQueue" 
      WHERE org_id = $1 AND serial_no ~ '^[0-9]{12}$'
      GROUP BY 
        SUBSTRING(serial_no, 1, 2),
        SUBSTRING(serial_no, 3, 2),
        SUBSTRING(serial_no, 5, 2)
      ORDER BY 
        SUBSTRING(serial_no, 1, 2),
        SUBSTRING(serial_no, 3, 2) DESC,
        SUBSTRING(serial_no, 5, 2) DESC
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

/**
 * Get print queue statistics
 */
const getPrintQueueStats = async (orgId = 'ORG001') => {
  try {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        MIN(created_on) as oldest_item,
        MAX(created_on) as newest_item
      FROM "tblPrintSerialNoQueue" 
      WHERE org_id = $1
      GROUP BY status
      ORDER BY status
    `;
    
    const result = await pool.query(query, [orgId]);
    
    return {
      success: true,
      stats: result.rows
    };
    
  } catch (error) {
    console.error('❌ Error getting print queue stats:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  generateSerialNumber,
  generateSerialNumberAndQueue,
  getCurrentSequence,
  previewNextSerialNumber,
  getSerialNumberStats,
  getPrintQueue,
  updatePrintQueueStatus,
  getPrintQueueStats,
  convertAssetTypeToSerialFormat,
  addToPrintQueue
}; 