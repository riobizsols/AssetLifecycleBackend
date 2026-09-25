const {
  uploadBuffer,
  resolveLocalPath,
} = require('../utils/documentStorage');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { generateCustomId } = require('../utils/idGenerator');
const { runWithDb, tryGetDb } = require('../utils/dbContext');
const { 
  insertAssetMaintDoc, 
  listAssetMaintDocs, 
  listAssetMaintDocsByWorkOrder,
  getAssetMaintDocById, 
  listAssetMaintDocsByDto,
  listAssetMaintDocsByWorkOrderAndDto,
  checkAssetExists,
  checkWorkOrderExists,
  updateAssetMaintDocArchiveStatus,
  archiveAssetMaintDoc,
  deleteAssetMaintDoc
} = require('../models/assetMaintDocsModel');

const { MINIO_BUCKET } = require('../utils/minioClient');
const {
  resolveObjectKey,
  formatStoredPath,
  parseAssetMaintenanceActiveKey,
  buildAssetMaintenanceActiveKey,
  buildAssetMaintenanceArchivedKey,
} = require('../utils/minioDocPath');
const { minioClient } = require('../utils/minioClient');

const storage = multer.memoryStorage();
const upload = multer({ storage });

/** Multer can break AsyncLocalStorage; re-bind tenant pool from req before handlers run. */
function withTenantDb(req, res, next) {
  if (tryGetDb()) return next();
  const pool = req.db || req.tenantPool;
  if (!pool) {
    return res.status(503).json({
      message: 'Tenant database context is required',
      error: 'TENANT_DB_CONTEXT_REQUIRED',
    });
  }
  return runWithDb(pool, () => next());
}

function getRequestOrgId(req) {
  try {
    const { getEffectiveListContext } = require('../utils/acmAccess');
    const context = getEffectiveListContext(req);
    return context.orgId || req.user?.org_id || null;
  } catch {
    return req.user?.org_id || null;
  }
}

// Upload document for asset maintenance
const uploadAssetMaintDoc = [
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return next(err);
      return withTenantDb(req, res, next);
    });
  },
  async (req, res) => {
    try {
      const body = req.body || {};
      const asset_id = body.asset_id || req.params.asset_id;
      const { dto_id, doc_type_name } = body;
      const org_id = getRequestOrgId(req);

      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }

      if (!asset_id || !org_id) {
        return res.status(400).json({ message: 'asset_id and org_id are required' });
      }

      // Check if asset exists
      const assetExists = await checkAssetExists(asset_id);
      if (assetExists.rows.length === 0) {
        return res.status(404).json({ message: 'Asset not found' });
      }

      const ext = path.extname(req.file.originalname);
      const hash = crypto.randomBytes(8).toString('hex');
      const objectName = `${org_id}/asset-maintenance/${asset_id}/${Date.now()}_${hash}${ext}`;

      const doc_path = await uploadBuffer({
        buffer: req.file.buffer,
        objectName,
        contentType: req.file.mimetype || 'application/octet-stream',
        bucket: MINIO_BUCKET,
      });

      if (!doc_path) {
        return res.status(500).json({ message: 'Upload failed', error: 'Storage returned empty path' });
      }

      // Generate unique document ID
      const amd_id = await generateCustomId('asset_maint_doc', 3);
      
      const dbRes = await insertAssetMaintDoc({
        amd_id,
        asset_id,
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

// List documents for an asset
const listDocsByAsset = async (req, res) => {
  try {
    const { asset_id } = req.params;
    const { dto_id } = req.query;

    // Check if asset exists
    const assetExists = await checkAssetExists(asset_id);
    if (assetExists.rows.length === 0) {
      return res.status(404).json({ message: 'Asset not found' });
    }

    let result;
    if (dto_id) {
      result = await listAssetMaintDocsByDto(asset_id, dto_id);
    } else {
      result = await listAssetMaintDocs(asset_id);
    }

    return res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

// List documents for a work order
const listDocsByWorkOrder = async (req, res) => {
  try {
    const { ams_id } = req.params;
    const { dto_id } = req.query;

    // Check if work order exists
    const workOrderExists = await checkWorkOrderExists(ams_id);
    if (workOrderExists.rows.length === 0) {
      return res.status(404).json({ message: 'Work order not found' });
    }

    let result;
    if (dto_id) {
      result = await listAssetMaintDocsByWorkOrderAndDto(ams_id, dto_id);
    } else {
      result = await listAssetMaintDocsByWorkOrder(ams_id);
    }

    return res.json({
      success: true,
      message: 'Documents retrieved successfully',
      data: result.rows
    });
  } catch (err) {
    console.error('Failed to list docs', err);
    return res.status(500).json({ message: 'Failed to list docs', error: err.message });
  }
};

// Get download/view URL for asset maintenance document
const getDownloadUrl = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    
    const result = await getAssetMaintDocById(amd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = result.rows[0];
    const storedPath = doc.is_archived && doc.archived_path ? doc.archived_path : doc.doc_path;
    if (!storedPath) {
      return res.status(404).json({ message: 'Document path not found' });
    }

    // Always proxy through API so browsers never hit Docker-only MinIO DNS (mansoor-minio).
    return res.json({
      message: 'Proxy file ready',
      local: true,
      proxy: true,
      url: `/api/asset-maint-docs/${encodeURIComponent(amd_id)}/file?mode=${mode}`,
      document: doc,
    });
  } catch (err) {
    console.error('Failed to get download url', err);
    return res.status(500).json({ message: 'Failed to get download url', error: err.message });
  }
};

// Stream document file with auth — works for local fallback and MinIO (avoids browser DNS to mansoor-minio)
const streamAssetMaintDocFile = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const mode = (req.query && req.query.mode) ? String(req.query.mode).toLowerCase() : 'view';
    const result = await getAssetMaintDocById(amd_id);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const doc = result.rows[0];
    const storedPath = doc.is_archived && doc.archived_path ? doc.archived_path : doc.doc_path;
    if (!storedPath) {
      return res.status(404).json({ message: 'Document path not found' });
    }

    const filename = path.basename(String(storedPath).split('?')[0]) || 'document';
    const ext = path.extname(filename).toLowerCase();
    const mimeByExt = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
    };
    if (mimeByExt[ext]) {
      res.setHeader('Content-Type', mimeByExt[ext]);
    }
    if (mode === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    }

    const localPath = resolveLocalPath(storedPath);
    if (localPath) {
      if (!fs.existsSync(localPath)) {
        return res.status(404).json({ message: 'Local document file not found' });
      }
      if (mode === 'download') {
        return res.download(localPath, filename);
      }
      return res.sendFile(path.resolve(localPath));
    }

    const { getObjectStream } = require('../utils/documentStorage');
    const stream = await getObjectStream(storedPath);
    stream.on('error', (err) => {
      console.error('Document stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to stream document', error: err.message });
      } else {
        res.end();
      }
    });
    return stream.pipe(res);
  } catch (err) {
    console.error('Failed to stream document file', err);
    return res.status(500).json({ message: 'Failed to stream document', error: err.message });
  }
};

// Archive asset maintenance document
const archiveDoc = async (req, res) => {
  try {
    const { amd_id } = req.params;
    const { archived_path } = req.body;

    const result = await archiveAssetMaintDoc(amd_id, archived_path);
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

// Delete asset maintenance document
const deleteDoc = async (req, res) => {
  try {
    const { amd_id } = req.params;

    const result = await deleteAssetMaintDoc(amd_id);
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
    const { amd_id } = req.params;
    
    const result = await getAssetMaintDocById(amd_id);
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
  try {
    const { amd_id } = req.params;
    const { is_archived } = req.body;

    if (typeof is_archived !== 'boolean') {
      return res.status(400).json({ message: 'is_archived must be a boolean value' });
    }

    const currentDoc = await getAssetMaintDocById(amd_id);
    if (currentDoc.rows.length === 0) {
      return res.status(404).json({ message: 'Asset maintenance document not found' });
    }

    const doc = currentDoc.rows[0];
    const activeMeta = parseAssetMaintenanceActiveKey(resolveObjectKey(doc.doc_path, MINIO_BUCKET));
    const orgId = doc.org_id || activeMeta.orgId;
    const assetId = doc.asset_id || activeMeta.assetId;
    const fileName = activeMeta.fileName
      || String(doc.doc_path || '').split('/').filter(Boolean).pop()
      || '';

    if (!orgId || !assetId || !fileName) {
      return res.status(400).json({ message: 'Unable to resolve document path metadata for archive operation' });
    }

    let archivedPath = null;

    if (is_archived) {
      const sourceKey = resolveObjectKey(doc.doc_path, MINIO_BUCKET);
      const archivedObjectKey = buildAssetMaintenanceArchivedKey(orgId, assetId, fileName);

      try {
        await minioClient.copyObject(MINIO_BUCKET, archivedObjectKey, `/${MINIO_BUCKET}/${sourceKey}`);
        await minioClient.removeObject(MINIO_BUCKET, sourceKey);
        archivedPath = formatStoredPath(archivedObjectKey, MINIO_BUCKET);
      } catch (minioErr) {
        console.error('MinIO archive operation failed:', minioErr);
        return res.status(500).json({ message: 'Failed to move file to archived location', error: minioErr.message });
      }
    } else if (doc.archived_path) {
      const archivedObjectKey = resolveObjectKey(doc.archived_path, MINIO_BUCKET);
      const activeObjectKey = buildAssetMaintenanceActiveKey(orgId, assetId, fileName);
      const sourceCandidates = [
        archivedObjectKey,
        buildAssetMaintenanceArchivedKey(orgId, assetId, fileName),
      ].filter((key, index, arr) => key && arr.indexOf(key) === index);

      let restored = false;
      let lastError = null;

      for (const sourceKey of sourceCandidates) {
        try {
          await minioClient.copyObject(MINIO_BUCKET, activeObjectKey, `/${MINIO_BUCKET}/${sourceKey}`);
          await minioClient.removeObject(MINIO_BUCKET, sourceKey);
          restored = true;
          break;
        } catch (minioErr) {
          lastError = minioErr;
          console.warn(`MinIO unarchive attempt failed for key ${sourceKey}:`, minioErr.message);
        }
      }

      if (!restored) {
        console.error('MinIO unarchive operation failed:', lastError);
        return res.status(500).json({
          message: 'Failed to move file back to active location',
          error: lastError?.message || 'Unknown MinIO error',
        });
      }

      archivedPath = null;
    }

    const result = await updateAssetMaintDocArchiveStatus(amd_id, is_archived, archivedPath);

    return res.json({
      message: 'Archive status updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Failed to update archive status', err);
    return res.status(500).json({ message: 'Failed to update archive status', error: err.message });
  }
};

module.exports = { 
  uploadAssetMaintDoc, 
  listDocsByAsset,
  listDocsByWorkOrder,
  getDownloadUrl,
  streamAssetMaintDocFile,
  archiveDoc,
  deleteDoc,
  getDocById,
  updateDocArchiveStatus
};
