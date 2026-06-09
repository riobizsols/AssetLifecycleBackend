# Removal of `maint_required` and `maint_type_id` from `tblAssetTypes`

**Date:** 2026-06-08  
**Scope:** AssetLifecycleBackend + AssetLifecycleWebFrontend (main project)

## Summary

`tblAssetTypes.maint_required` and `tblAssetTypes.maint_type_id` were removed. Maintenance configuration is now driven entirely by **`tblATMaintFreq`** (per asset type + maintenance type + frequency) and workflow sequences in **`tblWFATSeqs`**.

## Migration

Run on each environment:

```bash
cd AssetLifecycleBackend
node migrations/drop-asset-type-maint-columns.js
```

Verified locally: columns dropped; 21 asset types still returned via `tblATMaintFreq` join.

## What Changed

### Database
| Before | After |
|--------|-------|
| `tblAssetTypes.maint_required` boolean | **Dropped** |
| `tblAssetTypes.maint_type_id` varchar | **Dropped** |
| `tblATMaintFreq.maint_type_id` | **Unchanged** (source of truth) |
| `tblAssetTypes.maint_lead_type` | **Kept** (lead time for escalations) |
| `tblAssetTypes.inspection_required` | **Kept** (inspection cron) |

### Cron / Scheduling (`maintenanceScheduleModel.js`)
| Area | Old logic | New logic |
|------|-----------|-----------|
| `getAssetTypesRequiringMaintenance()` | `WHERE maint_required = true` | `INNER JOIN tblATMaintFreq` — only types with configured frequencies |
| `createManualMaintenanceSchedule()` | `maint_required=false` → direct insert; `true` → workflow | **No `tblWFATSeqs`** → direct insert using `tblATMaintFreq.maint_type_id`; **has sequences** → workflow |
| Inspection cron | `maint_required = true` | `inspection_required = true` |

### Scrap Approval (`scrapMaintenanceModel.js`, `scrapSalesModel.js`)
| Old | New |
|-----|-----|
| Bypass workflow when `maint_required = false` | Bypass when **no `tblWFScrapSeq`** rows for asset type |

### Notifications / Approvals (`notificationModel.js`, `approvalDetailModel.js`)
| Old | New |
|-----|-----|
| `COALESCE(wfh.maint_type_id, at.maint_type_id)` | `wfh.maint_type_id` only |

### Asset Type API (`assetTypeModel.js`, `assetTypeController.js`)
- INSERT/UPDATE no longer accept `maint_required` or `maint_type_id`
- `GET /api/asset-types/maint-required` returns asset types with rows in `tblATMaintFreq`
- `updateAssetTypeMaintenance()` only updates `maint_lead_type` (frequency create no longer flags asset type)

### Bulk Upload (`BulkUpload.jsx` + controller)
Removed from CSV template and validation:
- `maint_required` (Require_Maintenance)
- `maint_type_id` (Maint_Type)

Configure maintenance via **Maintenance Frequency** screen after bulk upload.

### Frontend Forms
- `AddAssetType.jsx` — no longer sends `maint_required` / `maint_type_id`
- `UpdateAssetTypeModal.jsx` — no longer clears those fields on every save
- `Certifications.jsx` — maint types loaded only from frequency API (no asset-type fallback)

## Files Modified (Main Project)

### Backend
- `migrations/drop-asset-type-maint-columns.js` (new)
- `utils/assetTypeMaintenanceUtils.js` (new helpers)
- `models/assetTypeModel.js`
- `models/maintenanceScheduleModel.js`
- `models/scrapMaintenanceModel.js`
- `models/scrapSalesModel.js`
- `models/inspectionScheduleModel.js`
- `models/notificationModel.js`
- `models/approvalDetailModel.js`
- `models/workOrderModel.js`
- `models/deptAssetsModel.js`
- `models/assetSerialPrintModel.js`
- `controllers/assetTypeController.js`
- `controllers/deptAssetController.js`
- `controllers/workOrderController.js`
- `controllers/assetSerialPrintController.js`

### Frontend
- `pages/masterData/BulkUpload.jsx`
- `components/AddAssetType.jsx`
- `components/UpdateAssetTypeModal.jsx`
- `pages/adminSettings/Certifications.jsx`
- `pages/reports/SerialNumberPrint.jsx`

## Testing Performed

| Test | Result |
|------|--------|
| Migration `drop-asset-type-maint-columns.js` | ✅ Columns removed |
| `getAssetTypesRequiringMaintenance()` | ✅ 21 types from `tblATMaintFreq` |
| `getAssetTypesByMaintRequired()` | ✅ 21 types (same join) |
| `getAllAssetTypes()` sample row | ✅ No `maint_required` / `maint_type_id` keys |

## Manual Test Checklist (recommended)

1. **Maintenance Frequency** — Create frequency for an asset type; verify `tblATMaintFreq` row
2. **Cron generate** — `POST /api/maintenance-schedules/generate-cron` — schedules only for types with frequencies
3. **Bulk upload** — Download asset type CSV template; confirm no Require_Maintenance / Maint_Type columns
4. **Create asset type** — UI + API without maintenance fields
5. **Scrap request** — Asset type with/without `tblWFScrapSeq` workflow
6. **Breakdown** — Decision code field behavior (no auto-lock without `maint_required`)
7. **Certifications** — Maint type dropdown populated from frequencies only
8. **Work orders / serial print** — No errors loading asset type details

## ALM-tenant

The `ALM-tenant/` tree mirrors this codebase. Apply the same migration and code changes there before deploying multi-tenant environments.

## Operational Notes

- Existing data: `maint_type_id` values on asset types are **not** auto-migrated to `tblATMaintFreq`. Ensure frequencies exist for each asset type that needs maintenance before running cron.
- `maint_lead_type` remains on `tblAssetTypes` for notification/escalation lead-time calculations.
