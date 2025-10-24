const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { generateCustomId } = require('../utils/idGenerator');
const assetGroupLogger = require('../eventLoggers/assetGroupEventLogger');
const { 
  insertAssetGroupDoc, 
  listAssetGroupDocs, 
  getAssetGroupDocById, 
  listAssetGroupDocsByDto,
  checkAssetGroupExists,
  updateAssetGroupDocArchiveStatus,
  archiveAssetGroupDoc,
  deleteAssetGroupDoc
} = require('../models/assetGroupDocsModel');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload document for asset group
const uploadAssetGroupDoc = [
  upload.single('file'),
  async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
      const body = req.body || {};
      const asset_group_id = body.asset_group_id || req.params.asset_group_id;
      const { dto_id, doc_type_name } = body;
      const org_id = req.user.org_id;

      // Log API call
      assetGroupLogger.logUploadAssetGroupDocApiCalled({
        assetGroupId: asset_group_id,
        fileName: req.file?.originalname,
        fileSize: req.file?.size,
        requestData: { operation: 'upload_asset_group_doc' },
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      // Log validation step
      assetGroupLogger.logValidatingUploadData({
        assetGroupId: asset_group_id,
        fileName: req.file?.originalname,
        userId
      }).catch(err => console.error('Logging error:', err));

      if (!req.file) {
        assetGroupLogger.logMissingFile({ userId }).catch(err => console.error('Logging error:', err));
        return res.status(400).json({ message: 'File is required' });
      }

      if (!asset_group_id || !org_id) {
        assetGroupLogger.logMissingRequiredFields({
          missingFields: ['asset_group_id', 'org_id'],
          userId
        }).catch(err => console.error('Logging error:', err));
        return res.status(400).json({ message: 'asset_group_id and org_id are required' });
      }

      // Log checking asset group exists
      assetGroupLogger.logCheckingAssetGroupExists({
        assetGroupId: asset_group_id,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Check if asset group exists
      const groupExists = await checkAssetGroupExists(asset_group_id);
      if (groupExists.rows.length === 0) {
        assetGroupLogger.logAssetGroupNotFound({
          assetGroupId: asset_group_id,
          userId
        }).catch(err => console.error('Logging error:', err));
        return res.status(404).json({ message: 'Asset group not found' });
      }

      await ensureBucketExists(MINIO_BUCKET);

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/asset-groups/${asset_group_id}/${Date.now()}_${hash}${ext}`;

      // Log uploading to MinIO
      assetGroupLogger.logUploadingToMinio({
        assetGroupId: asset_group_id,
        fileName: req.file.originalname,
        objectName,
        userId
      }).catch(err => console.error('Logging error:', err));

      await minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
        'Content-Type': req.file.mimetype
      });

      // Log file uploaded to MinIO
      assetGroupLogger.logFileUploadedToMinio({
        assetGroupId: asset_group_id,
        fileName: req.file.originalname,
        objectName,
        userId
      }).catch(err => console.error('Logging error:', err));

      const doc_path = `${MINIO_BUCKET}/${objectName}`;

      // Generate unique document ID
      const agd_id = await generateCustomId('asset_group_doc', 3);
      
      // Log inserting document record
      assetGroupLogger.logInsertingDocumentRecord({
        assetGroupId: asset_group_id,
        docId: agd_id,
        userId
      }).catch(err => console.error('Logging error:', err));
      
      const dbRes = await insertAssetGroupDoc({
        agd_id,
        asset_group_id,
        dto_id: dto_id || null,
        doc_type_name: doc_type_name || null,
        doc_path,
        is_archived: false,
        archived_path: null,
        org_id
      });

      // Log document record inserted
      assetGroupLogger.logDocumentRecordInserted({
        assetGroupId: asset_group_id,
        docId: agd_id,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Log success
      assetGroupLogger.logDocumentUploaded({
        assetGroupId: asset_group_id,
        docId: agd_id,
        fileName: req.file.originalname,
        userId,
        duration: Date.now() - startTime
      }).catch(err => console.error('Logging error:', err));

      return res.status(201).json({
        message: 'Document uploaded successfully',
        document: dbRes.rows[0]
      });
    } catch (err) {
      console.error('Upload failed', err);
      
      assetGroupLogger.logDocumentUploadError({
        assetGroupId: req.body?.asset_group_id || req.params?.asset_group_id,
        error: err,
        userId
      }).catch(logErr => console.error('Logging error:', logErr));
      
      return res.status(500).json({ message: 'Upload failed', error: err.message });
    }
  }
];

// List documents for an asset group
const listDocs = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { asset_group_id } = req.params;
    const { dto_id } = req.query;

    // Log API call
    assetGroupLogger.logListDocsApiCalled({
      assetGroupId: asset_group_id,
      dtoId: dto_id,
      requestData: { operation: 'list_docs' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    // Log checking asset group exists
    assetGroupLogger.logCheckingAssetGroupExists({
      assetGroupId: asset_group_id,
      userId
    }).catch(err => console.error('Logging error:', err));

    // Check if asset group exists
    const groupExists = await checkAssetGroupExists(asset_group_id);
    if (groupExists.rows.length === 0) {
      assetGroupLogger.logAssetGroupNotFound({
        assetGroupId: asset_group_id,
        userId
      }).catch(err => console.error('Logging error:', err));
      return res.status(404).json({ message: 'Asset group not found' });
    }

    // Log querying documents
    assetGroupLogger.logQueryingDocuments({
      assetGroupId: asset_group_id,
      dtoId: dto_id,
      userId
    }).catch(err => console.error('Logging error:', err));

    let result;
    if (dto_id) {
      result = await listAssetGroupDocsByDto(asset_group_id, dto_id);
    } else {
      result = await listAssetGroupDocs(asset_group_id);
    }

    // Log success
    assetGroupLogger.logDocumentsRetrieved({
      assetGroupId: asset_group_id,
      count: result.rows.length,
      userId
    }).catch(err => console.error('Logging error:', err));

    return res.json({
      message: 'Documents retrieved successfully',
      documents: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    
    assetGroupLogger.logDocumentsRetrievalError({
      assetGroupId: req.params.asset_group_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

// Get download/view URL for asset group document
const getDownloadUrl = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { agd_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    // Log API call
    assetGroupLogger.logGetDownloadUrlApiCalled({
      docId: agd_id,
      mode,
      requestData: { operation: 'get_download_url' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    // Log generating download URL
    assetGroupLogger.logGeneratingDownloadUrl({
      docId: agd_id,
      mode,
      userId
    }).catch(err => console.error('Logging error:', err));
    
    const result = await getAssetGroupDocById(agd_id);
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
    
    // Log success
    assetGroupLogger.logDownloadUrlGenerated({
      docId: agd_id,
      mode,
      userId
    }).catch(err => console.error('Logging error:', err));
    
    return res.json({ 
      message: 'URL generated successfully',
      url,
      document: doc
    });
  } catch (err) {
    console.error('Failed to get download url', err);
    
    assetGroupLogger.logDownloadUrlError({
      docId: req.params.agd_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

// Archive asset group document
const archiveDoc = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { agd_id } = req.params;
    const { archived_path } = req.body;

    // Log API call
    assetGroupLogger.logArchiveDocApiCalled({
      docId: agd_id,
      archivedPath,
      requestData: { operation: 'archive_doc' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    // Log archiving document
    assetGroupLogger.logArchivingDocument({
      docId: agd_id,
      archivedPath,
      userId
    }).catch(err => console.error('Logging error:', err));

    const result = await archiveAssetGroupDoc(agd_id, archived_path);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success
    assetGroupLogger.logDocumentArchived({
      docId: agd_id,
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    return res.json({
      message: 'Document archived successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to archive document', err);
    
    assetGroupLogger.logDocumentArchiveError({
      docId: req.params.agd_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to archive document', error: err.message });
  }
};

// Delete asset group document
const deleteDoc = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { agd_id } = req.params;

    // Log API call
    assetGroupLogger.logDeleteDocApiCalled({
      docId: agd_id,
      requestData: { operation: 'delete_doc' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    // Log deleting document
    assetGroupLogger.logDeletingDocument({
      docId: agd_id,
      userId
    }).catch(err => console.error('Logging error:', err));

    const result = await deleteAssetGroupDoc(agd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success
    assetGroupLogger.logDocumentDeleted({
      docId: agd_id,
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    return res.json({
      message: 'Document deleted successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to delete document', err);
    
    assetGroupLogger.logDocumentDeletionError({
      docId: req.params.agd_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to delete document', error: err.message });
  }
};

// Get document details by ID
const getDocById = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { agd_id } = req.params;
    
    // Log API call
    assetGroupLogger.logGetDownloadUrlApiCalled({
      docId: agd_id,
      requestData: { operation: 'get_doc_by_id' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));
    
    const result = await getAssetGroupDocById(agd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Log success
    assetGroupLogger.logDownloadUrlGenerated({
      docId: agd_id,
      userId
    }).catch(err => console.error('Logging error:', err));

    return res.json({
      message: 'Document retrieved successfully',
      document: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to get document', err);
    
    assetGroupLogger.logDownloadUrlError({
      docId: req.params.agd_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to get document', error: err.message });
  }
};

// Update document archive status
const updateDocArchiveStatus = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    const { agd_id } = req.params;
    const { is_archived } = req.body;

    // Log API call
    assetGroupLogger.logUpdateDocArchiveStatusApiCalled({
      docId: agd_id,
      isArchived: is_archived,
      requestData: { operation: 'update_doc_archive_status' },
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    // Log validation step
    assetGroupLogger.logValidatingArchiveStatus({
      docId: agd_id,
      isArchived: is_archived,
      userId
    }).catch(err => console.error('Logging error:', err));

    if (typeof is_archived !== 'boolean') {
      assetGroupLogger.logInvalidArchiveStatus({
        isArchived: is_archived,
        userId
      }).catch(err => console.error('Logging error:', err));
      return res.status(400).json({ message: 'is_archived must be a boolean value' });
    }

    // Get current document details
    const currentDoc = await getAssetGroupDocById(agd_id);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: 'Asset group document not found' });
    }

    const doc = currentDoc.rows[0];
    let newDocPath = doc.doc_path;
    let archivedPath = null;

    if (is_archived) {
      // Log moving file to archived
      assetGroupLogger.logMovingFileToArchived({
        docId: agd_id,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Moving to archived folder
      // doc.doc_path format: org_id/asset-groups/asset_group_id/filename (without bucket name)
      const pathParts = doc.doc_path.split('/');
      const bucketName = MINIO_BUCKET; // Use the constant since doc_path doesn't include bucket
      const fileName = pathParts[pathParts.length - 1];
      const assetGroupId = pathParts[pathParts.length - 2];
      const orgId = pathParts[0]; // org_id is at index 0 since no bucket name
      
      // Extract object key from doc_path (doc_path already doesn't have bucket name)
      const objectKey = doc.doc_path;
      
      // Create new path: org_id/asset-groups/Archived Asset Group Document/asset_group_id/filename
      const newObjectName = `${orgId}/asset-groups/Archived Asset Group Document/${assetGroupId}/${fileName}`;
      
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
        
        assetGroupLogger.logMinioOperationFailed({
          docId: agd_id,
          operation: 'move_to_archived',
          error: minioErr,
          userId
        }).catch(logErr => console.error('Logging error:', logErr));
        
        return res.status(500).json({ message: 'Failed to move file to archived location', error: minioErr.message });
      }
    } else {
      // Log moving file from archived
      assetGroupLogger.logMovingFileFromArchived({
        docId: agd_id,
        userId
      }).catch(err => console.error('Logging error:', err));

      // Moving back from archived folder
      if (doc.archived_path) {
        // doc.archived_path format: org_id/asset-groups/Archived Asset Group Document/asset_group_id/filename (without bucket name)
        const pathParts = doc.archived_path.split('/');
        const bucketName = MINIO_BUCKET; // Use the constant since archived_path doesn't include bucket
        const fileName = pathParts[pathParts.length - 1];
        const assetGroupId = pathParts[pathParts.length - 2];
        const orgId = pathParts[0]; // org_id is at index 0 since no bucket name
        
        // Extract object key from archived_path (archived_path already doesn't have bucket name)
        const objectKey = doc.archived_path;
        
        // Create new path: org_id/asset-groups/asset_group_id/filename
        const newObjectName = `${orgId}/asset-groups/${assetGroupId}/${fileName}`;
        
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
          
          assetGroupLogger.logMinioOperationFailed({
            docId: agd_id,
            operation: 'move_from_archived',
            error: minioErr,
            userId
          }).catch(logErr => console.error('Logging error:', logErr));
          
          return res.status(500).json({ message: 'Failed to move file back to active location', error: minioErr.message });
        }
      }
    }

    // Update database with new paths
    const result = await updateAssetGroupDocArchiveStatus(agd_id, is_archived, archivedPath);

    // Log success
    assetGroupLogger.logArchiveStatusUpdated({
      docId: agd_id,
      isArchived: is_archived,
      userId,
      duration: Date.now() - startTime
    }).catch(err => console.error('Logging error:', err));

    return res.json({
      message: 'Archive status updated successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    
    assetGroupLogger.logArchiveStatusUpdateError({
      docId: req.params.agd_id,
      error: err,
      userId
    }).catch(logErr => console.error('Logging error:', logErr));
    
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

module.exports = { 
  uploadAssetGroupDoc, 
  listDocs, 
  getDownloadUrl, 
  archiveDoc, 
  deleteDoc, 
  getDocById,
  updateDocArchiveStatus
};
