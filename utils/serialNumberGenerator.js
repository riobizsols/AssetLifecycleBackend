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
 */
const generateSerialNumber = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2); // Get last 2 digits of year
    const reversedYear = year.split('').reverse().join(''); // Reverse the year: 25 -> 50
    const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Month with leading zero
    
    // Convert asset type ID to serial format (AST001 -> 12)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    // Get the next sequence number by counting existing serial numbers for this asset type, year, and month
    const countQuery = `
      SELECT COUNT(*) as count
      FROM "tblPrintSerialNoQueue" 
      WHERE serial_no LIKE $1 AND org_id = $2
    `;
    
    const pattern = `${formattedAssetTypeId}${reversedYear}${month}%`;
    const countResult = await pool.query(countQuery, [pattern, orgId]);
    
    const newSequence = (countResult.rows[0].count || 0) + 1;
    const serialNumber = `${formattedAssetTypeId}${reversedYear}${month}${newSequence.toString().padStart(5, '0')}`;
    
    console.log(`📝 Generated serial number: ${serialNumber} (Sequence: ${newSequence})`);
    
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
 * Get current sequence for an asset type
 */
const getCurrentSequence = async (assetTypeId, orgId = 'ORG001') => {
  try {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const reversedYear = year.split('').reverse().join(''); // Reverse the year: 25 -> 50
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Convert asset type ID to serial format (AST001 -> 12)
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    const query = `
      SELECT COUNT(*) as count, MAX(serial_no) as last_used_serial
      FROM "tblPrintSerialNoQueue" 
      WHERE serial_no LIKE $1 AND org_id = $2
    `;
    
    const pattern = `${formattedAssetTypeId}${reversedYear}${month}%`;
    const result = await pool.query(query, [pattern, orgId]);
    
    const currentSequence = result.rows[0].count || 0;
    const lastUsedSerial = result.rows[0].last_used_serial;
    
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
  getSerialNumberStats,
  getPrintQueue,
  updatePrintQueueStatus,
  getPrintQueueStats,
  convertAssetTypeToSerialFormat,
  addToPrintQueue
}; 