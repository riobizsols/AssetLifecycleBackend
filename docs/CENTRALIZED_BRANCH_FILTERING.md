# Centralized Branch Filtering with Super Access

## ✅ How It Works

**The super access check is AUTOMATICALLY done in the authentication middleware!**

1. **Middleware (`authMiddleware.js`)** automatically:
   - Checks `tblOrgSettings` for `super_access_users` key
   - Sets `req.user.hasSuperAccess = true/false` based on the setting
   - This happens ONCE per request, automatically

2. **In Your Code**: Simply use `req.user.hasSuperAccess` in models

## 🎯 Simple Pattern to Follow

### In Controllers:
```javascript
const getAllData = async (req, res) => {
  const orgId = req.user.org_id;
  const branchId = req.user.branch_id;
  const hasSuperAccess = req.user.hasSuperAccess || false; // ✅ Automatically set!
  
  const data = await model.getData(orgId, branchId, req.db, hasSuperAccess);
  res.json(data);
};
```

### In Models:
```javascript
const getData = async (orgId, branchId, dbConnection, hasSuperAccess = false) => {
  let query = `SELECT * FROM "tblData" WHERE org_id = $1`;
  const params = [orgId];
  
  // ✅ Simple check: if hasSuperAccess is true, skip branch filter
  if (!hasSuperAccess && branchId) {
    query += ` AND branch_id = $2`;
    params.push(branchId);
  }
  // If hasSuperAccess is true, user sees ALL branches (no filter)
  
  return await dbPool.query(query, params);
};
```

## 📋 Checklist for Updating Existing APIs

For each API that filters by branch:

1. ✅ Add `hasSuperAccess` parameter to model function
2. ✅ Pass `req.user.hasSuperAccess` from controller
3. ✅ Update WHERE clause: `if (!hasSuperAccess && branchId) { ... }`

That's it! No need to check `tblOrgSettings` - it's already done in middleware.

## 🔧 Helper Function (Optional)

For complex queries, use the helper:

```javascript
const { applyBranchFilter } = require('../utils/branchFilterHelper');

const { conditions, params } = applyBranchFilter({
  hasSuperAccess: req.user.hasSuperAccess,
  userBranchId: req.user.branch_id,
  tableAlias: 'a',
  paramIndex: 2,
  existingConditions: ['a.org_id = $1'],
  existingParams: [orgId]
});

const query = `SELECT * FROM "tblData" a WHERE ${conditions.join(' AND ')}`;
```

## 🎯 Key Points

- ✅ **One-time setup**: Add user to `tblOrgSettings` with key `super_access_users`
- ✅ **Automatic check**: Middleware sets `req.user.hasSuperAccess` automatically
- ✅ **Simple pattern**: Just check `!hasSuperAccess && branchId` before applying filter
- ✅ **Works everywhere**: Apply this pattern to ALL branch-filtered queries

## 📝 Example: Complete Update

**Before:**
```javascript
// Controller
const assets = await model.getAssets(orgId, branchId);

// Model
const getAssets = async (orgId, branchId) => {
  let query = `SELECT * FROM "tblAssets" WHERE org_id = $1`;
  if (branchId) {
    query += ` AND branch_id = $2`;
  }
  // ...
};
```

**After:**
```javascript
// Controller
const assets = await model.getAssets(orgId, branchId, req.db, req.user.hasSuperAccess);

// Model
const getAssets = async (orgId, branchId, dbConnection, hasSuperAccess = false) => {
  let query = `SELECT * FROM "tblAssets" WHERE org_id = $1`;
  if (!hasSuperAccess && branchId) {  // ✅ Only filter if no super access
    query += ` AND branch_id = $2`;
  }
  // ...
};
```

That's the only change needed! 🎉

