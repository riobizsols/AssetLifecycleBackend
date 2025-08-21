const express = require('express');
const router = express.Router();
const { 
  generateSerialNumber, 
  generateSerialNumberAndQueue,
  getCurrentSequence,
  previewNextSerialNumber, 
  getSerialNumberStats,
  getPrintQueue,
  updatePrintQueueStatus,
  getPrintQueueStats,
  convertAssetTypeToSerialFormat
} = require('../utils/serialNumberGenerator');
const { protect } = require('../middlewares/authMiddleware');

// Generate new serial number
router.post('/generate', protect, async (req, res) => {
  try {
    const { assetTypeId, orgId = 'ORG001' } = req.body;
    
    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }
    
    const result = await generateSerialNumber(assetTypeId, orgId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Serial number generated successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate serial number',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error generating serial number:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Generate new serial number and add to print queue
router.post('/generate-and-queue', protect, async (req, res) => {
  try {
    const { assetTypeId, orgId = 'ORG001' } = req.body;
    const createdBy = req.user.user_id;
    
    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }
    
    const result = await generateSerialNumberAndQueue(assetTypeId, orgId, createdBy);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Serial number generated and queued for printing successfully',
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to generate serial number and queue',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error generating serial number and queuing:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get current sequence for an asset type
router.get('/current/:assetTypeId', protect, async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const { orgId = 'ORG001' } = req.query;
    
    const result = await getCurrentSequence(assetTypeId, orgId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get current sequence',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting current sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Preview next sequence number for an asset type (without generating/incrementing)
router.get('/next/:assetTypeId', protect, async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const { orgId = 'ORG001' } = req.query;
    
    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }
    
    const result = await previewNextSerialNumber(assetTypeId, orgId);
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          serialNumber: result.serialNumber,
          sequence: result.sequence,
          assetTypeId: result.assetTypeId,
          year: result.year,
          month: result.month,
          isPreview: result.isPreview
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to preview next sequence',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error previewing next sequence:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get serial number statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const { orgId = 'ORG001' } = req.query;
    
    const result = await getSerialNumberStats(orgId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get serial number statistics',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting serial number stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get print queue items
router.get('/print-queue', protect, async (req, res) => {
  try {
    const { orgId = 'ORG001', status } = req.query;
    
    const result = await getPrintQueue(orgId, status);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.queueItems
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get print queue',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting print queue:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update print queue item status
router.put('/print-queue/:psnqId/status', protect, async (req, res) => {
  try {
    const { psnqId } = req.params;
    const { status, orgId = 'ORG001' } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }
    
    const result = await updatePrintQueueStatus(psnqId, status, orgId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Print queue status updated successfully',
        data: result.updatedRecord
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update print queue status',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error updating print queue status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get print queue statistics
router.get('/print-queue-stats', protect, async (req, res) => {
  try {
    const { orgId = 'ORG001' } = req.query;
    
    const result = await getPrintQueueStats(orgId);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to get print queue statistics',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error getting print queue stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Test endpoint to verify serial number format
router.get('/test-format/:assetTypeId', protect, async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const reversedYear = year.split('').reverse().join('');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const formattedAssetTypeId = convertAssetTypeToSerialFormat(assetTypeId);
    
    const testSerialNumber = `${formattedAssetTypeId}${reversedYear}${month}00001`;
    
    res.json({
      success: true,
      data: {
        assetTypeId,
        formattedAssetTypeId,
        year,
        reversedYear,
        month,
        testSerialNumber,
        breakdown: {
          assetTypeCode: formattedAssetTypeId,
          year: reversedYear,
          month: month,
          runningNumber: '00001'
        }
      }
    });
  } catch (error) {
    console.error('Error testing format:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router; 