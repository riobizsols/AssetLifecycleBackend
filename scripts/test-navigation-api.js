/**
 * Test script to check what the navigation API returns
 */

const { getDbFromContext } = require('../utils/dbContext');
const { getCombinedNavigationStructure } = require('../models/jobRoleNavModel');

const getDb = () => getDbFromContext();

(async () => {
  try {
    // Test with JR001 (which should have the new screens)
    const jobRoleIds = ['JR001'];
    const platform = 'D';
    
    console.log(`🔍 Testing navigation for job roles: ${jobRoleIds.join(', ')}\n`);
    
    const navigation = await getCombinedNavigationStructure(jobRoleIds, platform);
    
    // Check for the new screens as top-level items
    const newScreens = ['MAINTENANCECONFIG', 'PROPERTIES', 'BREAKDOWNREASONCODES'];
    
    const findItem = (items, appId) => {
      for (const item of items) {
        if (item.app_id === appId) {
          return item;
        }
        if (item.children && item.children.length > 0) {
          const found = findItem(item.children, appId);
          if (found) return found;
        }
      }
      return null;
    };
    
    console.log('🔍 Checking for new screens as top-level items:');
    newScreens.forEach(screenId => {
      const found = findItem(navigation, screenId);
      if (found) {
        const isTopLevel = !found.parent_id;
        console.log(`   ✅ ${screenId}: Found (${found.label}) - ${isTopLevel ? 'TOP-LEVEL' : 'Nested under ' + found.parent_id}`);
      } else {
        console.log(`   ❌ ${screenId}: NOT FOUND`);
      }
    });
    
    // Also check ADMINSETTINGS
    const adminSettings = findItem(navigation, 'ADMINSETTINGS');
    if (adminSettings) {
      console.log(`\n✅ Found ADMINSETTINGS: ${adminSettings.app_id} (${adminSettings.id})`);
      console.log(`   Label: ${adminSettings.label}`);
      console.log(`   Children count: ${adminSettings.children ? adminSettings.children.length : 0}`);
      if (adminSettings.children && adminSettings.children.length > 0) {
        console.log('📋 Children of ADMINSETTINGS:');
        adminSettings.children.forEach(child => {
          console.log(`   - ${child.app_id}: ${child.label}`);
        });
      }
    }
    
    console.log('\n📊 Full navigation structure (first 5 top-level items):');
    navigation.slice(0, 5).forEach(item => {
      console.log(`   - ${item.app_id}: ${item.label} (children: ${item.children?.length || 0})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
})();

