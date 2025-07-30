const express = require('express');
const router = express.Router();
const { generateSerialNumber, getCurrentSequence, getSerialNumberStats } = require('../utils/serialNumberGenerator');

// Generate new serial number
router.post('/generate', async (req, res) => {
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

// Get current sequence for an asset type
router.get('/current-sequence/:assetTypeId', async (req, res) => {
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

// Get serial number statistics
router.get('/stats', async (req, res) => {
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
        message: 'Failed to get serial number stats',
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

// Test endpoint to generate multiple serial numbers
router.post('/test-generate', async (req, res) => {
  try {
    const { assetTypeId, count = 5, orgId = 'ORG001' } = req.body;
    
    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }
    
    const results = [];
    
    for (let i = 0; i < count; i++) {
      const result = await generateSerialNumber(assetTypeId, orgId);
      results.push(result);
    }
    
    res.json({
      success: true,
      message: `Generated ${count} serial numbers`,
      data: results
    });
  } catch (error) {
    console.error('Error in test generation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router; 