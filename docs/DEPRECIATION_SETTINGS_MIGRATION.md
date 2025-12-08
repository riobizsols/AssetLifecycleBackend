# Depreciation Settings Migration to tblOrgSettings

## Overview
Migrated depreciation settings from `tblDepreciationSettings` to `tblOrgSettings` to consolidate organization settings in one table and prepare for removal of `tblDepreciationSettings`.

## Changes Made

### 1. Updated `utils/orgSettingsUtils.js`
- Added new function `setOrgSetting()` to create/update settings in `tblOrgSettings`
- This complements the existing `getOrgSetting()` function
- Handles both INSERT (new settings) and UPDATE (existing settings)

### 2. Updated `models/depreciationModel.js`
- Imported `getOrgSetting` and `setOrgSetting` utilities
- Modified `getDepreciationSettings()` to read from `tblOrgSettings` instead of `tblDepreciationSettings`
- Modified `updateDepreciationSettings()` to write to `tblOrgSettings` instead of `tblDepreciationSettings`
- Changed method signature from `updateDepreciationSettings(settingId, updateData)` to `updateDepreciationSettings(orgId, updateData)`

### 3. Updated `routes/depreciationRoutes.js`
- Changed PUT route from `/settings/:setting_id` to `/settings/:org_id`

### 4. Updated `controllers/depreciationController.js`
- Updated `updateDepreciationSettings()` controller to use `org_id` parameter instead of `setting_id`
- Updated logging to use `orgId` instead of `settingId`

## Settings Keys in tblOrgSettings

The following keys are now used to store depreciation settings:

| Key | Description | Data Type | Default |
|-----|-------------|-----------|---------|
| `fy_start_month` | Fiscal year start month | Integer (1-12) | 1 |
| `fy_start_day` | Fiscal year start day | Integer (1-31) | 1 |
| `dep_calc_freq` | Depreciation calculation frequency | String (MONTHLY/QUARTERLY/YEARLY) | MONTHLY |
| `auto_calc_dep` | Auto calculate depreciation | Boolean (0/1) | 1 |

## API Changes

### GET /api/depreciation/settings/:org_id
- No changes (already used org_id)

### PUT /api/depreciation/settings/:org_id
- **CHANGED**: Now uses `:org_id` instead of `:setting_id`
- **Before**: `PUT /api/depreciation/settings/{setting_id}`
- **After**: `PUT /api/depreciation/settings/{org_id}`

## Migration Notes

### For Existing Data
If you have existing data in `tblDepreciationSettings`, you need to migrate it to `tblOrgSettings`:

```sql
-- Migration script to move data from tblDepreciationSettings to tblOrgSettings
INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
SELECT 
    'OS-' || org_id || '-001', 
    org_id, 
    'fy_start_month', 
    fiscal_year_start_month::varchar
FROM "tblDepreciationSettings"
WHERE NOT EXISTS (
    SELECT 1 FROM "tblOrgSettings" 
    WHERE "tblOrgSettings".org_id = "tblDepreciationSettings".org_id 
    AND key = 'fy_start_month'
);

INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
SELECT 
    'OS-' || org_id || '-002', 
    org_id, 
    'fy_start_day', 
    fiscal_year_start_day::varchar
FROM "tblDepreciationSettings"
WHERE NOT EXISTS (
    SELECT 1 FROM "tblOrgSettings" 
    WHERE "tblOrgSettings".org_id = "tblDepreciationSettings".org_id 
    AND key = 'fy_start_day'
);

INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
SELECT 
    'OS-' || org_id || '-003', 
    org_id, 
    'dep_calc_freq', 
    depreciation_calculation_frequency
FROM "tblDepreciationSettings"
WHERE NOT EXISTS (
    SELECT 1 FROM "tblOrgSettings" 
    WHERE "tblOrgSettings".org_id = "tblDepreciationSettings".org_id 
    AND key = 'dep_calc_freq'
);

INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
SELECT 
    'OS-' || org_id || '-004', 
    org_id, 
    'auto_calc_dep', 
    CASE WHEN auto_calculate_depreciation THEN '1' ELSE '0' END
FROM "tblDepreciationSettings"
WHERE NOT EXISTS (
    SELECT 1 FROM "tblOrgSettings" 
    WHERE "tblOrgSettings".org_id = "tblDepreciationSettings".org_id 
    AND key = 'auto_calc_dep'
);
```

### After Migration
Once the migration is complete and tested, you can drop the `tblDepreciationSettings` table:

```sql
-- Verify all data is migrated first!
-- Then drop the old table
DROP TABLE "tblDepreciationSettings";
```

## Testing

### Test GET Settings
```bash
curl -X GET http://localhost:3000/api/depreciation/settings/ORG001
```

Expected response:
```json
{
  "org_id": "ORG001",
  "settings": {
    "org_id": "ORG001",
    "fiscal_year_start_month": 1,
    "fiscal_year_start_day": 1,
    "depreciation_calculation_frequency": "MONTHLY",
    "auto_calculate_depreciation": true
  }
}
```

### Test PUT Settings
```bash
curl -X PUT http://localhost:3000/api/depreciation/settings/ORG001 \
  -H "Content-Type: application/json" \
  -d '{
    "fiscal_year_start_month": 4,
    "fiscal_year_start_day": 1,
    "depreciation_calculation_frequency": "QUARTERLY",
    "auto_calculate_depreciation": true
  }'
```

Expected response:
```json
{
  "message": "Depreciation settings updated successfully",
  "settings": {
    "org_id": "ORG001",
    "fiscal_year_start_month": 4,
    "fiscal_year_start_day": 1,
    "depreciation_calculation_frequency": "QUARTERLY",
    "auto_calculate_depreciation": true,
    "changed_by": "USER001",
    "changed_on": "2025-12-08T..."
  }
}
```

## Backward Compatibility

The code maintains backward compatibility by:
1. Returning the same data structure from `getDepreciationSettings()`
2. Returning the same response format from the API endpoints
3. Using default values (1, 1, 'MONTHLY', true) when settings don't exist

## Benefits

1. ✅ **Simplified Architecture**: All organization settings in one table
2. ✅ **Easier Maintenance**: One table to manage instead of multiple settings tables
3. ✅ **Flexible Storage**: Key-value format allows easy addition of new settings
4. ✅ **Consistent Pattern**: Follows the same pattern as other org settings (initial_password, m_supervisor_role, etc.)
5. ✅ **Ready for Cleanup**: Can now safely remove `tblDepreciationSettings` table

## Files Modified

1. `utils/orgSettingsUtils.js` - Added setOrgSetting function
2. `models/depreciationModel.js` - Updated get/update methods
3. `routes/depreciationRoutes.js` - Updated PUT route parameter
4. `controllers/depreciationController.js` - Updated controller to use org_id

## Date
December 8, 2025
