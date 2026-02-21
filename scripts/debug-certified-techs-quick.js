const inspectionApprovalModel = require('../models/inspectionApprovalModel');
(async () => {
  try {
    const orgId = process.argv[2] || 'ORG001';
    const assetTypeId = process.argv[3] || 'AT002';
    console.log('Calling getCertifiedTechnicians for', assetTypeId, orgId);
    const rows = await inspectionApprovalModel.getCertifiedTechnicians(orgId, assetTypeId);
    console.log('Result count:', rows.length);
    console.log(rows);
  } catch (err) {
    console.error('Error calling model:', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
