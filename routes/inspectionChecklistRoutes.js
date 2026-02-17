const express = require('express');
const router = express.Router();
const { 
  getAllChecklists, 
  getChecklistById,
  getResponseTypes,
  createChecklist, 
  updateChecklist, 
  deleteChecklist 
} = require('../controllers/inspectionChecklistController');
const { protect } = require('../middlewares/authMiddleware');

// Apply authentication middleware to all routes
router.use(protect);

// Get all checklists
// GET /api/inspection-checklists
router.get('/', getAllChecklists);

// Get response types
// GET /api/inspection-checklists/response-types
router.get('/response-types', getResponseTypes);

// Get single checklist
// GET /api/inspection-checklists/:id
router.get('/:id', getChecklistById);

// Create new checklist
// POST /api/inspection-checklists
router.post('/', createChecklist);

// Update checklist
// PUT /api/inspection-checklists/:id
router.put('/:id', updateChecklist);

// Delete checklist
// DELETE /api/inspection-checklists/:id
router.delete('/:id', deleteChecklist);

module.exports = router;
