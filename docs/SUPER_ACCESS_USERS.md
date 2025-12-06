# Super Access Users - All Branch Access

This document explains how to configure users who can access all data across all branches, regardless of branch restrictions.

## Overview

By default, users can only view data from their assigned branch. However, you can configure specific users to have "super access" that allows them to view all data across all branches in the organization.

## ✅ CENTRALIZED IMPLEMENTATION

**The super access check is now AUTOMATICALLY applied in the authentication middleware!**

- The `hasSuperAccess` flag is automatically set in `req.user.hasSuperAccess` during authentication
- All you need to do is pass `req.user.hasSuperAccess` to your model functions
- No need to check `tblOrgSettings` in every API - it's done once in middleware

## Configuration

### Step 1: Add User to Super Access List

Use the provided script to add a user to the super access list:

```bash
node scripts/addSuperAccessUser.js <org_id> <user_id>
```

**Example:**
```bash
node scripts/addSuperAccessUser.js ORG001 USR001
```

This will:
- Create or update a setting in `tblOrgSettings` with key `super_access_users`
- The value is a comma-separated list of user_ids that have super access
- Multiple users can be added: `USR001,USR002,USR003`

### Step 2: Manual Configuration (Alternative)

You can also manually add the setting in `tblOrgSettings`:

```sql
INSERT INTO "tblOrgSettings" (os_id, org_id, key, value)
VALUES ('OS001', 'ORG001', 'super_access_users', 'USR001,USR002');
```

Or update existing:
```sql
UPDATE "tblOrgSettings" 
SET value = 'USR001,USR002,USR003' 
WHERE org_id = 'ORG001' AND key = 'super_access_users';
```

## Implementation in Code

### ✅ Automatic Implementation (Recommended)

The super access flag is **automatically set in `req.user.hasSuperAccess`** by the authentication middleware. Simply use it in your model functions:

**In Controllers:**
```javascript
const getAllAssets = async (req, res) => {
  const orgId = req.user.org_id;
  const branchId = req.user.branch_id;
  const hasSuperAccess = req.user.hasSuperAccess || false; // Automatically set by middleware
  
  // Pass hasSuperAccess to model - it will automatically skip branch filter if true
  const assets = await model.getAssetsByUserContext(orgId, branchId, req.db, hasSuperAccess);
  
  res.json(assets);
};
```

**In Models:**
```javascript
const getAssetsByUserContext = async (orgId, branchId, dbConnection, hasSuperAccess = false) => {
  let query = `SELECT * FROM "tblAssets" WHERE org_id = $1`;
  const params = [orgId];
  
  // Apply branch filter only if user doesn't have super access
  if (!hasSuperAccess && branchId) {
    query += ` AND branch_id = $2`;
    params.push(branchId);
  }
  // If hasSuperAccess is true, no branch filter = user sees all branches
  
  return await dbPool.query(query, params);
};
```

### Using the Helper Functions

For more complex queries, use the helper in `utils/branchFilterHelper.js`:

#### 1. Check if User Has Super Access

```javascript
const { hasSuperAccess } = require('../utils/branchAccessUtils');

const superAccess = await hasSuperAccess(userId, orgId);
if (superAccess) {
  // User can view all branches
}
```

#### 2. Build Branch Filter Condition

```javascript
const { buildBranchFilter } = require('../utils/branchAccessUtils');

const hasSuper = await hasSuperAccess(userId, orgId);
const filter = buildBranchFilter(userBranchId, hasSuper, 'a', 2);

// filter.condition = '' (if super access) or ' AND a.branch_id = $2' (if not)
// filter.params = [] (if super access) or [userBranchId] (if not)
// filter.nextParamIndex = 2 or 3

query += filter.condition;
params.push(...filter.params);
```

#### 3. Get User Branch Filter (Convenience Function)

```javascript
const { getUserBranchFilter } = require('../utils/branchAccessUtils');

const filter = await getUserBranchFilter(userId, orgId, userBranchId, 'a', 2);

query += filter.condition;
params.push(...filter.params);
```

### Example: Updating a Model Function

**Before:**
```javascript
const getAssetsByBranch = async (orgId, branchId) => {
  let query = `SELECT * FROM "tblAssets" WHERE org_id = $1`;
  const params = [orgId];
  
  if (branchId) {
    query += ` AND branch_id = $2`;
    params.push(branchId);
  }
  
  return await dbPool.query(query, params);
};
```

**After:**
```javascript
const { getUserBranchFilter } = require('../utils/branchAccessUtils');

const getAssetsByBranch = async (orgId, branchId, userId = null) => {
  let query = `SELECT * FROM "tblAssets" WHERE org_id = $1`;
  const params = [orgId];
  let paramIndex = 2;
  
  // Apply branch filter only if user doesn't have super access
  if (userId && branchId) {
    const filter = await getUserBranchFilter(userId, orgId, branchId, 'a', paramIndex);
    query += filter.condition;
    params.push(...filter.params);
    paramIndex = filter.nextParamIndex;
  } else if (branchId) {
    // Fallback: apply branch filter if no userId provided
    query += ` AND branch_id = $${paramIndex}`;
    params.push(branchId);
    paramIndex++;
  }
  
  return await dbPool.query(query, params);
};
```

### Example: In Controllers

```javascript
const getAllAssets = async (req, res) => {
  try {
    const orgId = req.user.org_id;
    const userId = req.user.user_id;
    const userBranchId = req.user.branch_id;
    
    // Get assets with branch filtering (respects super access)
    const assets = await assetModel.getAllAssetsByOrg(
      orgId, 
      userBranchId, 
      userId  // Pass userId to check super access
    );
    
    res.json({ success: true, data: assets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

## Key Points

1. **Super Access Check**: The system checks `tblOrgSettings` for key `super_access_users` or `all_branch_access_users`
2. **Value Format**: Comma-separated list of user_ids (e.g., `USR001,USR002,USR003`)
3. **Automatic Bypass**: When a user has super access, branch filters are automatically bypassed
4. **Backward Compatible**: Existing code without userId parameter will still work (applies branch filter)

## Where to Apply

Apply this pattern to any query that filters by `branch_id`:

- Asset queries
- Employee queries
- Department queries
- Maintenance queries
- Breakdown queries
- Report queries
- Any other branch-filtered data

## Testing

1. Add a user to super access list
2. Login as that user
3. Verify they can see data from all branches
4. Login as a regular user
5. Verify they only see their branch data

