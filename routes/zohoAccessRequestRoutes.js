const express = require('express');
const router = express.Router();
const {
  opsLogin,
  getClaimPreview,
  checkSubdomain,
  submitAccessRequest,
  listRequests,
  approveRequest,
  rejectRequest,
} = require('../controllers/zohoAccessRequestController');

// Public — Zoho-verified claim required for submit
router.get('/claim-preview', getClaimPreview);
router.post('/check-subdomain', checkSubdomain);
router.post('/request', submitAccessRequest);

// Company ops only (ACCESS_REQUEST_OPS_PASSWORD) — not tenant users
router.post('/ops-login', opsLogin);
router.get('/', listRequests);
router.post('/:id/approve', approveRequest);
router.post('/:id/reject', rejectRequest);

module.exports = router;
