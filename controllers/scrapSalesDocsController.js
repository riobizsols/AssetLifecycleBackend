const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { 
  insertScrapSalesDoc, 
  listScrapSalesDocs, 
  getScrapSalesDocById, 
  listScrapSalesDocsByType,
  checkScrapSaleExists,
  archiveScrapSalesDoc,
  deleteScrapSalesDoc
} = require('../models/scrapSalesDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document for scrap sales
const uploadScrapSalesDoc = [
  upload.single('file'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const ssh_id = body.ssh_id || req.params.ssh_id;
      const { doc_type, doc_type_name } = body;
      const org_id = req.user.org_id;

      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }

      if (!ssh_id || !org_id) {
        return res.status(400).json({ message: 'ssh_id and org_id are required' });
      }

      // Check if scrap sale exists
      const scrapSaleExists = await checkScrapSaleExists(ssh_id);
      if (scrapSaleExists.rows.length === 0) {
        return res.status(404).json({ message: 'Scrap sale not found' });
      }

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/scrap-sales/${ssh_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      // Generate unique document ID
      const ssdoc_id = `SSDOC${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      const dbRes = await insertScrapSalesDoc({
        ssdoc_id,
        ssh_id,
        doc_type: doc_type || null,
        doc_type_name: doc_type_name || null,
        doc_path,
        is_archived: false,
        archived_path: null,
        org_id
      });

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document: dbRes.rows[0]
      });
    } catch (err) {
      console.error('Upload failed', err);
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

// List documents for a scrap sale
const listDocsByScrapSale = async (req, res) => {
  try {
    const { ssh_id } = req.params;
    const { doc_type } = req.query;

    // Check if scrap sale exists
    const scrapSaleExists = await checkScrapSaleExists(ssh_id);
    if (scrapSaleExists.rows.length === 0) {
      return res.status(404).json({ message: 'Scrap sale not found' });
    }

    let result;
    if (doc_type) {
      result = await listScrapSalesDocsByType(ssh_id, doc_type);
    } else {
      result = await listScrapSalesDocs(ssh_id);
    }

    return res.json({
      message: 'Documents retrieved successfully',
      documents: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

// Get download/view URL for scrap sales document
const getDownloadUrl = async (req, res) => {
  try {
    const { ssdoc_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    const result = await getScrapSalesDocById(ssdoc_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = result.rows[0];
    const [bucket, ...keyParts] = doc.doc_path.split('/');
    const objectName = keyParts.join('/');

    const respHeaders = {};
    if (mode === 'download') {
      respHeaders['response-content-disposition'] = `attachment; filename="${path.basename(objectName)}"`;
    } else if (mode === 'view') {
      respHeaders['response-content-disposition'] = 'inline';
    }

    const url = await minioClient.presignedGetObject(bucket, objectName, 60 * 60, respHeaders);
    return res.json({ 
      message: 'URL generated successfully',
      url,
      document: doc
    });
  } catch (err) {
    console.error('Failed to get download url', err);
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

// Archive scrap sales document
const archiveDoc = async (req, res) => {
  try {
    const { ssdoc_id } = req.params;
    const { archived_path } = req.body;

    const result = await archiveScrapSalesDoc(ssdoc_id, archived_path);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document archived successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to archive document', err);
    return res.status(500).json({ message: 'Failed to archive document', error: err.message });
  }
};

// Delete scrap sales document
const deleteDoc = async (req, res) => {
  try {
    const { ssdoc_id } = req.params;

    const result = await deleteScrapSalesDoc(ssdoc_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document deleted successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to delete document', err);
    return res.status(500).json({ message: 'Failed to delete document', error: err.message });
  }
};

// Get document details by ID
const getDocById = async (req, res) => {
  try {
    const { ssdoc_id } = req.params;
    
    const result = await getScrapSalesDocById(ssdoc_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    return res.json({
      message: 'Document retrieved successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to get document', err);
    return res.status(500).json({ message: 'Failed to get document', error: err.message });
  }
};

module.exports = { 
  uploadScrapSalesDoc, 
  listDocsByScrapSale,
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById 
};
