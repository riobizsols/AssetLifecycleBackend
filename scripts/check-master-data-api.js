require('dotenv').config();
const { getUserNavigation } = require('../models/jobRoleNavModel');

(async () => {
  const nav = await getUserNavigation('USR003', 'D');
  const master = nav.find(
    (i) => String(i.label || '').toLowerCase() === 'master data',
  );
  console.log('Master Data group:', master?.label, 'children:', master?.children?.length);
  for (const c of master?.children || []) {
    console.log(`  - ${c.label} (${c.app_id}) access=${c.access_level}`);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
