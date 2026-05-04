# Multilingual Implementation Report

Generated for frontend toast/message coverage using `tmd_id` flow.

## Summary

- Files scanned: `219`
- Files auto-changed in this safe pass: `0`
- Existing `showBackendTextToast(...)` calls: `859`
- Remaining direct `toast.*(...)` calls: `307`

## Why auto-conversion was limited

Most remaining `toast.*(...)` calls are not simple string literals.  
They are dynamic expressions (e.g. backend error objects, translated keys, template strings, or option-rich calls), which require manual semantic mapping to stable `tmd_id` values to avoid breaking behavior.

## Artifacts

- Detailed JSON report: `AssetLifecycleBackend/scripts/multilingual-implementation-report.json`
- Converter script: `AssetLifecycleBackend/scripts/convertToBackendTextToast.js`

## Top pending areas (by remaining direct toast count)

- `src/components/assets/AddAssetForm.jsx` (13)
- `src/components/ServiceSupplyForm.jsx` (12)
- `src/components/ProductSupplyForm.jsx` (11)
- `src/components/MaintenanceApprovalDetail.jsx` (11)
- `src/components/InspectionApprovalDetail.jsx` (11)
- `src/components/MaintenanceDetails.jsx` (10)
- `src/components/ScrapMaintenanceApprovalDetail.jsx` (9)
- `src/pages/adminSettings/Certifications.jsx` (8)
- `src/pages/masterData/Properties.jsx` (8)
- `src/components/assets/UpdateAssetModal.jsx` (8)

## Recommended execution plan

1. **Manual conversion pass for dynamic toasts**  
   Convert remaining calls to:
   - `showBackendTextToast({ toast, tmdId, fallbackText, type })` for user messages
   - Keep developer/debug logs as-is

2. **Seed refresh after each pass**  
   Re-run:
   - `node scripts/seedTextMessagesFromFrontend.js`

3. **Verification**  
   - Build/lint frontend
   - Spot-check create/edit/delete/error flows in master data, admin settings, assets, maintenance, inspection, reports

