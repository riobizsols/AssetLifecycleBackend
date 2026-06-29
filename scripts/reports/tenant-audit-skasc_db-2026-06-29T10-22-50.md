# Tenant Database Audit Report

| Field | Value |
|-------|-------|
| Generated | 2026-06-29T10:22:50.577Z |
| Reference DB | hospitality |
| Tenant DB | skasc_db |
| Schema match | ✅ Yes |
| Tables (base) | hospitality 98 / tenant 98 |
| Missing tables in tenant | 0 |
| Extra tables in tenant | 0 |
| Column mismatches | 0 tables |

## Row counts (all shared base tables)

| Table | Hospitality rows | Tenant rows | Status |
|-------|------------------:|------------:|--------|
| tblAATInspCheckList | 6 | 0 | EMPTY (hosp has data) |
| tblAAT_Insp_Freq | 5 | 0 | EMPTY (hosp has data) |
| tblAAT_Insp_Rec | 2 | 0 | EMPTY (hosp has data) |
| tblAAT_Insp_Sch | 14 | 0 | EMPTY (hosp has data) |
| tblATBRReasonCodes | 34 | 0 | EMPTY (hosp has data) |
| tblATDocs | 7 | 0 | EMPTY (hosp has data) |
| tblATInspCert | 5 | 0 | EMPTY (hosp has data) |
| tblATMaintCert | 15 | 0 | EMPTY (hosp has data) |
| tblATMaintCheckList | 10 | 0 | EMPTY (hosp has data) |
| tblATMaintFreq | 30 | 0 | EMPTY (hosp has data) |
| tblApps | 82 | 82 | OK |
| tblAssetAssignments | 154 | 0 | EMPTY (hosp has data) |
| tblAssetBRDet | 7 | 0 | EMPTY (hosp has data) |
| tblAssetDepHist | 21 | 0 | EMPTY (hosp has data) |
| tblAssetDocs | 27 | 0 | EMPTY (hosp has data) |
| tblAssetExpiryNotify | 444 | 0 | EMPTY (hosp has data) |
| tblAssetGroupDocs | 0 | 0 | OK |
| tblAssetGroup_D | 13 | 0 | EMPTY (hosp has data) |
| tblAssetGroup_H | 6 | 0 | EMPTY (hosp has data) |
| tblAssetMaintDocs | 12 | 0 | EMPTY (hosp has data) |
| tblAssetMaintSch | 19 | 0 | EMPTY (hosp has data) |
| tblAssetMaintSch_BR_Hist | 0 | 0 | OK |
| tblAssetPropListValues | 93 | 0 | EMPTY (hosp has data) |
| tblAssetPropValues | 96 | 0 | EMPTY (hosp has data) |
| tblAssetScrap | 3 | 0 | EMPTY (hosp has data) |
| tblAssetScrapDet | 3 | 0 | EMPTY (hosp has data) |
| tblAssetTypeProps | 62 | 0 | EMPTY (hosp has data) |
| tblAssetTypes | 41 | 1 | OK |
| tblAssetUsageReg | 5 | 0 | EMPTY (hosp has data) |
| tblAssetWarrantyNotify | 181 | 0 | EMPTY (hosp has data) |
| tblAssets | 115 | 1 | OK |
| tblAuditLogConfig | 60 | 60 | OK |
| tblAuditLogs | 1000 | 35 | OK |
| tblBranchCostCenter | 0 | 0 | OK |
| tblBranches | 3 | 1 | OK |
| tblCCTransfer | 0 | 0 | OK |
| tblColumnAccessConfig | 0 | 0 | OK |
| tblCostCenter | 0 | 0 | OK |
| tblDepartments | 12 | 1 | OK |
| tblDepreciationSettings | 2 | 0 | EMPTY (hosp has data) |
| tblDeptAdmins | 13 | 0 | EMPTY (hosp has data) |
| tblDeptAssetTypes | 22 | 0 | EMPTY (hosp has data) |
| tblDocTypeObjects | 18 | 0 | EMPTY (hosp has data) |
| tblEmpTechCert | 9 | 0 | EMPTY (hosp has data) |
| tblEmployees | 37 | 4 | OK |
| tblEvents | 15 | 15 | OK |
| tblFCMTokens | 17 | 0 | EMPTY (hosp has data) |
| tblIDSequences | 55 | 57 | OK |
| tblInspCheckList | 7 | 0 | EMPTY (hosp has data) |
| tblInspResTypeDet | 9 | 0 | EMPTY (hosp has data) |
| tblJobHistory | 17 | 0 | EMPTY (hosp has data) |
| tblJobRoleNav | 278 | 102 | OK |
| tblJobRoles | 13 | 4 | OK |
| tblJobs | 7 | 7 | OK |
| tblMaintStatus | 5 | 5 | OK |
| tblMaintTypes | 5 | 16 | OK |
| tblNotificationHistory | 2938 | 0 | EMPTY (hosp has data) |
| tblNotificationPreferences | 100 | 0 | EMPTY (hosp has data) |
| tblOrgSettings | 8 | 14 | OK |
| tblOrgs | 3 | 1 | OK |
| tblPrintSerialNoQueue | 68 | 1 | OK |
| tblProdServs | 27 | 2 | OK |
| tblProps | 32 | 32 | OK |
| tblRioAdmin | 0 | 0 | OK |
| tblScrapAssetHist | 14 | 0 | EMPTY (hosp has data) |
| tblScrapSalesDocs | 0 | 0 | OK |
| tblScrapSales_D | 1 | 0 | EMPTY (hosp has data) |
| tblScrapSales_H | 1 | 0 | EMPTY (hosp has data) |
| tblStatusCodes | 13 | 13 | OK |
| tblTableFilterColumns | 10 | 10 | OK |
| tblTechCert | 10 | 0 | EMPTY (hosp has data) |
| tblTechnicalLogConfig | 33 | 33 | OK |
| tblTextMessagesDefault | 264 | 264 | OK |
| tblTextMessagesOtherLangs | 264 | 264 | OK |
| tblUom | 5 | 5 | OK |
| tblUserJobRoles | 39 | 4 | OK |
| tblUsers | 34 | 4 | OK |
| tblVendorDocs | 4 | 0 | EMPTY (hosp has data) |
| tblVendorProdService | 29 | 3 | OK |
| tblVendorRenewal | 0 | 0 | OK |
| tblVendorSLAs | 3 | 0 | EMPTY (hosp has data) |
| tblVendors | 22 | 2 | OK |
| tblWFAATInspHist | 46 | 0 | EMPTY (hosp has data) |
| tblWFAATInspSch_D | 28 | 0 | EMPTY (hosp has data) |
| tblWFAATInspSch_H | 15 | 0 | EMPTY (hosp has data) |
| tblWFATInspSeqs | 5 | 0 | EMPTY (hosp has data) |
| tblWFATSeqs | 59 | 0 | EMPTY (hosp has data) |
| tblWFAssetMaintHist | 38 | 0 | EMPTY (hosp has data) |
| tblWFAssetMaintSch_D | 374 | 0 | EMPTY (hosp has data) |
| tblWFAssetMaintSch_H | 154 | 0 | EMPTY (hosp has data) |
| tblWFInspJobRole | 2 | 0 | EMPTY (hosp has data) |
| tblWFInspSteps | 7 | 0 | EMPTY (hosp has data) |
| tblWFJobRole | 6 | 0 | EMPTY (hosp has data) |
| tblWFScrapSeq | 44 | 0 | EMPTY (hosp has data) |
| tblWFScrap_D | 14 | 0 | EMPTY (hosp has data) |
| tblWFScrap_H | 14 | 0 | EMPTY (hosp has data) |
| tblWFSteps | 6 | 0 | EMPTY (hosp has data) |
| tblsla_desc | 0 | 0 | OK |

## ID format validation (tenant)

| Table | Column | Rows | Invalid | Null IDs | Status |
|-------|--------|-----:|--------:|---------:|--------|
| tblOrgs | org_id | 1 | 0 | 0 | OK |
| tblUsers | user_id | 4 | 0 | 0 | OK |
| tblJobRoles | job_role_id | 4 | 0 | 0 | OK |
| tblJobs | job_id | 7 | 0 | 0 | OK |
| tblJobHistory | jh_id | 0 | 0 | 0 | EMPTY |
| tblBranches | branch_id | 1 | 0 | 0 | OK |
| tblDepartments | dept_id | 1 | 0 | 0 | OK |
| tblEmployees | employee_id | 4 | 0 | 0 | OK |
| tblAssets | asset_id | 1 | 0 | 0 | OK |
| tblVendors | vendor_id | 2 | 0 | 0 | OK |
| tblJobRoleNav | job_role_nav_id | 102 | 0 | 0 | OK |

## SKASC master data checks (skasc_db)

### Organizations — OK
Count: 1
```json
[
  {
    "org_id": "ORG001",
    "text": "SRI KRISHNA ARTS AND SCIENCE COLLEGE"
  }
]
```

### Users — OK
Count: 4
```json
[
  {
    "user_id": "USR001",
    "email": "sanjanaaasenthilkumar@gmail.com",
    "full_name": "System Administrator",
    "job_role_id": "JR001",
    "org_id": "ORG001",
    "int_status": 1
  },
  {
    "user_id": "USR002",
    "email": "mgr.test@skasc.test",
    "full_name": "Maint Manager",
    "job_role_id": "JR002",
    "org_id": "ORG001",
    "int_status": 1
  },
  {
    "user_id": "USR003",
    "email": "tech.test@skasc.test",
    "full_name": "Tech User",
    "job_role_id": "JR003",
    "org_id": "ORG001",
    "int_status": 1
  },
  {
    "user_id": "USR004",
    "email": "viewer.test@skasc.test",
    "full_name": "Report Viewer",
    "job_role_id": "JR004",
    "org_id": "ORG001",
    "int_status": 1
  }
]
```

### Job Roles — OK
Count: 4
```json
[
  {
    "job_role_id": "JR001",
    "text": "System Administrator",
    "job_function": "Full system access",
    "int_status": 1
  },
  {
    "job_role_id": "JR002",
    "text": "Maintenance Manager",
    "job_function": "Approves maintenance and assets",
    "int_status": 1
  },
  {
    "job_role_id": "JR003",
    "text": "Maintenance Technician",
    "job_function": "Desktop testing — work orders and breakdowns",
    "int_status": 1
  },
  {
    "job_role_id": "JR004",
    "text": "Report Viewer",
    "job_function": "Read-only reports access",
    "int_status": 1
  }
]
```

### Cron Jobs (Job Monitor) — OK
Count: 7 (expected ≥ 7)
```json
[
  {
    "job_id": "JOB001",
    "job_name": "maintenance trigger",
    "frequency": "0 0 * * *",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB002",
    "job_name": "Inspection",
    "frequency": "0 1 * * *",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB003",
    "job_name": "Vendor contract renewal",
    "frequency": "0 8 * * *",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB004",
    "job_name": "scrap seq setting",
    "frequency": "manual",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB005",
    "job_name": "maint seq setting",
    "frequency": "manual",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB006",
    "job_name": "warranty notification trigger",
    "frequency": "0 7 * * *",
    "status": "DISABLED"
  },
  {
    "job_id": "JOB007",
    "job_name": "asset expiry notification trigger",
    "frequency": "0 7 * * *",
    "status": "DISABLED"
  }
]
```

### Job Role Navigation (per role) — OK
```json
[
  {
    "job_role_id": "JR001",
    "nav_count": 63
  },
  {
    "job_role_id": "JR002",
    "nav_count": 16
  },
  {
    "job_role_id": "JR003",
    "nav_count": 8
  },
  {
    "job_role_id": "JR004",
    "nav_count": 12
  }
]
```

### ID Sequences — OK
Count: 57
```json
[
  {
    "table_key": "IC",
    "prefix": "IC",
    "last_number": 1
  },
  {
    "table_key": "aat_insp_checklist",
    "prefix": "AATIC",
    "last_number": 9
  },
  {
    "table_key": "aatif_id",
    "prefix": "AATIF",
    "last_number": 8
  },
  {
    "table_key": "aplv",
    "prefix": "APLV",
    "last_number": 0
  },
  {
    "table_key": "asset",
    "prefix": "ASS",
    "last_number": 121
  },
  {
    "table_key": "asset_doc",
    "prefix": "AD",
    "last_number": 0
  },
  {
    "table_key": "asset_group_d",
    "prefix": "AGD",
    "last_number": 0
  },
  {
    "table_key": "asset_group_doc",
    "prefix": "AGD",
    "last_number": 8
  },
  {
    "table_key": "asset_group_h",
    "prefix": "AGH",
    "last_number": 0
  },
  {
    "table_key": "asset_maint_doc",
    "prefix": "AMD",
    "last_number": 16
  },
  {
    "table_key": "asset_scrap",
    "prefix": "ASCP",
    "last_number": 13
  },
  {
    "table_key": "asset_scrap_det",
    "prefix": "ASD",
    "last_number": 48
  },
  {
    "table_key": "asset_type",
    "prefix": "AT",
    "last_number": 62
  },
  {
    "table_key": "asset_type_doc",
    "prefix": "ATD",
    "last_number": 16
  },
  {
    "table_key": "asset_type_prop",
    "prefix": "ATP",
    "last_number": 43
  },
  {
    "table_key": "asset_usage",
    "prefix": "AUG",
    "last_number": 7
  },
  {
    "table_key": "atbrrc",
    "prefix": "ATB",
    "last_number": 26
  },
  {
    "table_key": "atic",
    "prefix": "ATIC",
    "last_number": 3
  },
  {
    "table_key": "atmc",
    "prefix": "ATMC",
    "last_number": 33
  },
  {
    "table_key": "atmcl",
    "prefix": "ATMCL",
    "last_number": 8
  },
  {
    "table_key": "atmf",
    "prefix": "ATMF",
    "last_number": 27
  },
  {
    "table_key": "atp",
    "prefix": "ATP",
    "last_number": 103
  },
  {
    "table_key": "branch",
    "prefix": "BR",
    "last_number": 1
  },
  {
    "table_key": "cc_transfer",
    "prefix": "CC_TR",
    "last_number": 4
  },
  {
    "table_key": "column_access",
    "prefix": "COLUM",
    "last_number": 83
  },
  {
    "table_key": "department",
    "prefix": "DPT",
    "last_number": 1
  },
  {
    "table_key": "dept_admin",
    "prefix": "DPTA",
    "last_number": 16
  },
  {
    "table_key": "dept_asset",
    "prefix": "DPTASS",
    "last_number": 0
  },
  {
    "table_key": "emp_int_id",
    "prefix": "EMP_INT_",
    "last_number": 62
  },
  {
    "table_key": "employee",
    "prefix": "EMP",
    "last_number": 6
  },
  {
    "table_key": "etc",
    "prefix": "ETC",
    "last_number": 14
  },
  {
    "table_key": "job_role",
    "prefix": "JR",
    "last_number": 20
  },
  {
    "table_key": "job_role_nav",
    "prefix": "JRN",
    "last_number": 134
  },
  {
    "table_key": "jobrole",
    "prefix": "JR",
    "last_number": 4
  },
  {
    "table_key": "jobrolenav",
    "prefix": "JRN",
    "last_number": 111127
  },
  {
    "table_key": "org",
    "prefix": "ORG",
    "last_number": 1
  },
  {
    "table_key": "org_setting",
    "prefix": "ORG_S",
    "last_number": 2
  },
  {
    "table_key": "prod_serv",
    "prefix": "PS",
    "last_number": 32
  },
  {
    "table_key": "prop",
    "prefix": "PROP",
    "last_number": 33
  },
  {
    "table_key": "psnq",
    "prefix": "PSN",
    "last_number": 65
  },
  {
    "table_key": "scrap_asset_hist",
    "prefix": "SCRAP",
    "last_number": 14
  },
  {
    "table_key": "tblAssetBRDet",
    "prefix": "ABR",
    "last_number": 0
  },
  {
    "table_key": "tcert",
    "prefix": "TCERT",
    "last_number": 14
  },
  {
    "table_key": "user",
    "prefix": "USR",
    "last_number": 4
  },
  {
    "table_key": "user_id",
    "prefix": "USR",
    "last_number": 24
  },
  {
    "table_key": "userjobrole",
    "prefix": "UJR",
    "last_number": 4
  },
  {
    "table_key": "vendor",
    "prefix": "V",
    "last_number": 48
  },
  {
    "table_key": "vendor_doc",
    "prefix": "VD",
    "last_number": 7
  },
  {
    "table_key": "vendor_prod_serv",
    "prefix": "VPS",
    "last_number": 3
  },
  {
    "table_key": "vendor_sla",
    "prefix": "VSLA",
    "last_number": 9
  },
  {
    "table_key": "vendor_sla_rec",
    "prefix": "VSLAR",
    "last_number": 6
  },
  {
    "table_key": "wfams",
    "prefix": "WFAMS",
    "last_number": 8
  },
  {
    "table_key": "wfamsd",
    "prefix": "WFAMSD",
    "last_number": 19
  },
  {
    "table_key": "wfamsh",
    "prefix": "WFAMSH",
    "last_number": 6
  },
  {
    "table_key": "wfas",
    "prefix": "WFAS",
    "last_number": 28
  },
  {
    "table_key": "wfscrap_d",
    "prefix": "WFSCD",
    "last_number": 20
  },
  {
    "table_key": "wfscrap_h",
    "prefix": "WFSCH",
    "last_number": 14
  }
]
```

### Org Settings — OK
Count: 3
```json
[
  {
    "os_id": "OS_01",
    "org_id": "ORG001",
    "key": "dep_auto_calc",
    "value": "1"
  },
  {
    "os_id": "OS_02",
    "org_id": "ORG001",
    "key": "asset_inv_doc_size",
    "value": "10"
  },
  {
    "os_id": "OS_03",
    "org_id": "ORG001",
    "key": "default_doc_size",
    "value": "15"
  }
]
```

## Full table inventory

### Hospitality
- `tblAATInspCheckList` (BASE TABLE)
- `tblAAT_Insp_Freq` (BASE TABLE)
- `tblAAT_Insp_Rec` (BASE TABLE)
- `tblAAT_Insp_Sch` (BASE TABLE)
- `tblATBRReasonCodes` (BASE TABLE)
- `tblATDocs` (BASE TABLE)
- `tblATInspCert` (BASE TABLE)
- `tblATInspCerts` (VIEW)
- `tblATMaintCert` (BASE TABLE)
- `tblATMaintCheckList` (BASE TABLE)
- `tblATMaintFreq` (BASE TABLE)
- `tblApps` (BASE TABLE)
- `tblAssetAssignments` (BASE TABLE)
- `tblAssetBRDet` (BASE TABLE)
- `tblAssetDepHist` (BASE TABLE)
- `tblAssetDocs` (BASE TABLE)
- `tblAssetExpiryNotify` (BASE TABLE)
- `tblAssetGroupDocs` (BASE TABLE)
- `tblAssetGroup_D` (BASE TABLE)
- `tblAssetGroup_H` (BASE TABLE)
- `tblAssetMaintDocs` (BASE TABLE)
- `tblAssetMaintSch` (BASE TABLE)
- `tblAssetMaintSch_BR_Hist` (BASE TABLE)
- `tblAssetPropListValues` (BASE TABLE)
- `tblAssetPropValues` (BASE TABLE)
- `tblAssetScrap` (BASE TABLE)
- `tblAssetScrapDet` (BASE TABLE)
- `tblAssetTypeProps` (BASE TABLE)
- `tblAssetTypes` (BASE TABLE)
- `tblAssetUsageReg` (BASE TABLE)
- `tblAssetWarrantyNotify` (BASE TABLE)
- `tblAssets` (BASE TABLE)
- `tblAuditLogConfig` (BASE TABLE)
- `tblAuditLogs` (BASE TABLE)
- `tblBranchCostCenter` (BASE TABLE)
- `tblBranches` (BASE TABLE)
- `tblCCTransfer` (BASE TABLE)
- `tblColumnAccessConfig` (BASE TABLE)
- `tblCostCenter` (BASE TABLE)
- `tblDepartments` (BASE TABLE)
- `tblDepreciationSettings` (BASE TABLE)
- `tblDeptAdmins` (BASE TABLE)
- `tblDeptAssetTypes` (BASE TABLE)
- `tblDocTypeObjects` (BASE TABLE)
- `tblEmpTechCert` (BASE TABLE)
- `tblEmployees` (BASE TABLE)
- `tblEvents` (BASE TABLE)
- `tblFCMTokens` (BASE TABLE)
- `tblIDSequences` (BASE TABLE)
- `tblInspCheckList` (BASE TABLE)
- `tblInspResTypeDet` (BASE TABLE)
- `tblJobHistory` (BASE TABLE)
- `tblJobRoleNav` (BASE TABLE)
- `tblJobRoles` (BASE TABLE)
- `tblJobs` (BASE TABLE)
- `tblMaintStatus` (BASE TABLE)
- `tblMaintTypes` (BASE TABLE)
- `tblNotificationHistory` (BASE TABLE)
- `tblNotificationPreferences` (BASE TABLE)
- `tblOrgSettings` (BASE TABLE)
- `tblOrgs` (BASE TABLE)
- `tblPrintSerialNoQueue` (BASE TABLE)
- `tblProdServs` (BASE TABLE)
- `tblProps` (BASE TABLE)
- `tblRioAdmin` (BASE TABLE)
- `tblScrapAssetHist` (BASE TABLE)
- `tblScrapSalesDocs` (BASE TABLE)
- `tblScrapSales_D` (BASE TABLE)
- `tblScrapSales_H` (BASE TABLE)
- `tblStatusCodes` (BASE TABLE)
- `tblTableFilterColumns` (BASE TABLE)
- `tblTechCert` (BASE TABLE)
- `tblTechnicalLogConfig` (BASE TABLE)
- `tblTextMessagesDefault` (BASE TABLE)
- `tblTextMessagesOtherLangs` (BASE TABLE)
- `tblUom` (BASE TABLE)
- `tblUserJobRoles` (BASE TABLE)
- `tblUsers` (BASE TABLE)
- `tblVendorDocs` (BASE TABLE)
- `tblVendorProdService` (BASE TABLE)
- `tblVendorRenewal` (BASE TABLE)
- `tblVendorSLAs` (BASE TABLE)
- `tblVendors` (BASE TABLE)
- `tblWFAATInspHist` (BASE TABLE)
- `tblWFAATInspSch_D` (BASE TABLE)
- `tblWFAATInspSch_H` (BASE TABLE)
- `tblWFATInspSeqs` (BASE TABLE)
- `tblWFATSeqs` (BASE TABLE)
- `tblWFAssetMaintHist` (BASE TABLE)
- `tblWFAssetMaintSch_D` (BASE TABLE)
- `tblWFAssetMaintSch_H` (BASE TABLE)
- `tblWFInspJobRole` (BASE TABLE)
- `tblWFInspSteps` (BASE TABLE)
- `tblWFJobRole` (BASE TABLE)
- `tblWFScrapSeq` (BASE TABLE)
- `tblWFScrap_D` (BASE TABLE)
- `tblWFScrap_H` (BASE TABLE)
- `tblWFSteps` (BASE TABLE)
- `tblsla_desc` (BASE TABLE)

### Tenant
- `tblAATInspCheckList` (BASE TABLE)
- `tblAAT_Insp_Freq` (BASE TABLE)
- `tblAAT_Insp_Rec` (BASE TABLE)
- `tblAAT_Insp_Sch` (BASE TABLE)
- `tblATBRReasonCodes` (BASE TABLE)
- `tblATDocs` (BASE TABLE)
- `tblATInspCert` (BASE TABLE)
- `tblATInspCerts` (VIEW)
- `tblATMaintCert` (BASE TABLE)
- `tblATMaintCheckList` (BASE TABLE)
- `tblATMaintFreq` (BASE TABLE)
- `tblApps` (BASE TABLE)
- `tblAssetAssignments` (BASE TABLE)
- `tblAssetBRDet` (BASE TABLE)
- `tblAssetDepHist` (BASE TABLE)
- `tblAssetDocs` (BASE TABLE)
- `tblAssetExpiryNotify` (BASE TABLE)
- `tblAssetGroupDocs` (BASE TABLE)
- `tblAssetGroup_D` (BASE TABLE)
- `tblAssetGroup_H` (BASE TABLE)
- `tblAssetMaintDocs` (BASE TABLE)
- `tblAssetMaintSch` (BASE TABLE)
- `tblAssetMaintSch_BR_Hist` (BASE TABLE)
- `tblAssetPropListValues` (BASE TABLE)
- `tblAssetPropValues` (BASE TABLE)
- `tblAssetScrap` (BASE TABLE)
- `tblAssetScrapDet` (BASE TABLE)
- `tblAssetTypeProps` (BASE TABLE)
- `tblAssetTypes` (BASE TABLE)
- `tblAssetUsageReg` (BASE TABLE)
- `tblAssetWarrantyNotify` (BASE TABLE)
- `tblAssets` (BASE TABLE)
- `tblAuditLogConfig` (BASE TABLE)
- `tblAuditLogs` (BASE TABLE)
- `tblBranchCostCenter` (BASE TABLE)
- `tblBranches` (BASE TABLE)
- `tblCCTransfer` (BASE TABLE)
- `tblColumnAccessConfig` (BASE TABLE)
- `tblCostCenter` (BASE TABLE)
- `tblDepartments` (BASE TABLE)
- `tblDepreciationSettings` (BASE TABLE)
- `tblDeptAdmins` (BASE TABLE)
- `tblDeptAssetTypes` (BASE TABLE)
- `tblDocTypeObjects` (BASE TABLE)
- `tblEmpTechCert` (BASE TABLE)
- `tblEmployees` (BASE TABLE)
- `tblEvents` (BASE TABLE)
- `tblFCMTokens` (BASE TABLE)
- `tblIDSequences` (BASE TABLE)
- `tblInspCheckList` (BASE TABLE)
- `tblInspResTypeDet` (BASE TABLE)
- `tblJobHistory` (BASE TABLE)
- `tblJobRoleNav` (BASE TABLE)
- `tblJobRoles` (BASE TABLE)
- `tblJobs` (BASE TABLE)
- `tblMaintStatus` (BASE TABLE)
- `tblMaintTypes` (BASE TABLE)
- `tblNotificationHistory` (BASE TABLE)
- `tblNotificationPreferences` (BASE TABLE)
- `tblOrgSettings` (BASE TABLE)
- `tblOrgs` (BASE TABLE)
- `tblPrintSerialNoQueue` (BASE TABLE)
- `tblProdServs` (BASE TABLE)
- `tblProps` (BASE TABLE)
- `tblRioAdmin` (BASE TABLE)
- `tblScrapAssetHist` (BASE TABLE)
- `tblScrapSalesDocs` (BASE TABLE)
- `tblScrapSales_D` (BASE TABLE)
- `tblScrapSales_H` (BASE TABLE)
- `tblStatusCodes` (BASE TABLE)
- `tblTableFilterColumns` (BASE TABLE)
- `tblTechCert` (BASE TABLE)
- `tblTechnicalLogConfig` (BASE TABLE)
- `tblTextMessagesDefault` (BASE TABLE)
- `tblTextMessagesOtherLangs` (BASE TABLE)
- `tblUom` (BASE TABLE)
- `tblUserJobRoles` (BASE TABLE)
- `tblUsers` (BASE TABLE)
- `tblVendorDocs` (BASE TABLE)
- `tblVendorProdService` (BASE TABLE)
- `tblVendorRenewal` (BASE TABLE)
- `tblVendorSLAs` (BASE TABLE)
- `tblVendors` (BASE TABLE)
- `tblWFAATInspHist` (BASE TABLE)
- `tblWFAATInspSch_D` (BASE TABLE)
- `tblWFAATInspSch_H` (BASE TABLE)
- `tblWFATInspSeqs` (BASE TABLE)
- `tblWFATSeqs` (BASE TABLE)
- `tblWFAssetMaintHist` (BASE TABLE)
- `tblWFAssetMaintSch_D` (BASE TABLE)
- `tblWFAssetMaintSch_H` (BASE TABLE)
- `tblWFInspJobRole` (BASE TABLE)
- `tblWFInspSteps` (BASE TABLE)
- `tblWFJobRole` (BASE TABLE)
- `tblWFScrapSeq` (BASE TABLE)
- `tblWFScrap_D` (BASE TABLE)
- `tblWFScrap_H` (BASE TABLE)
- `tblWFSteps` (BASE TABLE)
- `tblsla_desc` (BASE TABLE)