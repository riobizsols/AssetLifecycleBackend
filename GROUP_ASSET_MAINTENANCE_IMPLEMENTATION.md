# Group Asset Maintenance Implementation

## Overview

This document describes the implementation of group-level maintenance scheduling for assets. Previously, maintenance was scheduled individually for each asset. Now, assets grouped together by the same asset type can have maintenance scheduled as a group, using the earliest purchase date for first-time maintenance and the latest maintenance date for subsequent maintenance.

## Implementation Summary

### Key Features

1. **Group-Level Maintenance Scheduling**
   - Assets of the same asset type that are grouped together now get a single maintenance schedule
   - The `group_id` field in `tblWFAssetMaintSch_H` is now populated (previously always NULL)

2. **Date Logic**
   - **First Maintenance**: Uses the **earliest purchase date** among all assets in the group
   - **Subsequent Maintenance**: Uses the **latest maintenance date** from completed group maintenance schedules

3. **Processing Order**
   - Groups are processed first (before individual assets)
   - Assets that are part of groups are skipped during individual asset processing
   - Prevents duplicate schedules

4. **Notifications**
   - Notifications now include group information (group_id, group_name, group_asset_count)
   - Users can see if a maintenance notification is for a group of assets

## Files Modified

### 1. `AssetLifecycleBackend/models/maintenanceScheduleModel.js`

**New Functions Added:**
- `getAssetsByGroupId(group_id)` - Get all assets in a group
- `getGroupsByAssetType(asset_type_id)` - Get all groups for an asset type
- `checkExistingWorkflowMaintenanceSchedulesForGroup(group_id)` - Check group workflow schedules
- `checkExistingMaintenanceSchedulesForGroup(group_id)` - Check group direct schedules
- `getEarliestPurchaseDateForGroup(group_id)` - Get earliest purchase date in group
- `getLatestMaintenanceDateForGroup(group_id)` - Get latest maintenance date for group

**Modified Functions:**
- `getAssetsByAssetType()` - Now includes `group_id` in SELECT

### 2. `AssetLifecycleBackend/controllers/maintenanceScheduleController.js`

**New Helper Function:**
- `processGroupMaintenance(group_id, assetType, frequencies, testDate)` - Processes maintenance for a group

**Modified Functions:**
- `generateMaintenanceSchedules()` - Now processes groups first, then individual assets
  - Added group processing loop before individual asset processing
  - Tracks assets in groups to skip them during individual processing
  - Returns group statistics in response

### 3. `AssetLifecycleBackend/models/notificationModel.js`

**Modified Queries:**
- `getMaintenanceNotifications()` - Now includes:
  - `wfh.group_id`
  - `ag.text as group_name`
  - `group_asset_count` (count of assets in group)
- `getMaintenanceNotificationsByUser()` - Now includes the same group information
- Added LEFT JOIN to `tblAssetGroup_H` for group information

## How It Works

### Maintenance Schedule Generation Flow

```
1. Get asset types requiring maintenance
2. For each asset type:
   a. Get maintenance frequencies
   b. Get all groups for this asset type
   c. For each group:
      - Get all assets in the group
      - Check for in-progress schedules (skip if found)
      - Determine date to consider:
        * First maintenance: earliest purchase date
        * Subsequent: latest maintenance date
      - Calculate planned schedule date
      - Check if maintenance is due
      - Create workflow schedule with group_id set
      - Create workflow details
      - Track asset IDs to skip in individual processing
   d. Get all assets for this asset type
   e. For each asset:
      - Skip if asset is in a group (already processed)
      - Process individually (existing logic)
```

### Date Calculation Logic

**First Maintenance:**
```javascript
// No completed schedules found
const earliestPurchaseDate = await getEarliestPurchaseDateForGroup(group_id);
dateToConsider = new Date(earliestPurchaseDate);
```

**Subsequent Maintenance:**
```javascript
// Has completed schedules
const latestMaintenanceDate = await getLatestMaintenanceDateForGroup(group_id);
const latestWorkflowDate = // from completed workflow schedules
dateToConsider = max(latestMaintenanceDate, latestWorkflowDate, earliestPurchaseDate);
```

### Group Maintenance Schedule Creation

When creating a maintenance schedule for a group:
- `group_id` is set to the actual group ID (not NULL)
- `asset_id` is set to the first asset in the group (representative asset)
- Workflow details include a note: "Group maintenance for X assets"
- All assets in the group are linked to this single schedule

## Database Schema

### Key Tables

**tblWFAssetMaintSch_H** (Workflow Maintenance Schedule Header)
- `group_id` - Now populated for group maintenance (was always NULL before)
- `asset_id` - Representative asset (first asset in group)

**tblAssetGroup_H** (Asset Group Header)
- `assetgroup_h_id` - Group identifier

**tblAssetGroup_D** (Asset Group Details)
- Links assets to groups

**tblAssets**
- `group_id` - References asset group

## API Response Changes

The maintenance schedule generation API now returns:

```json
{
  "message": "Maintenance schedules generated successfully",
  "asset_types_processed": 5,
  "groups_processed": 3,
  "group_schedules_created": 3,
  "assets_processed": 10,
  "assets_skipped": 2,
  "schedules_created": 13,
  "test_date_used": "2024-01-15"
}
```

## Notification Updates

Notifications now include group information:

```json
{
  "wfamsh_id": "WFAMSH_01",
  "asset_id": "ASSET001",
  "group_id": "AGH001",
  "group_name": "Server Group 1",
  "group_asset_count": 3,
  "pl_sch_date": "2024-02-01",
  ...
}
```

## Testing

### Test Scenarios

1. **Create a group with assets of the same type**
   - Assets should have different purchase dates
   - Verify group_id is set in tblAssets

2. **Generate maintenance schedules**
   - Should create one schedule for the group
   - Should use earliest purchase date for first maintenance
   - group_id should be set in tblWFAssetMaintSch_H

3. **Complete maintenance and generate again**
   - Should use latest maintenance date for subsequent maintenance

4. **Check notifications**
   - Should show group information
   - Should indicate it's a group maintenance

### Manual Testing Steps

```bash
# 1. Create a group asset
POST /api/asset-groups
{
  "text": "Test Group",
  "asset_ids": ["ASSET001", "ASSET002", "ASSET003"]
}

# 2. Generate maintenance schedules
POST /api/maintenance-schedules/generate
{
  "test_date": "2024-01-15"
}

# 3. Check response
# Should show groups_processed > 0 and group_schedules_created > 0

# 4. Check notifications
GET /api/notifications/maintenance
# Should include group_id and group_name in results
```

## Important Notes

1. **Workflow Bypass Version**: The `generateMaintenanceSchedulesWithWorkflowBypass` function has not been updated yet. It still processes assets individually. Consider updating it similarly if needed.

2. **Mixed Assets**: If an asset type has both grouped and ungrouped assets:
   - Grouped assets get group-level maintenance
   - Ungrouped assets get individual maintenance
   - No conflicts occur

3. **Group Changes**: If assets are removed from or added to a group:
   - Existing schedules remain (they reference the group_id at creation time)
   - New schedules will reflect the new group composition

4. **Representative Asset**: The first asset in the group is used as the `asset_id` in the workflow header. This is for backward compatibility and reference purposes.

## Future Enhancements

1. **Group Maintenance History**: Track maintenance history at group level
2. **Group-Level Reports**: Generate reports showing group maintenance statistics
3. **Bulk Operations**: Allow completing maintenance for all assets in a group at once
4. **Group Notifications**: Enhanced notifications showing all assets in the group
5. **Workflow Bypass Support**: Update the bypass version to support groups

## Backward Compatibility

- Existing individual asset maintenance continues to work
- Assets not in groups are processed as before
- The system gracefully handles assets with or without groups
- No breaking changes to existing APIs

## Error Handling

- If a group has no assets, it's skipped
- If a group has no purchase dates, it's skipped
- If maintenance is not due, the group is skipped (normal behavior)
- All errors are logged but don't stop the overall process

---

*Implementation Date: Based on requirements for group asset maintenance*
*Last Updated: After implementation completion*

