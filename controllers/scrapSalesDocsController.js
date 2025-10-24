const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const db = require('../config/db');

// Import scrap sales logger
const scrapSalesLogger = require('../eventLoggers/scrapSalesEventLogger');
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
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const body = req.body || {};
      const ssh_id = body.ssh_id || req.params.ssh_id;
      const { dto_id, doc_type_name } = body;
      const org_id = req.user.org_id;

      // Log API called (context-aware)
      const { context } = req.query;
      if (context === 'SCRAPSALES') {
        scrapSalesLogger.logApiCall({
          operation: 'Upload Scrap Sales Document',
          method: req.method,
          url: req.originalUrl,
          userId,
          requestData: { ssh_id, dto_id, doc_type_name }
        }).catch(err => console.error('Logging error:', err));
      }

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
      const hash = crypto.randomBytes(4).toString('hex'); // Shorter hash
      const objectName = `${org_id}/scrap-sales/${ssh_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      // Use shorter path format to fit in 50-character limit
      const doc_path = `scrap-sales/${ssh_id}/${Date.now()}_${hash}${ext}`;

      // Generate unique document ID (max 20 characters)
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      const ssdoc_id = `SSDOC${timestamp}${random}`;
      
      console.log('Generated ssdoc_id:', ssdoc_id, 'Length:', ssdoc_id.length);
      console.log('doc_type_name:', doc_type_name, 'Length:', doc_type_name?.length);
      console.log('ssh_id:', ssh_id, 'Length:', ssh_id?.length);
      console.log('org_id:', org_id, 'Length:', org_id?.length);
      console.log('doc_path:', doc_path, 'Length:', doc_path?.length);
      
      const dbRes = await insertScrapSalesDoc({
        ssdoc_id,
        ssh_id,
        dto_id: dto_id || null,
        doc_type_name: doc_type_name ? doc_type_name.substring(0, 50) : null, // Limit to 50 characters
        doc_path, // Now using shorter path format
        is_archived: false,
        archived_path: null,
        org_id
      });

      // Log success (context-aware)
      if (context === 'SCRAPSALES') {
        scrapSalesLogger.logOperationSuccess({
          operation: 'Upload Scrap Sales Document',
          userId,
          duration: Date.now() - startTime,
          resultData: { 
            ssdoc_id, 
            ssh_id, 
            doc_type_name,
            file_name: req.file.originalname 
          }
        }).catch(err => console.error('Logging error:', err));
      }

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document: dbRes.rows[0]
      });
    } catch (err) {
      console.error('Upload failed', err);
      
      // Log error (context-aware)
      if (context === 'SCRAPSALES') {
        scrapSalesLogger.logOperationError({
          operation: 'Upload Scrap Sales Document',
          error: err,
          userId,
          duration: Date.now() - startTime,
          requestData: { ssh_id, dto_id, doc_type_name }
        }).catch(logErr => console.error('Logging error:', logErr));
      }
      
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

// List documents for a scrap sale
const listDocsByScrapSale = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { ssh_id } = req.params;
    const { doc_type } = req.query;

    // Log API called (context-aware)
    const { context } = req.query;
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logApiCall({
        operation: 'List Scrap Sales Documents',
        method: req.method,
        url: req.originalUrl,
        userId,
        requestData: { ssh_id, doc_type }
      }).catch(err => console.error('Logging error:', err));
    }

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

    // Log success (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationSuccess({
        operation: 'List Scrap Sales Documents',
        userId,
        duration: Date.now() - startTime,
        resultData: { 
          ssh_id, 
          doc_type,
          document_count: result.rows.length 
        }
      }).catch(err => console.error('Logging error:', err));
    }

    return res.json({
      message: 'Documents retrieved successfully',
      documents: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    
    // Log error (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationError({
        operation: 'List Scrap Sales Documents',
        error: err,
        userId,
        duration: Date.now() - startTime,
        requestData: { ssh_id, doc_type }
      }).catch(logErr => console.error('Logging error:', logErr));
    }
    
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
    // Handle both old format (bucket/path) and new format (path only)
    let objectName;
    if (doc.doc_path.includes('/')) {
      if (doc.doc_path.startsWith('asset-docs/')) {
        // Old format: asset-docs/org/scrap-sales/ssh_id/file
        const [bucket, ...keyParts] = doc.doc_path.split('/');
        objectName = keyParts.join('/');
      } else {
        // New format: scrap-sales/ssh_id/file
        objectName = doc.doc_path;
      }
    } else {
      objectName = doc.doc_path;
    }

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
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { ssdoc_id } = req.params;
    const { archived_path } = req.body;

    // Log API called (context-aware)
    const { context } = req.query;
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logApiCall({
        operation: 'Archive Scrap Sales Document',
        method: req.method,
        url: req.originalUrl,
        userId,
        requestData: { ssdoc_id, archived_path }
      }).catch(err => console.error('Logging error:', err));
    }

    const result = await archiveScrapSalesDoc(ssdoc_id, archived_path);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationSuccess({
        operation: 'Archive Scrap Sales Document',
        userId,
        duration: Date.now() - startTime,
        resultData: { ssdoc_id, archived_path }
      }).catch(err => console.error('Logging error:', err));
    }

    return res.json({
      message: 'Document archived successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to archive document', err);
    
    // Log error (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationError({
        operation: 'Archive Scrap Sales Document',
        error: err,
        userId,
        duration: Date.now() - startTime,
        requestData: { ssdoc_id, archived_path }
      }).catch(logErr => console.error('Logging error:', logErr));
    }
    
    return res.status(500).json({ message: 'Failed to archive document', error: err.message });
  }
};

// Delete scrap sales document
const deleteDoc = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { ssdoc_id } = req.params;

    // Log API called (context-aware)
    const { context } = req.query;
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logApiCall({
        operation: 'Delete Scrap Sales Document',
        method: req.method,
        url: req.originalUrl,
        userId,
        requestData: { ssdoc_id }
      }).catch(err => console.error('Logging error:', err));
    }

    const result = await deleteScrapSalesDoc(ssdoc_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationSuccess({
        operation: 'Delete Scrap Sales Document',
        userId,
        duration: Date.now() - startTime,
        resultData: { ssdoc_id }
      }).catch(err => console.error('Logging error:', err));
    }

    return res.json({
      message: 'Document deleted successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to delete document', err);
    
    // Log error (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationError({
        operation: 'Delete Scrap Sales Document',
        error: err,
        userId,
        duration: Date.now() - startTime,
        requestData: { ssdoc_id }
      }).catch(logErr => console.error('Logging error:', logErr));
    }
    
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

// Update document archive status
const updateDocArchiveStatus = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { ssdoc_id } = req.params;
    const { is_archived, archived_path } = req.body;

    // Log API called (context-aware)
    const { context } = req.query;
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logApiCall({
        operation: 'Update Document Archive Status',
        method: req.method,
        url: req.originalUrl,
        userId,
        requestData: { ssdoc_id, is_archived, archived_path }
      }).catch(err => console.error('Logging error:', err));
    }

    const query = `
      UPDATE "tblScrapSalesDocs"
      SET is_archived = $2, archived_path = $3
      WHERE ssdoc_id = $1
      RETURNING *
    `;
    const result = await db.query(query, [ssdoc_id, is_archived, archived_path]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationSuccess({
        operation: 'Update Document Archive Status',
        userId,
        duration: Date.now() - startTime,
        resultData: { ssdoc_id, is_archived, archived_path }
      }).catch(err => console.error('Logging error:', err));
    }

    return res.json({
      message: 'Document archive status updated successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    
    // Log error (context-aware)
    if (context === 'SCRAPSALES') {
      scrapSalesLogger.logOperationError({
        operation: 'Update Document Archive Status',
        error: err,
        userId,
        duration: Date.now() - startTime,
        requestData: { ssdoc_id, is_archived, archived_path }
      }).catch(logErr => console.error('Logging error:', logErr));
    }
    
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

module.exports = { 
  uploadScrapSalesDoc, 
  listDocsByScrapSale,
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById,
  updateDocArchiveStatus
};
