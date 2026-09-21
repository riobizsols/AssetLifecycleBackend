const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { insertAssetDoc, listAssetDocs, getAssetDocById, updateAssetDocArchiveStatus } = require('../models/assetDocsModel');
const { generateCustomId } = require('../utils/idGenerator');
const {
  uploadBuffer,
  getPresignedDownloadUrl,
  getObjectStream,
  resolveLocalPath,
  LOCAL_PREFIX,
} = require('../utils/documentStorage');
const { 
    logDocumentUploadApiCalled,
    logUploadingToMinIO,
    logFileUploadedToMinIO,
    logInsertingDocumentMetadata,
    logDocumentUploaded,
    logDocumentUploadError
} = require('../eventLoggers/assetEventLogger');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadAssetDoc = [
  upload.single('file'),
  async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const body = req.body || {};
      const asset_id = body.asset_id || req.params.asset_id;
      const { dto_id, doc_type_name } = body;
      const org_id = body.org_id || req.user?.org_id || req.user?.tenant_org_id;
      
      // Step 1: Log upload API called
      if (req.file) {
        await logDocumentUploadApiCalled({
          assetId: asset_id,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          userId
        });
      }
      
      if (!req.file) return res.status(400).json({ message: 'file is required' });
      if (!asset_id) return res.status(400).json({ message: 'asset_id is required' });
      if (!org_id) return res.status(400).json({ message: 'org_id is required' });

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/ASSET DOCUMENT/${asset_id}/${Date.now()}_${hash}${ext}`;

      // Step 2: Log uploading to MinIO
      await logUploadingToMinIO({
        assetId: asset_id,
        fileName: req.file.originalname,
        objectName,
        userId
      });

      const doc_path = await uploadBuffer({
        buffer: req.file.buffer,
        objectName,
        contentType: req.file.mimetype,
      });

      // Step 3: Log file uploaded to MinIO
      await logFileUploadedToMinIO({
        assetId: asset_id,
        fileName: req.file.originalname,
        objectName,
        fileSize: req.file.size,
        userId
      });

      const a_d_id = await generateCustomId('asset_doc', 3);
      
      // Step 4: Log inserting document metadata
      await logInsertingDocumentMetadata({
        documentId: a_d_id,
        assetId: asset_id,
        docTypeName: doc_type_name,
        docPath: doc_path,
        userId
      });
      
      const dbRes = await insertAssetDoc({
        a_d_id,
        asset_id,
        dto_id: dto_id || null,
        doc_type_name: doc_type_name || null,
        doc_path,
        is_archived: false,
        archived_path: null,
        org_id
      });

      // Step 5: Log document uploaded successfully
      await logDocumentUploaded({
        documentId: a_d_id,
        assetId: asset_id,
        fileName: req.file.originalname,
        docTypeName: doc_type_name,
        userId,
        duration: Date.now() - startTime
      });

      return res.status(201).json(dbRes.rows[0]);
    } catch (err) {
      console.error('Upload failed', err);
      
      // Log document upload error
      await logDocumentUploadError({
        assetId: req.body.asset_id || req.params.asset_id,
        fileName: req.file?.originalname || 'unknown',
        error: err,
        userId,
        duration: Date.now() - startTime
      });
      
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

const listDocs = async (req, res) => {
  try {
    const { asset_id } = req.params;
    const result = await listAssetDocs(asset_id);
    return res.json(result.rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

const getDownloadUrl = async (req, res) => {
  try {
    const { a_d_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    const result = await getAssetDocById(a_d_id);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const doc = result.rows[0];
    const fileName = path.basename(doc.doc_path || 'document');

    // Local fallback uploads: client must fetch via authenticated /file stream.
    if (doc.doc_path?.startsWith(`${LOCAL_PREFIX}/`) || resolveLocalPath(doc.doc_path)) {
      return res.json({
        stream: true,
        fileName,
        path: `/asset-docs/${a_d_id}/file?mode=${mode}`,
      });
    }

    const respHeaders = {};
    if (mode === 'download') {
      respHeaders['response-content-disposition'] = `attachment; filename="${fileName}"`;
    } else if (mode === 'view') {
      respHeaders['response-content-disposition'] = 'inline';
    }

    try {
      const url = await getPresignedDownloadUrl(doc.doc_path, 60 * 60, respHeaders);
      if (url) return res.json({ url, fileName });
    } catch (presignErr) {
      console.warn('[AssetDocs] Presign failed, using API stream:', presignErr.message);
    }

    // Browser cannot reach MinIO — tell client to stream through API.
    return res.json({
      stream: true,
      fileName,
      path: `/asset-docs/${a_d_id}/file?mode=${mode}`,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

const streamAssetDocFile = async (req, res) => {
  try {
    const { a_d_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    const result = await getAssetDocById(a_d_id);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });

    const doc = result.rows[0];
    if (!doc.doc_path) return res.status(404).json({ message: 'No file path' });

    const fileName = path.basename(doc.doc_path);
    const disposition =
      mode === 'download'
        ? `attachment; filename="${fileName}"`
        : 'inline';

    const localPath = resolveLocalPath(doc.doc_path);
    if (localPath) {
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ message: 'Document file is missing in storage' });
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', disposition);
      return res.sendFile(localPath);
    }

    const stream = await getObjectStream(doc.doc_path);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', disposition);
    stream.on('error', (streamErr) => {
      console.error('[AssetDocs] Stream error:', streamErr);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to stream document', error: streamErr.message });
      }
    });
    return stream.pipe(res);
  } catch (err) {
    console.error('[AssetDocs] streamAssetDocFile:', err);
    return res.status(500).json({
      message: 'Failed to stream document',
      error: err.message,
    });
  }
};

const updateDocArchiveStatus = async (req, res) => {
  try {
    const { a_d_id } = req.params;
    const { is_archived } = req.body;
    
    if (typeof is_archived !== 'boolean') {
      return res.status(400).json({ message: 'is_archived must be a boolean value' });
    }

    // Get the current document details
    const currentDoc = await getAssetDocById(a_d_id);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: 'Asset document not found' });
    }

    const doc = currentDoc.rows[0];
    let newDocPath = doc.doc_path;
    let archivedPath = null;

    if (is_archived) {
      // Moving to archived folder
      // doc.doc_path format: org_id/ASSET DOCUMENT/asset_id/filename (without bucket name)
      const pathParts = doc.doc_path.split('/');
      const bucketName = MINIO_BUCKET; // Use the constant since doc_path doesn't include bucket
      const fileName = pathParts[pathParts.length - 1];
      const assetId = pathParts[pathParts.length - 2];
      const orgId = pathParts[0]; // org_id is at index 0 since no bucket name
      
      // Extract object key from doc_path (doc_path already doesn't have bucket name)
      const objectKey = doc.doc_path;
      
      // Create new path: org_id/ASSET DOCUMENT/Archived Asset Document/asset_id/filename
      const newObjectName = `${orgId}/ASSET DOCUMENT/Archived Asset Document/${assetId}/${fileName}`;
      
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
        const pathParts = doc.archived_path.split('/');
        const bucketName = MINIO_BUCKET;
        const fileName = pathParts[pathParts.length - 1];
        const assetId = pathParts[pathParts.length - 2];
        const orgId = doc.org_id || pathParts[0];

        const objectKey = doc.archived_path.startsWith(`${bucketName}/`)
          ? doc.archived_path.slice(bucketName.length + 1)
          : doc.archived_path;

        const newObjectName = `${orgId}/ASSET DOCUMENT/${assetId}/${fileName}`;
        
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
    const result = await updateAssetDocArchiveStatus(a_d_id, is_archived, archivedPath);

    return res.json({
      message: 'Archive status updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

module.exports = {
  uploadAssetDoc,
  listDocs,
  getDownloadUrl,
  streamAssetDocFile,
  updateDocArchiveStatus,
};


