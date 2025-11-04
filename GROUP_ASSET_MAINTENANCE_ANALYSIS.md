# Group Asset Maintenance Workflow Analysis

## Overview

This document explains how maintenance works for group assets in the Asset Life Cycle Management system. Based on code analysis, the system currently processes group assets **individually** rather than as a cohesive group for maintenance operations.

---

## Table of Contents

1. [Group Asset Creation](#group-asset-creation)
2. [Maintenance Scheduling](#maintenance-scheduling)
3. [Notifications](#notifications)
4. [Workflow Processing](#workflow-processing)
5. [Key Findings](#key-findings)
6. [Recommendations](#recommations)

---

## Group Asset Creation

### How It Works

1. **API Endpoint**: `POST /api/asset-groups`
2. **Process**:
   - Assets are selected from the same asset type
   - A group header is created in `tblAssetGroup_H`
   - Group details are created in `tblAssetGroup_D` (one record per asset)
   - The `group_id` field in `tblAssets` is updated for all assets in the group

### Code Location
- **Controller**: `AssetLifecycleBackend/controllers/assetGroupController.js`
- **Model**: `AssetLifecycleBackend/models/assetGroupModel.js`

### Example Flow

```javascript
// Create group with assets
POST /api/asset-groups
{
  "text": "Server Group 1",
  "asset_ids": ["ASSET001", "ASSET002", "ASSET003"]
}

// Result:
// - Creates entry in tblAssetGroup_H
// - Creates entries in tblAssetGroup_D (one per asset)
// - Updates tblAssets.group_id for all assets
```

### Database Schema

```sql
-- Group Header
tblAssetGroup_H
  - assetgroup_h_id (PK)
  - org_id
  - branch_code
  - text (group name)
  - created_by, created_on
  - changed_by, changed_on

-- Group Details
tblAssetGroup_D
  - assetgroup_d_id (PK)
  - assetgroup_h_id (FK)
  - asset_id (FK)

-- Assets Table
tblAssets
  - asset_id (PK)
  - group_id (FK to tblAssetGroup_H.assetgroup_h_id)
  - asset_type_id
  - ... other fields
```

---

## Maintenance Scheduling

### Current Behavior

**⚠️ Important**: Maintenance schedules are generated **individually** for each asset, not as a group.

### How It Works

1. **Schedule Generation Process**:
   - The system iterates through asset types that require maintenance
   - For each asset type, it gets all assets (including those in groups)
   - Each asset is processed individually
   - When creating workflow maintenance schedules, `group_id` is **set to NULL**

2. **Code Location**:
   - **Controller**: `AssetLifecycleBackend/controllers/maintenanceScheduleController.js`
   - **Model**: `AssetLifecycleBackend/models/maintenanceScheduleModel.js`

### Key Code Snippet

```javascript
// From maintenanceScheduleController.js (lines 128-141)
const scheduleHeaderData = {
    wfamsh_id: wfamshId,
    at_main_freq_id: frequency.at_main_freq_id,
    maint_type_id: frequency.maint_type_id,
    asset_id: asset.asset_id,
    group_id: null,  // ⚠️ Always set to NULL
    vendor_id: asset.service_vendor_id,
    pl_sch_date: plannedScheduleDate,
    act_sch_date: null,
    status: 'IN',
    created_by: 'system',
    org_id: asset.org_id,
    branch_code: asset.branch_code
};
```

### Maintenance Schedule Tables

```sql
-- Workflow Maintenance Schedule Header
tblWFAssetMaintSch_H
  - wfamsh_id (PK)
  - asset_id (FK)
  - group_id (⚠️ Currently always NULL)
  - pl_sch_date (planned schedule date)
  - status ('IN', 'IP', 'CO', 'CA')
  - ... other fields

-- Regular Maintenance Schedule
tblAssetMaintSch
  - ams_id (PK)
  - asset_id (FK)
  - status ('IN', 'CO', 'CA')
  - act_maint_st_date
  - ... other fields
```

### Schedule Generation Flow

```
1. Get asset types requiring maintenance
2. For each asset type:
   a. Get all assets (including grouped assets)
   b. For each asset:
      - Check existing schedules
      - Calculate next maintenance date
      - Create workflow schedule (if workflow required)
      - Create direct schedule (if no workflow)
      - group_id = NULL (always)
```

### Example

If you have a group with 3 assets (ASSET001, ASSET002, ASSET003):

- **3 separate maintenance schedules** will be created
- Each schedule has its own `wfamsh_id`
- Each schedule has `group_id = NULL`
- Each asset is processed independently

---

## Notifications

### Current Behavior

Notifications are sent **per asset**, not per group.

### How It Works

1. **Notification Query**: 
   - Queries `tblWFAssetMaintSch_D` (workflow details)
   - Joins with assets to get asset information
   - Filters by user's job role
   - **No grouping by group_id**

2. **Code Location**:
   - **Model**: `AssetLifecycleBackend/models/notificationModel.js`

### Key Code Snippet

```javascript
// From notificationModel.js
// The query joins assets individually, not by group
SELECT 
  wfd.wfamsd_id,
  wfd.wfamsh_id,
  wfh.asset_id,  // Individual asset
  wfh.pl_sch_date,
  ...
FROM "tblWFAssetMaintSch_D" wfd
INNER JOIN "tblWFAssetMaintSch_H" wfh ON wfd.wfamsh_id = wfh.wfamsh_id
INNER JOIN "tblAssets" a ON wfh.asset_id = a.asset_id
WHERE wfd.status IN ('IN', 'IP', 'AP')
  AND wfh.status IN ('IN', 'IP')
```

### Notification Flow

```
1. User requests notifications
2. System queries maintenance schedules
3. For each schedule:
   - Checks user's job role
   - Checks if user has required permissions
   - Sends notification for that asset
4. Each asset in a group gets separate notifications
```

### Example

If 3 assets in a group require maintenance:
- User receives **3 separate notifications**
- Each notification is for a specific asset
- Notifications are not grouped together

---

## Workflow Processing

### Current Behavior

Workflow steps are executed **independently** for each asset.

### How It Works

1. **Workflow Steps**:
   - Each asset has its own workflow sequence
   - Workflow details are stored in `tblWFAssetMaintSch_D`
   - Each step can have multiple job roles assigned
   - Steps are processed sequentially per asset

2. **Code Location**:
   - **Model**: `AssetLifecycleBackend/models/approvalDetailModel.js`
   - **Model**: `AssetLifecycleBackend/models/maintenanceScheduleModel.js`

### Workflow Tables

```sql
-- Workflow Header
tblWFAssetMaintSch_H
  - wfamsh_id (PK)
  - asset_id (FK)
  - status ('IN', 'IP', 'CO', 'CA')
  - pl_sch_date

-- Workflow Details (Steps)
tblWFAssetMaintSch_D
  - wfamsd_id (PK)
  - wfamsh_id (FK)
  - job_role_id (FK)
  - sequence (step number)
  - status ('IN', 'IP', 'AP', 'UA', 'UR', 'CO')
  - notes
```

### Workflow Flow

```
For each asset in group:
  1. Create workflow header (wfamsh_id)
  2. Get workflow sequences for asset type
  3. For each sequence:
     - Get job roles for that step
     - Create workflow detail records
     - Send notifications to users with those roles
  4. Process approvals sequentially
  5. Complete workflow for that asset
```

### Example

Group with 3 assets:
- **3 separate workflow headers** (one per asset)
- **3 separate workflow processes** (independent)
- Each asset goes through its own approval steps
- No group-level coordination

---

## Key Findings

### 1. Group Assets Are Organizational Only

- Group assets are primarily for **organizational/management purposes**
- They help categorize and manage related assets
- They do **not** affect maintenance operations

### 2. Individual Processing

- Every maintenance operation treats assets individually
- `group_id` field exists in the schema but is **not actively used** in maintenance
- Maintenance schedules have `group_id = NULL` (always)

### 3. No Group-Level Features

Currently, there is **no**:
- Group-level maintenance scheduling
- Group-level notifications
- Group-level workflow processing
- Group-level maintenance history

### 4. Schema Support Exists

The database schema supports group assets:
- `tblAssets.group_id` field exists
- `tblWFAssetMaintSch_H.group_id` field exists
- But these fields are not populated during maintenance operations

---

## Recommendations

### For Current System

If you need group-level maintenance, you would need to:

1. **Modify Maintenance Schedule Generation**:
   ```javascript
   // In maintenanceScheduleController.js
   // Instead of:
   group_id: null,
   
   // Use:
   group_id: asset.group_id || null,
   ```

2. **Create Group-Level Maintenance Logic**:
   - Detect when all assets in a group need maintenance
   - Create a single workflow schedule for the group
   - Link all assets to the same `wfamsh_id`

3. **Update Notifications**:
   - Group notifications by `group_id`
   - Send consolidated notifications for group assets
   - Show "Group: X assets need maintenance"

4. **Add Group Maintenance History**:
   - Track maintenance history at group level
   - Show group-level maintenance reports
   - Aggregate maintenance costs per group

### Implementation Example

```javascript
// Pseudo-code for group-level maintenance
async function generateGroupMaintenanceSchedule(groupId) {
    // Get all assets in group
    const assets = await getAssetsInGroup(groupId);
    
    // Check if all assets need maintenance
    const assetsNeedingMaintenance = assets.filter(asset => 
        isMaintenanceDue(asset)
    );
    
    if (assetsNeedingMaintenance.length === assets.length) {
        // Create single workflow for group
        const wfamshId = await createWorkflowSchedule({
            group_id: groupId,
            asset_id: null, // Or use a representative asset
            // ... other fields
        });
        
        // Link all assets to this workflow
        await linkAssetsToWorkflow(wfamshId, assetsNeedingMaintenance);
    }
}
```

---

## Testing

A test script has been created to verify group asset maintenance behavior:

**File**: `AssetLifecycleBackend/test_group_asset_maintenance.js`

### Running the Test

```bash
cd AssetLifecycleBackend
node test_group_asset_maintenance.js
```

### What the Test Does

1. ✅ Creates a group asset with assets of the same type
2. ✅ Verifies `group_id` is set in assets
3. ✅ Triggers maintenance schedule generation
4. ✅ Checks maintenance schedules created
5. ✅ Verifies notifications for group assets
6. ✅ Checks workflow details
7. ✅ Generates summary report

---

## Conclusion

**Current State**: Group assets are treated as individual assets for all maintenance operations.

**Key Takeaway**: If you need group-level maintenance features, you will need to implement custom logic to:
- Detect group assets during maintenance scheduling
- Create group-level workflows
- Send group-level notifications
- Track group-level maintenance history

The database schema supports this, but the application logic currently does not utilize it.

---

## Related Files

- `AssetLifecycleBackend/controllers/assetGroupController.js` - Group creation
- `AssetLifecycleBackend/models/assetGroupModel.js` - Group model
- `AssetLifecycleBackend/controllers/maintenanceScheduleController.js` - Maintenance scheduling
- `AssetLifecycleBackend/models/maintenanceScheduleModel.js` - Maintenance model
- `AssetLifecycleBackend/models/notificationModel.js` - Notifications
- `AssetLifecycleBackend/models/approvalDetailModel.js` - Workflow processing

---

*Last Updated: Based on code analysis of the current system implementation*

