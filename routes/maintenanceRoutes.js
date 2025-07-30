const express = require('express');
const router = express.Router();
const { createMaintenanceSchedule, dummyMaintenanceSchedule, executionCount, getExecutionCount, getMaintenanceConfig } = require('../services/maintenanceScheduleService');

// Note: These routes are for testing purposes and don't require authentication
// They are intentionally left unprotected for dashboard monitoring

// Test endpoint to manually trigger dummy maintenance schedule
router.get('/test-dummy', (req, res) => {
  try {
    const beforeCount = getExecutionCount();
    console.log('🎯 Test-dummy endpoint called - Before execution, count:', beforeCount);
    dummyMaintenanceSchedule();
    const afterCount = getExecutionCount();
    console.log('🎯 Test-dummy endpoint - After execution, count:', afterCount);
    res.json({ 
      success: true, 
      message: 'Dummy maintenance schedule executed successfully',
      timestamp: new Date().toISOString(),
      executionCount: afterCount
    });
  } catch (error) {
    console.error('Error executing dummy maintenance schedule:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error executing dummy maintenance schedule',
      error: error.message 
    });
  }
});

// Test endpoint to manually trigger actual maintenance schedule
router.get('/test-actual', async (req, res) => {
  try {
    await createMaintenanceSchedule();
    res.json({ 
      success: true, 
      message: 'Maintenance schedule executed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing maintenance schedule:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error executing maintenance schedule',
      error: error.message 
    });
  }
});

// Get maintenance schedule status
router.get('/status', (req, res) => {
  const now = new Date();
  const nextExecution = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);
  
  const currentCount = getExecutionCount();
  console.log('🔍 Status endpoint called - Current executionCount:', currentCount);
  
  res.json({
    success: true,
    message: 'Maintenance schedule service is running',
    cronStatus: 'Active - Running every hour',
    schedule: '0 * * * *',
    nextExecution: nextExecution.toISOString(),
    timestamp: now.toISOString(),
    serverTime: now.toISOString(),
    executionCount: currentCount,
    maintenanceConfig: getMaintenanceConfig()
  });
});

// Test endpoint to check maintenance records
router.get('/check-records', async (req, res) => {
  try {
    const pool = require('../config/db');
    
    // Check header records
    const headerQuery = `
      SELECT COUNT(*) as count, 
             MAX(created_on) as latest_created,
             status,
             asset_id
      FROM "tblWFAssetMaintSch_H" 
      WHERE created_by = 'system'
      GROUP BY status, asset_id
      ORDER BY latest_created DESC
      LIMIT 10
    `;
    
    const headerResult = await pool.query(headerQuery);
    
    // Check detail records
                    const detailQuery = `
                  SELECT COUNT(*) as count,
                         MAX(created_on) as latest_created,
                         status,
                         wfamsh_id
                  FROM "tblWFAssetMaintSch_D" 
                  WHERE created_by = 'system'
                  GROUP BY status, wfamsh_id
                  ORDER BY latest_created DESC
                  LIMIT 10
                `;
    
    const detailResult = await pool.query(detailQuery);
    
    res.json({
      success: true,
      message: 'Maintenance records check completed',
      headerRecords: headerResult.rows,
      detailRecords: detailResult.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking maintenance records:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking maintenance records',
      error: error.message
    });
  }
});

// Test endpoint to create sample maintenance data
router.post('/create-test-data', async (req, res) => {
  try {
    const pool = require('../config/db');
    
    // Create sample asset types if they don't exist
    const assetTypesQuery = `
      INSERT INTO "tblAssetTypes" (asset_type_id, asset_type_name, maint_required) 
      VALUES 
        ('AST001', 'Laptop', true),
        ('AST002', 'Desktop', true),
        ('AST003', 'Printer', true)
      ON CONFLICT (asset_type_id) DO NOTHING
    `;
    await pool.query(assetTypesQuery);
    
    // Create sample assets if they don't exist
    const assetsQuery = `
      INSERT INTO "tblAssets" (asset_id, asset_type_id, purchased_on, service_vendor_id, org_id) 
      VALUES 
        ('LAP001', 'AST001', '2024-01-01', 'VEND001', 'ORG001'),
        ('LAP002', 'AST001', '2024-02-01', 'VEND001', 'ORG001'),
        ('DESK001', 'AST002', '2024-01-15', 'VEND002', 'ORG001'),
        ('PRINT001', 'AST003', '2024-03-01', 'VEND003', 'ORG001')
      ON CONFLICT (asset_id) DO NOTHING
    `;
    await pool.query(assetsQuery);
    
    // Create sample maintenance frequency
    const freqQuery = `
      INSERT INTO "tblATMaintFreq" (at_main_freq_id, asset_type_id, frequency, uom) 
      VALUES 
        ('FREQ001', 'AST001', 6, 'months'),
        ('FREQ002', 'AST002', 12, 'months'),
        ('FREQ003', 'AST003', 3, 'months')
      ON CONFLICT (at_main_freq_id) DO NOTHING
    `;
    await pool.query(freqQuery);
    
    res.json({
      success: true,
      message: 'Test data created successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error creating test data:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test data',
      error: error.message
    });
  }
});

module.exports = router; 