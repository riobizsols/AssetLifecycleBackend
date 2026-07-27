const { getQAAuditCertificates } = require('../models/qaAuditReportModel');
const path = require('path');
const axios = require('axios');
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
 * When local MinIO is unreachable (common on developer machines), proxy the
 * file bytes through a reachable remote API that can access MinIO server-side.
 */
async function proxyCertificateDownloadFromRemote(req, res, { id, type, mode, fileName, contentType, disposition }) {
  const remoteBase = String(
    process.env.REMOTE_FILE_API_BASE_URL || process.env.API_BASE_URL || '',
  ).replace(/\/$/, '');

  if (!remoteBase || /localhost|127\.0\.0\.1/i.test(remoteBase)) {
    return false;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return false;
  }

  const url = `${remoteBase}/qa-audit/certificates/${encodeURIComponent(id)}/download`;
  console.warn(`[QA Audit Download] Local MinIO unreachable — proxying via ${remoteBase}`);

  const remoteResp = await axios.get(url, {
    params: {
      type: type || 'maintenance',
      mode: mode || 'download',
      stream: 'true',
    },
    headers: {
      Authorization: authHeader,
      Accept: '*/*',
    },
    responseType: 'arraybuffer',
    timeout: Number(process.env.REMOTE_FILE_PROXY_TIMEOUT_MS || 120000),
    validateStatus: () => true,
    maxRedirects: 5,
  });

  const remoteContentType = String(remoteResp.headers['content-type'] || '');

  // Remote returned JSON (presigned URL or error) — try to fetch the URL server-side
  // only if it is not a bare MinIO IP the local network cannot reach; prefer error.
  if (remoteContentType.includes('application/json')) {
    let payload = {};
    try {
      payload = JSON.parse(Buffer.from(remoteResp.data).toString('utf8'));
    } catch {
      payload = {};
    }

    if (payload?.url && !/103\.27\.234\.248|:9000\b/i.test(payload.url)) {
      const fileResp = await axios.get(payload.url, {
        responseType: 'arraybuffer',
        timeout: Number(process.env.REMOTE_FILE_PROXY_TIMEOUT_MS || 120000),
      });
      res.setHeader('Content-Type', fileResp.headers['content-type'] || contentType);
      res.setHeader('Content-Disposition', disposition);
      res.send(Buffer.from(fileResp.data));
      return true;
    }

    console.error('[QA Audit Download] Remote proxy returned JSON without usable file URL:', payload?.message || payload);
    return false;
  }

  if (remoteResp.status >= 400 || !remoteResp.data || !remoteResp.data.byteLength) {
    console.error(
      '[QA Audit Download] Remote proxy failed:',
      remoteResp.status,
      remoteContentType,
    );
    return false;
  }

  res.setHeader('Content-Type', remoteContentType || contentType);
  res.setHeader(
    'Content-Disposition',
    remoteResp.headers['content-disposition'] || disposition,
  );
  res.status(200).send(Buffer.from(remoteResp.data));
  return true;
}
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

    // Always prefer API stream: browsers (and many local networks) cannot reach
    // MINIO_END_POINT:9000 — returning a presigned URL causes ERR_CONNECTION_TIMED_OUT.
    // Set MINIO_ALLOW_PRESIGN=true only when clients can open MinIO URLs directly.
    const allowPresign =
      String(process.env.MINIO_ALLOW_PRESIGN || '').toLowerCase() === 'true';
    const envForceStream =
      String(process.env.MINIO_FORCE_STREAM || '').toLowerCase() === 'true';
    const shouldStream = forceStream || envForceStream || !allowPresign;

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

    // Stream from MinIO through the API (browser never talks to MinIO directly).
    // Skip local MinIO when known-unreachable (avoids 10s timeout on every download).
    const skipLocalMinio =
      String(process.env.MINIO_SKIP_LOCAL || '').toLowerCase() === 'true';

    if (!skipLocalMinio) {
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
      }
    } else {
      console.warn('[QA Audit Download] MINIO_SKIP_LOCAL=true — using remote file proxy');
    }

    try {
      const proxied = await proxyCertificateDownloadFromRemote(req, res, {
        id,
        type,
        mode,
        fileName,
        contentType,
        disposition,
      });
      if (proxied) {
        return undefined;
      }
    } catch (proxyError) {
      console.error('[QA Audit Download] Remote file proxy failed:', proxyError.message);
    }

    return res.status(504).json({
      success: false,
      message:
        'Document storage (MinIO) is not reachable from this API server. Downloads are proxied via API_BASE_URL when possible — check that remote API can access MinIO, or open an SSH tunnel to MinIO for local use.',
      error: 'MinIO unreachable and remote file proxy failed',
    });
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
