const { getQAAuditCertificates } = require('../models/qaAuditReportModel');
const { minioClient } = require('../utils/minioClient');
const path = require('path');
const { getAssetMaintDocById } = require('../models/assetMaintDocsModel');
const { getAssetDocById } = require('../models/assetDocsModel');
const { getAssetTypeDocById } = require('../models/assetTypeDocsModel');
const PropertiesModel = require('../models/propertiesModel');

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

    // All filters are optional - but at least one should be provided
    const hasDateRange = fromDate && toDate;
    const hasAssetTypeFilter = assetTypes && Array.isArray(assetTypes) && assetTypes.length > 0;
    const hasAssetFilter = assets && Array.isArray(assets) && assets.length > 0;
    const hasAdvancedFilters = advancedFilters && Array.isArray(advancedFilters) && advancedFilters.length > 0;
    
    // At least one filter should be provided
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
 */
const downloadCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // 'quality' or 'maintenance_completion'
    const mode = req.query.mode || 'download'; // 'download' or 'view'

    let docResult;
    let docType;

    // Get document based on type
    if (type === 'quality') {
      // Try asset docs first
      docResult = await getAssetDocById(id);
      if (docResult.rows.length === 0) {
        // Try asset type docs
        docResult = await getAssetTypeDocById(id);
        docType = 'assetType';
      } else {
        docType = 'asset';
      }
    } else if (type === 'maintenance_completion' || type === 'maintenance') {
      // Try all possible sources since documents from tblAssetDocs can also be marked as maintenance
      docResult = await getAssetMaintDocById(id);
      if (docResult.rows.length === 0) {
        // Try asset docs (since we're returning them with type='maintenance')
        docResult = await getAssetDocById(id);
        if (docResult.rows.length === 0) {
          // Try asset type docs
          docResult = await getAssetTypeDocById(id);
          docType = 'assetType';
        } else {
          docType = 'asset';
        }
      } else {
        docType = 'maintenance';
      }
    } else {
      // Try all types
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

    if (!docResult || docResult.rows.length === 0) {
      return res.status(404).json({ message: 'Certificate not found' });
    }

    const doc = docResult.rows[0];
    if (!doc.doc_path) {
      return res.status(404).json({ message: 'Certificate file path not found' });
    }

    // Ensure file_name exists
    if (!doc.file_name) {
      doc.file_name = path.basename(doc.doc_path.split('/').pop());
    }

    // Parse bucket and object name from doc_path
    const [bucket, ...keyParts] = doc.doc_path.split('/');
    const objectName = keyParts.join('/');

    const fileName = doc.file_name || path.basename(objectName);
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    const returnContent = req.query.content === 'true'; // Check if frontend wants file content

    // For files when content is requested (CSV, TXT, XLSX, images), return the file content directly
    const supportedContentTypes = ['csv', 'txt', 'xlsx', 'xls', 'jpg', 'jpeg', 'png'];
    if (returnContent && supportedContentTypes.includes(fileExtension)) {
      try {
        // Log the path for debugging
        console.log('[QA Audit Download] Fetching content for:', {
          doc_path: doc.doc_path,
          bucket,
          objectName,
          fileName,
          fileExtension
        });
        
        // Try to get file content directly from MinIO
        let buffer;
        try {
          // First verify the file exists
          await minioClient.statObject(bucket, objectName);
          
          // Get the file content from MinIO
          const dataStream = await minioClient.getObject(bucket, objectName);
          const chunks = [];
          
          await new Promise((resolve, reject) => {
            dataStream.on('data', (chunk) => {
              chunks.push(chunk);
            });
            
            dataStream.on('end', () => {
              buffer = Buffer.concat(chunks);
              resolve();
            });
            
            dataStream.on('error', (err) => {
              console.error('Error reading file stream from MinIO:', err);
              reject(err);
            });
          });
        } catch (minioError) {
          console.error('[QA Audit Download] Error accessing MinIO directly:', minioError);
          console.error('[QA Audit Download] Details:', {
            bucket,
            objectName,
            error: minioError.message,
            code: minioError.code
          });
          
          // If direct access fails, return the presigned URL instead
          // Frontend can fetch from the URL
          const fallbackUrl = await minioClient.presignedGetObject(bucket, objectName, 60 * 60, {});
          
          return res.json({
            success: true,
            url: fallbackUrl, // Return URL for frontend to fetch
            fileName: fileName,
            document: doc,
            useUrl: true // Flag to indicate frontend should fetch from URL
          });
        }
        
        // Process the buffer based on file type
        if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png') {
          const base64 = buffer.toString('base64');
          const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64}`;
          
          return res.json({
            success: true,
            content: dataUrl,
            fileName: fileName,
            document: doc,
            contentType: 'image'
          });
        } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
          // For Excel files, return as base64 (binary files)
          const base64 = buffer.toString('base64');
          
          return res.json({
            success: true,
            content: base64,
            fileName: fileName,
            document: doc,
            contentType: 'excel',
            encoding: 'base64'
          });
        } else {
          // For CSV and TXT, return as text
          const content = buffer.toString('utf-8');
          
          return res.json({
            success: true,
            content: content,
            fileName: fileName,
            document: doc,
            contentType: 'text'
          });
        }
      } catch (error) {
        console.error('[QA Audit Download] Unexpected error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch file content',
          error: error.message,
          bucket,
          objectName
        });
      }
    }

    // Set response headers for presigned URL
    const respHeaders = {};
    if (mode === 'download') {
      respHeaders['response-content-disposition'] = `attachment; filename="${fileName}"`;
    } else if (mode === 'view') {
      respHeaders['response-content-disposition'] = 'inline';
    }

    // Generate presigned URL for MinIO - this is more reliable for file downloads
    // MinIO handles the file serving directly, preserving binary data integrity
    const url = await minioClient.presignedGetObject(bucket, objectName, 60 * 60, respHeaders);

    // Return the presigned URL - frontend will handle the download
    // This approach is better because:
    // 1. MinIO serves files directly without Express interference
    // 2. No binary encoding issues
    // 3. Better performance for large files
    // 4. Preserves file integrity
    return res.json({
      success: true,
      url,
      fileName: fileName,
      document: doc
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

    // Get properties with their values for this asset type
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

