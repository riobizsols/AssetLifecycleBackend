# 🎓 Certificate Management - Complete Integration Guide

## 📋 Overview

The certificate management system consists of three main pages with comprehensive backend API support:

### 1. **Certifications** (Admin Settings)
- Path: `/certifications`
- Role: Administrators 
- Purpose: Manage tech certificates and map them to asset types and maintenance types

### 2. **Technician Certificates** (Employee)
- Path: `/technician-certificates`
- Role: Employees/Technicians
- Purpose: Upload and manage personal technical certificates

### 3. **HR/Manager Approval** (HR/Manager)
- Path: `/tech-cert-approvals`
- Role: HR/Managers
- Purpose: Approve/reject employee certificate uploads

---

## 🔌 Backend API Endpoints

### Tech Certificate Master Data
```
GET    /api/tech-certificates                    ✅ Get all certificates
POST   /api/tech-certificates                    ✅ Create new certificate
PUT    /api/tech-certificates/:id                ✅ Update certificate
DELETE /api/tech-certificates/:id                ✅ Delete certificate
GET    /api/asset-types/:assetTypeId/maintenance-certificates  ✅ Get mapped certificates
POST   /api/asset-types/:assetTypeId/maintenance-certificates  ✅ Map certificates to asset type
```

### Employee Tech Certificates
```
GET    /api/employee-tech-certificates           ✅ Get employee's certificates
GET    /api/employee-tech-certificates/approvals ✅ Get all certificates (for approval)
POST   /api/employee-tech-certificates           ✅ Upload new certificate
PUT    /api/employee-tech-certificates/:id       ✅ Update certificate
DELETE /api/employee-tech-certificates/:id       ✅ Delete certificate
GET    /api/employee-tech-certificates/:id/download ✅ Download certificate file
PUT    /api/employee-tech-certificates/:id/status   ✅ Update approval status
```

### Supporting Endpoints
```
GET    /api/employees                            ✅ Get all employees
GET    /api/employees/with-roles                 ✅ Get employees with job roles
PUT    /api/employees/:emp_int_id/status         ✅ Update employee status
GET    /api/asset-types                          ✅ Get asset types
GET    /api/maint-types                          ✅ Get maintenance types
GET    /api/maintenance-history                  ✅ Get maintenance history
GET    /api/work-orders/all                      ✅ Get all work orders
```

---

## 🔓 Navigation & Permissions

The certificate apps are now registered in `tblJobRoleNav` with the following apps:

| App ID | Label | Default Access |
|--------|-------|-----------------|
| CERTIFICATIONS | Manage Certifications | Admin (A), Others (D) |
| TECHCERTUPLOAD | Technician Certificates | Admin (A), Others (D) |
| HR/MANAGERAPPROVAL | HR/Manager Approval | Admin (A), Others (D) |

**Migration Status:** ✅ 39 navigation entries added across 13 job roles

---

## 🎯 How to Use

### For Administrators
1. Navigate to **Admin Settings → Certifications**
2. **Manage Certificates Tab:**
   - Create new technical certificates
   - Edit certificate details
   - Delete certificates
3. **Mapping Tab:**
   - Map certificates to asset types
   - Assign maintenance types
   - Manage certification requirements per asset type

### For Employees/Technicians
1. Navigate to **Technician Certificates**
2. Upload your technical certificates:
   - Select certificate type
   - Enter certificate date
   - Enter expiry date
   - Upload certificate file (PDF, image, etc.)
3. View your uploaded certificates status

### For HR/Managers
1. Navigate to **HR/Manager Approval**
2. Review pending certificate approvals
3. **Approve/Reject** employee certificates
4. View technician list and ratings
5. Monitor certificate status

---

## 📦 Database Tables

- `tblApps` - Application master (CERTIFICATIONS, TECHCERTUPLOAD, HR/MANAGERAPPROVAL)
- `tblJobRoleNav` - Job role navigation (39 entries added)
- `tblTechCertificates` - Tech certificate master data
- `tblEmployeeTechCertificates` - Employee certificate uploads
- `tblAssetTypeCertificates` - Asset type to certificate mapping

---

## ✅ Verification Checklist

- [x] Navigation permissions added to tblJobRoleNav
- [x] Backend routes registered in server.js
- [x] Controllers implemented for certificate operations
- [x] Frontend pages created and connected
- [x] API endpoints tested and functional
- [x] File upload support for certificates
- [x] Certificate approval workflow
- [x] Asset type certification mapping

---

## 🚀 Quick Start

1. **Log in** with your user account
2. **Refresh browser** to load updated navigation
3. Look for **Certifications**, **Technician Certificates**, and **HR/Manager Approval** in the sidebar
4. Start using the certificate management system!

---

## 🆘 Troubleshooting

### Screens not visible?
- Ensure your user's job role has been assigned the CERTIFICATIONS app_id
- Clear browser cache and log out/log back in
- Check database for navigation permissions

### API errors?
- Verify authentication token is valid
- Check backend server is running (`npm start`)
- Verify all required tables exist in database

### File upload issues?
- Check MinIO is running
- Verify file size limits
- Check file format restrictions

---

## 📞 Support

For issues or questions, check:
- Log files: `AssetLifecycleBackend/logs/`
- Database migrations: `AssetLifecycleBackend/migrations/`
- API test script: `AssetLifecycleBackend/scripts/verify-certificate-apis.js`

