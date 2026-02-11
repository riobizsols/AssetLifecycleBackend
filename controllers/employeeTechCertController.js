const EmployeeTechCertModel = require("../models/employeeTechCertModel");
const { minioClient, ensureBucketExists, MINIO_BUCKET } = require('../utils/minioClient');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({ storage });

const withTimeout = (promise, ms, message) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message || 'Operation timed out');
      error.code = 'ETIMEDOUT';
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

const getEmployeeCertificates = async (req, res) => {
  try {
    const empIntId = req.query?.emp_int_id || req.user?.emp_int_id;
    const orgId = req.user?.org_id;

    if (!empIntId) {
      return res.status(400).json({
        success: false,
        message: "Employee id is required"
      });
    }

    const certificates = await EmployeeTechCertModel.getEmployeeCertificates(empIntId, orgId);

    return res.status(200).json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error("Error fetching employee certificates:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee certificates",
      error: error.message
    });
  }
};

const createEmployeeCertificate = [
  (req, res, next) => {
    if (req.is('multipart/form-data')) {
      return upload.single('file')(req, res, next);
    }
    return next();
  },
  async (req, res) => {
    try {
      const empIntId = req.body?.emp_int_id || req.user?.emp_int_id;
      const orgId = req.user?.org_id;
      const createdBy = req.user?.user_id;
      const { tc_id, certificate_date, certificate_expiry } = req.body || {};

      if (!empIntId) {
        return res.status(400).json({
          success: false,
          message: "Employee id is required"
        });
      }

      if (!tc_id) {
        return res.status(400).json({
          success: false,
          message: "Certificate is required"
        });
      }

      let filePath = null;

      if (req.file) {
        await withTimeout(ensureBucketExists(MINIO_BUCKET), 8000, 'MinIO bucket check timed out');

        const ext = path.extname(req.file.originalname);
        const hash = crypto.randomBytes(8).toString('hex');
        const objectName = `${orgId}/employee-tech-certificates/${empIntId}/${Date.now()}_${hash}${ext}`;

        await withTimeout(
          minioClient.putObject(MINIO_BUCKET, objectName, req.file.buffer, {
            'Content-Type': req.file.mimetype
          }),
          15000,
          'MinIO upload timed out'
        );

        filePath = `${MINIO_BUCKET}/${objectName}`;
      }

      const created = await EmployeeTechCertModel.createEmployeeCertificate({
        empIntId,
        tcId: tc_id,
        certificateDate: certificate_date || null,
        certificateExpiry: certificate_expiry || null,
        filePath,
        status: "Approval Pending",
        createdBy,
        orgId
      });

      return res.status(201).json({
        success: true,
        message: "Certificate uploaded successfully",
        data: created
      });
    } catch (error) {
      console.error("Error creating employee certificate:", error);
      if (error.code === 'ETIMEDOUT') {
        return res.status(504).json({
          success: false,
          message: error.message || 'Upload timed out. Please try again.'
        });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to upload employee certificate",
        error: error.message
      });
    }
  }
];

const getAllEmployeeCertificates = async (req, res) => {
  try {
    const orgId = req.user?.org_id;
    const status = req.query?.status || null;

    const certificates = await EmployeeTechCertModel.getAllEmployeeCertificates(orgId, status);

    return res.status(200).json({
      success: true,
      data: certificates
    });
  } catch (error) {
    console.error("Error fetching employee certificates for approval:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch employee certificates",
      error: error.message
    });
  }
};

const updateEmployeeCertificateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Certificate id is required"
      });
    }

    if (!status || typeof status !== "string") {
      return res.status(400).json({
        success: false,
        message: "Status is required"
      });
    }

    const allowedStatuses = ["Approval Pending", "Confirmed", "Approved", "Rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`
      });
    }

    const updated = await EmployeeTechCertModel.updateEmployeeCertificateStatus({
      id,
      status
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate status updated successfully",
      data: updated
    });
  } catch (error) {
    console.error("Error updating employee certificate status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update employee certificate status",
      error: error.message
    });
  }
};

const updateEmployeeCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const { tc_id, certificate_date, certificate_expiry } = req.body || {};

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Certificate id is required"
      });
    }

    const updated = await EmployeeTechCertModel.updateEmployeeCertificate({
      id,
      tcId: tc_id,
      certificateDate: certificate_date || null,
      certificateExpiry: certificate_expiry || null
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found or no changes"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate updated successfully",
      data: updated
    });
  } catch (error) {
    console.error("Error updating employee certificate:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update employee certificate",
      error: error.message
    });
  }
};

const deleteEmployeeCertificate = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Certificate id is required"
      });
    }

    const deleted = await EmployeeTechCertModel.deleteEmployeeCertificate({ id });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Certificate deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting employee certificate:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete employee certificate",
      error: error.message
    });
  }
};

const getEmployeeCertificateDownloadUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.user?.org_id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Certificate id is required"
      });
    }

    const cert = await EmployeeTechCertModel.getEmployeeCertificateById(id, orgId);

    if (!cert) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found"
      });
    }

    if (!cert.file_path) {
      return res.status(404).json({
        success: false,
        message: "No file uploaded for this certificate"
      });
    }

    const [bucket, ...keyParts] = cert.file_path.split('/');
    const objectName = keyParts.join('/');

    if (!bucket || !objectName) {
      return res.status(400).json({
        success: false,
        message: "Invalid file path"
      });
    }

    const url = await minioClient.presignedGetObject(bucket, objectName, 60 * 10);

    return res.status(200).json({
      success: true,
      url
    });
  } catch (error) {
    console.error("Error generating employee certificate download URL:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate download URL",
      error: error.message
    });
  }
};

module.exports = {
  getEmployeeCertificates,
  getAllEmployeeCertificates,
  createEmployeeCertificate,
  updateEmployeeCertificateStatus,
  updateEmployeeCertificate,
  deleteEmployeeCertificate,
  getEmployeeCertificateDownloadUrl
};
