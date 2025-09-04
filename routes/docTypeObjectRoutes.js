const express = require('express');
const router = express.Router();
const {
    getAllDocTypeObjects,
    getDocTypeObjectById,
    getDocTypeObjectsByObjectType,
    getDocTypeObjectsByDocType,
    getCommonDocTypeObjects
} = require('../controllers/docTypeObjectController');

// Get all document type objects
router.get('/', getAllDocTypeObjects);

// Get common document type objects (object_type = '*')
router.get('/common', getCommonDocTypeObjects);

// Get document type objects by object type
router.get('/object-type/:object_type', getDocTypeObjectsByObjectType);

// Get document type objects by document type
router.get('/doc-type/:doc_type', getDocTypeObjectsByDocType);

// Get document type object by ID
router.get('/:id', getDocTypeObjectById);

module.exports = router;
