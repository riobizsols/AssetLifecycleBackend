const express = require('express');
const router = express.Router();
const {
  createTenant,
  getAllTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  testTenantConnection,
  checkOrgIdAvailability,
} = require('../controllers/tenantSetupController');

// All routes are public for now (can add auth middleware later if needed)
router.post('/check-org-id', checkOrgIdAvailability);
router.post('/create', createTenant);
router.get('/list', getAllTenants);
router.get('/:orgId', getTenantById);
router.put('/:orgId', updateTenant);
router.delete('/:orgId', deleteTenant);
router.get('/:orgId/test-connection', testTenantConnection);

module.exports = router;

