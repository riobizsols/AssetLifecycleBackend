const fs = require('fs');
const path = require('path');

// Read the AppRoutes.jsx file
const routesFile = path.join(__dirname, '../AssetLifecycleManagementFrontend/src/routes/AppRoutes.jsx');
const content = fs.readFileSync(routesFile, 'utf8');

// Extract route paths using regex
const routePattern = /path="([^"]+)"/g;
const routes = [];
let match;

while ((match = routePattern.exec(content)) !== null) {
  routes.push(match[1]);
}

console.log('🔍 Available routes in the application:\n');
routes.forEach((route, index) => {
  console.log(`${index + 1}. ${route}`);
});

console.log(`\n📊 Total available routes: ${routes.length}`);

// Check which routes from our sidebar mapping actually exist
const sidebarRoutes = [
  '/dashboard',
  '/assets',
  '/assets/add',
  '/assign-department-assets',
  '/assign-employee-assets',
  '/maintenance-approval',
  '/supervisor-approval',
  '/master-data/vendors',
  '/master-data/organizations',
  '/master-data/asset-types',
  '/master-data/departments',
  '/master-data/departments-admin',
  '/master-data/departments-asset',
  '/master-data/branches',
  '/master-data/prod-serv',
  '/master-data/users'
];

console.log('\n🔍 Checking sidebar route mappings:\n');
sidebarRoutes.forEach(route => {
  const exists = routes.includes(route);
  console.log(`${exists ? '✅' : '❌'} ${route} ${exists ? '(exists)' : '(missing)'}`);
}); 