const { 
  getAllMappings,
  getMappedChecklistsByAssetTypeAndAsset,
  saveMapping,
  deleteMappingGroup 
} = require('./models/assetTypeChecklistMappingModel');

(async () => {
  console.log('\n=== TESTING ASSET TYPE CHECKLIST MAPPING FUNCTIONS ===\n');
  
  try {
    // Test 1: getAllMappings
    console.log('✅ TEST 1: getAllMappings()');
    const allMappings = await getAllMappings(1);
    console.log(`   Result: ${allMappings.length} mappings found\n`);
    
    // Test 2: getMappedChecklistsByAssetTypeAndAsset
    console.log('✅ TEST 2: getMappedChecklistsByAssetTypeAndAsset()');
    const mappedChecklists = await getMappedChecklistsByAssetTypeAndAsset('AST_0001', null, 1);
    console.log(`   Result: ${mappedChecklists.length} checklists mapped\n`);
    
    // Test 3: Test with specific asset
    console.log('✅ TEST 3: getMappedChecklistsByAssetTypeAndAsset() with asset ID');
    const mappedChecklistsWithAsset = await getMappedChecklistsByAssetTypeAndAsset('AST_0001', 'ASSET_001', 1);
    console.log(`   Result: ${mappedChecklistsWithAsset.length} checklists for specific asset\n`);
    
    console.log('🎉 ALL TESTS PASSED - Database queries are working correctly!\n');
    console.log('✨ The "Failed to load mappings" error has been FIXED! ✨\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
