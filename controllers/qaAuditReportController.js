const { getQAAuditCertificates } = require('../models/qaAuditReportModel');
const path = require('path');
const { getAssetMaintDocById } = require('../models/assetMaintDocsModel');
const { getAssetDocById } = require('../models/assetDocsModel');
const { getAssetTypeDocById } = require('../models/assetTypeDocsModel');
const PropertiesModel = require('../models/propertiesModel');
const {
  getPresignedDownloadUrl,
  getObjectStream,
  resolveLocalPath,
} = require('../utils/documentStorage');

/**
 * Resolve certificate/doc row by id + optional type hint
 */
async function resolveCertificateDocument(id, type) {
  let docResult;
  let docType;

  if (type === 'quality') {
    docResult = await getAssetDocById(id);
    if (docResult.rows.length === 0) {
      docResult = await getAssetTypeDocById(id);
      docType = 'assetType';
    } else {
      docType = 'asset';
    }
  } else if (type === 'maintenance_completion' || type === 'maintenance') {
    docResult = await getAssetMaintDocById(id);
    if (docResult.rows.length === 0) {
      docResult = await getAssetDocById(id);
      if (docResult.rows.length === 0) {
        docResult = await getAssetTypeDocById(id);
        docType = 'assetType';
      } else {
        docType = 'asset';
      }
    } else {
      docType = 'maintenance';
    }
  } else {
    docResult = await getAssetMaintDocById(id);
    if (docResult.rows.length === 0) {
      docResult = await getAssetDocById(id);
      if (docResult.rows.length === 0) {
        docResult = await getAssetTypeDocById(id);
        docType = 'assetType';
      } else {
        docType = 'asset';
      }
    } else {
      docType = 'maintenance';
    }
  }

  return { docResult, docType };
}

function guessContentType(fileName) {
  const ext = String(fileName || '').split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    csv: 'text/csv',
    txt: 'text/plain',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Get QA/Audit certificates based on filters
 * POST /qa-audit/certificates
 */
const getCertificates = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const userBranchId = req.user.branch_id;
    const hasSuperAccess = req.user.hasSuperAccess || false;

    const {
      fromDate,
      toDate,
      assets = null,
      assetTypes = null,
      advancedFilters = []
    } = req.body;

    const hasDateRange = fromDate && toDate;
    const hasAssetTypeFilter = assetTypes && Array.isArray(assetTypes) && assetTypes.length > 0;
    const hasAssetFilter = assets && Array.isArray(assets) && assets.length > 0;
    const hasAdvancedFilters = advancedFilters && Array.isArray(advancedFilters) && advancedFilters.length > 0;

    if (!hasDateRange && !hasAssetTypeFilter && !hasAssetFilter && !hasAdvancedFilters) {
      return res.status(400).json({
        success: false,
        message: 'At least one filter must be applied (Date Range, Asset Type, Assets, or Advanced Filters)'
      });
    }

    const filters = {
      fromDate,
      toDate,
      assets: hasAssetFilter ? assets : null,
      assetTypes: hasAssetTypeFilter ? assetTypes : null,
      advancedFilters: Array.isArray(advancedFilters) ? advancedFilters : []
    };

    const result = await getQAAuditCertificates(filters, orgId, userBranchId, hasSuperAccess);

    return res.json({
      success: true,
      data: {
        assets: result.assets,
        certificates: result.certificates
      },
      count: result.certificates.length
    });

  } catch (error) {
    console.error('Error in getCertificates:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Download certificate file
 * GET /qa-audit/certificates/:id/download
 *
 * Prefer a short-lived MinIO URL. If MinIO is slow/unreachable, stream bytes via API
 * so the browser still receives the file (avoids 60s front-end timeouts).
 */
const downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const mode = req.query.mode || 'download';
    const forceStream = String(req.query.stream || '').toLowerCase() === 'true';

    const { docResult } = await resolveCertificateDocument(id, type);

    if (!docResult || docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    const doc = docResult.rows[0];
    if (!doc.doc_path) {
      return res.status(404).json({ message: 'Certificate file path not found' });
    }

    if (!doc.file_name) {
      doc.file_name = path.basename(String(doc.doc_path).split('/').pop() || 'document');
    }

    const fileName = doc.file_name || 'document';
    const contentType = guessContentType(fileName);
    const disposition = mode === 'download'
      ? `attachment; filename="${fileName}"`
      : 'inline';

    // Local-upload fallback (dev when MinIO was down at upload time)
    const localPath = resolveLocalPath(doc.doc_path);
    if (localPath) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', disposition);
      return res.sendFile(localPath);
    }

    // Prefer API stream when:
    // - client requests stream=true (browser often cannot reach MINIO_END_POINT), OR
    // - MINIO_FORCE_STREAM=true (local/dev when MinIO is only reachable server-side)
    const envForceStream =
      String(process.env.MINIO_FORCE_STREAM || '').toLowerCase() === 'true';
    const shouldStream = forceStream || envForceStream;

    if (!shouldStream) {
      try {
        const respHeaders = {};
        if (mode === 'download') {
          respHeaders['response-content-disposition'] = disposition;
        } else if (mode === 'view') {
          respHeaders['response-content-disposition'] = 'inline';
        }

        const url = await getPresignedDownloadUrl(doc.doc_path, 60 * 60, respHeaders);
        if (url) {
          return res.json({
            success: true,
            url,
            fileName,
            document: doc,
          });
        }
      } catch (presignError) {
        console.warn(
          '[QA Audit Download] Presign failed, falling back to API stream:',
          presignError.message,
        );
      }
    }

    // Stream from MinIO through the API (browser never talks to MinIO directly)
    try {
      const stream = await getObjectStream(doc.doc_path);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', disposition);
      stream.on('error', (streamErr) => {
        console.error('[QA Audit Download] Stream error:', streamErr);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Failed to stream certificate file',
            error: streamErr.message,
          });
        } else {
          res.destroy(streamErr);
        }
      });
      return stream.pipe(res);
    } catch (streamError) {
      console.error('[QA Audit Download] Stream fallback failed:', streamError);
      return res.status(504).json({
        success: false,
        message:
          'Document storage unavailable from this server. MinIO at MINIO_END_POINT is not reachable. On production the API host must reach MinIO; for local use SSH tunnel or set a reachable MINIO_END_POINT.',
        error: streamError.message,
      });
    }
  } catch (error) {
    console.error('Error in downloadCertificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to download certificate',
      error: error.message
    });
  }
};

/**
 * Get properties and values for asset type (for advanced filters)
 * GET /qa-audit/filter-options/:assetTypeId
 */
const getFilterOptions = async (req, res) => {
  try {
    const { assetTypeId } = req.params;
    const orgId = req.user.org_id;

    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }

    const properties = await PropertiesModel.getPropertiesWithValues(assetTypeId, orgId);

    return res.json({
      success: true,
      data: properties
    });

  } catch (error) {
    console.error('Error in getFilterOptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch filter options',
      error: error.message
    });
  }
};

module.exports = {
  getCertificates,
  downloadCertificate,
  getFilterOptions
};
