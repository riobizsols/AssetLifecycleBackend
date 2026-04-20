const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/authMiddleware");
const employeeTechCertController = require("../controllers/employeeTechCertController");

router.use(protect);

router.get("/employee-tech-certificates", employeeTechCertController.getEmployeeCertificates);
router.get("/employee-tech-certificates/approvals", employeeTechCertController.getAllEmployeeCertificates);
router.get(
  "/employee-tech-certificates/:id/download",
  employeeTechCertController.getEmployeeCertificateDownloadUrl
);
router.post("/employee-tech-certificates", employeeTechCertController.createEmployeeCertificate);
router.put("/employee-tech-certificates/:id", employeeTechCertController.updateEmployeeCertificate);
router.put(
  "/employee-tech-certificates/:id/status",
  employeeTechCertController.updateEmployeeCertificateStatus
);
router.delete("/employee-tech-certificates/:id", employeeTechCertController.deleteEmployeeCertificate);

module.exports = router;
