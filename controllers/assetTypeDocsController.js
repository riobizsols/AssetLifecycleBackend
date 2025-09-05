const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { generateCustomId } = require('../utils/idGenerator');
const { 
  insertAssetTypeDoc, 
  listAssetTypeDocs, 
  getAssetTypeDocById, 
  listAssetTypeDocsByDto,
  checkAssetTypeExists,
  updateAssetTypeDocArchiveStatus,
  archiveAssetTypeDoc,
  deleteAssetTypeDoc
} = require('../models/assetTypeDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document for asset type
const uploadAssetTypeDoc = [
  upload.single('file'),
  async (req, res) => {
    try {
      const body = req.body || {};
      const asset_type_id = body.asset_type_id || req.params.asset_type_id;
      const { dto_id, doc_type_name } = body;
      const org_id = req.user.org_id;

      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }

      if (!asset_type_id || !org_id) {
        return res.status(400).json({ message: 'asset_type_id and org_id are required' });
      }

      // Check if asset type exists
      const typeExists = await checkAssetTypeExists(asset_type_id);
      if (typeExists.rows.length === 0) {
        return res.status(404).json({ message: 'Asset type not found' });
      }

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/asset-types/${asset_type_id}/${Date.now()}_${hash}${ext}`;

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      // Generate unique document ID
      const atd_id = await generateCustomId('asset_type_doc', 3);
      
      const dbRes = await insertAssetTypeDoc({
        atd_id,
        asset_type_id,
        dto_id: dto_id || null,
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

// List documents for an asset type
const listDocs = async (req, res) => {
  try {
    const { asset_type_id } = req.params;
    const { dto_id } = req.query;

    // Check if asset type exists
    const typeExists = await checkAssetTypeExists(asset_type_id);
    if (typeExists.rows.length === 0) {
      return res.status(404).json({ message: 'Asset type not found' });
    }

    let result;
    if (dto_id) {
      result = await listAssetTypeDocsByDto(asset_type_id, dto_id);
    } else {
      result = await listAssetTypeDocs(asset_type_id);
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

// Get download/view URL for asset type document
const getDownloadUrl = async (req, res) => {
  try {
    const { atd_id, asset_type_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    let result;
    
    if (atd_id) {
      // Direct document access by atd_id
      result = await getAssetTypeDocById(atd_id);
    } else if (asset_type_id) {
      // Get the first document for the asset type
      const docsResult = await listAssetTypeDocs(asset_type_id);
      if (docsResult.rows.length === 0) {
        return res.status(404).json({ message: 'No documents found for this asset type' });
      }
      // Get the first document (most recent)
      const firstDoc = docsResult.rows[0];
      result = await getAssetTypeDocById(firstDoc.atd_id);
    } else {
      return res.status(400).json({ message: 'Either atd_id or asset_type_id is required' });
    }
    
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

// Update asset type document archive status
const updateDocArchiveStatus = async (req, res) => {
  try {
    const { atd_id } = req.params;
    const { is_archived } = req.body;
    
    if (typeof is_archived !== 'boolean') {
      return res.status(400).json({ message: 'is_archived must be a boolean value' });
    }

    // Get the current document details
    const currentDoc = await getAssetTypeDocById(atd_id);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: 'Asset type document not found' });
    }

    const doc = currentDoc.rows[0];
    let newDocPath = doc.doc_path;
    let archivedPath = null;

    if (is_archived) {
      // Moving to archived folder
      // doc.doc_path format: org_id/asset-types/asset_type_id/filename (without bucket name)
      const pathParts = doc.doc_path.split('/');
      const bucketName = MINIO_BUCKET; // Use the constant since doc_path doesn't include bucket
      const fileName = pathParts[pathParts.length - 1];
      const assetTypeId = pathParts[pathParts.length - 2];
      const orgId = pathParts[0]; // org_id is at index 0 since no bucket name
      
      // Extract object key from doc_path (doc_path already doesn't have bucket name)
      const objectKey = doc.doc_path;
      
      // Create new path: org_id/asset-types/Archived Asset Type Document/asset_type_id/filename
      const newObjectName = `${orgId}/asset-types/Archived Asset Type Document/${assetTypeId}/${fileName}`;
      
      try {
        // Copy file to archived location
        await minioClient.copyObject(bucketName, newObjectName, objectKey);
        
        // Delete file from original location
        await minioClient.removeObject(bucketName, objectKey);
        
        // Update paths - keep doc_path unchanged, update archived_path
        newDocPath = doc.doc_path; // Keep original path unchanged
        archivedPath = newObjectName; // Store the new archived location
      } catch (minioErr) {
        console.error('MinIO operation failed:', minioErr);
        return res.status(500).json({ message: 'Failed to move file to archived location', error: minioErr.message });
      }
    } else {
      // Moving back from archived folder
      if (doc.archived_path) {
        // doc.doc_path format: org_id/asset-types/Archived Asset Type Document/asset_type_id/filename (without bucket name)
        const pathParts = doc.doc_path.split('/');
        const bucketName = MINIO_BUCKET; // Use the constant since doc_path doesn't include bucket
        const fileName = pathParts[pathParts.length - 1];
        const assetTypeId = pathParts[pathParts.length - 2];
        const orgId = pathParts[0]; // org_id is at index 0 since no bucket name
        
        // Extract object key from doc_path (doc_path already doesn't have bucket name)
        const objectKey = doc.doc_path;
        
        // Create new path: org_id/asset-types/asset_type_id/filename
        const newObjectName = `${orgId}/asset-types/${assetTypeId}/${fileName}`;
        
        try {
          // Copy file back to active location
          await minioClient.copyObject(bucketName, newObjectName, objectKey);
          
          // Delete file from archived location
          await minioClient.removeObject(bucketName, objectKey);
          
          // Update paths - keep doc_path unchanged, clear archived_path
          newDocPath = doc.doc_path; // Keep original path unchanged
          archivedPath = null; // Clear archived path since we're unarchiving
        } catch (minioErr) {
          console.error('MinIO operation failed:', minioErr);
          return res.status(500).json({ message: 'Failed to move file back to active location', error: minioErr.message });
        }
      }
    }

    // Update database with new paths
    const result = await updateAssetTypeDocArchiveStatus(atd_id, is_archived, archivedPath);

    return res.json({
      message: 'Archive status updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

// Archive asset type document
const archiveDoc = async (req, res) => {
  try {
    const { atd_id } = req.params;
    const { archived_path } = req.body;

    const result = await archiveAssetTypeDoc(atd_id, archived_path);
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

// Delete asset type document
const deleteDoc = async (req, res) => {
  try {
    const { atd_id } = req.params;

    const result = await deleteAssetTypeDoc(atd_id);
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
    const { atd_id } = req.params;
    
    const result = await getAssetTypeDocById(atd_id);
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
  uploadAssetTypeDoc, 
  listDocs, 
  getDownloadUrl, 
  updateDocArchiveStatus,
  archiveDoc, 
  deleteDoc, 
  getDocById 
};
