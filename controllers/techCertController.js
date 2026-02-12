const TechCertModel = require('../models/techCertModel');

const getAllCertificates = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const certificates = await TechCertModel.getAllCertificates(orgId);

    return res.status(200).json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error('Error fetching certificates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch certificates',
      error: error.message
    });
  }
};

const createCertificate = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const createdBy = req.user.user_id;
    const { cert_name, cert_number } = req.body;

    if (!cert_name || !cert_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Certificate name is required'
      });
    }

    if (!cert_number || !cert_number.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Certificate number is required'
      });
    }

    const certificate = await TechCertModel.createCertificate({
      name: cert_name.trim(),
      number: cert_number.trim(),
      orgId,
      createdBy
    });

    return res.status(201).json({
      success: true,
      message: 'Certificate created successfully',
      data: certificate
    });
  } catch (error) {
    console.error('Error creating certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create certificate',
      error: error.message
    });
  }
};

const updateCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { cert_name, cert_number } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required'
      });
    }

    if (!cert_name || !cert_name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Certificate name is required'
      });
    }

    if (!cert_number || !cert_number.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Certificate number is required'
      });
    }

    const updated = await TechCertModel.updateCertificate({
      id,
      name: cert_name.trim(),
      number: cert_number.trim()
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Certificate updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update certificate',
      error: error.message
    });
  }
};

const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required'
      });
    }

    const deleted = await TechCertModel.deleteCertificate(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Certificate deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete certificate',
      error: error.message
    });
  }
};

const getMappedCertificates = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const { assetTypeId } = req.params;

    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }

    const mapped = await TechCertModel.getMappedCertificates(assetTypeId, orgId);

    return res.status(200).json({
      success: true,
      data: mapped
    });
  } catch (error) {
    console.error('Error fetching mapped certificates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch mapped certificates',
      error: error.message
    });
  }
};

const saveMappedCertificates = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const createdBy = req.user.user_id;
    const { assetTypeId } = req.params;
    const { certificate_ids = [], maint_type_id } = req.body;

    if (!assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Asset type ID is required'
      });
    }

    if (!Array.isArray(certificate_ids)) {
      return res.status(400).json({
        success: false,
        message: 'certificate_ids must be an array'
      });
    }

    if (!maint_type_id) {
      return res.status(400).json({
        success: false,
        message: 'maint_type_id is required'
      });
    }

    await TechCertModel.replaceAssetTypeCertificates(assetTypeId, certificate_ids, orgId, createdBy, maint_type_id);

    const refreshed = await TechCertModel.getMappedCertificates(assetTypeId, orgId);

    return res.status(200).json({
      success: true,
      message: 'Certificates mapped successfully',
      data: refreshed
    });
  } catch (error) {
    console.error('Error mapping certificates:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to map certificates',
      error: error.message
    });
  }
};

module.exports = {
  getAllCertificates,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  getMappedCertificates,
  saveMappedCertificates
};
