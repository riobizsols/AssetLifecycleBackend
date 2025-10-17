# Work Order API Testing Guide

## Issue Description

When calling `/api/work-orders/ams002`, it returns the same response as `/api/work-orders/all`.

## Expected Behavior

- `/api/work-orders/all` → Returns **array** of all work orders
- `/api/work-orders/ams002` → Returns **single object** for specific work order

## Current Routes Configuration

```javascript
// routes/workOrderRoutes.js
router.get('/all', protect, getAllWorkOrders);        // Specific route
router.get('/:id', protect, getWorkOrderById);        // Parameterized route
```

**Route order is CORRECT** - specific routes must come before parameterized routes.

## Testing Steps

### 1. Using cURL

**Test /all endpoint:**
```bash
curl -X GET "http://localhost:4000/api/work-orders/all" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Work orders with status 'IN' and maintained_by 'Vendor' retrieved successfully",
  "data": [
    {
      "ams_id": "ams001",
      "wo_id": "WO-WFAMSH_05-ABR001-Motor_Failure",
      "breakdown_info": { ... },
      "asset_type": {
        "checklist_items": [ ... ]
      }
    },
    {
      "ams_id": "ams002",
      ...
    }
  ],
  "count": 2
}
```

**Test /:id endpoint:**
```bash
curl -X GET "http://localhost:4000/api/work-orders/ams002" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Work order with status 'IN' and maintained_by 'Vendor' retrieved successfully",
  "data": {
    "ams_id": "ams002",
    "wo_id": "WO-WFAMSH_06-ABR002-Generator_Issue",
    "breakdown_info": {
      "abr_id": "ABR002",
      "breakdown_reason": "Generator Issue",
      "breakdown_description": "Generator not starting"
    },
    "asset_type": {
      "checklist_items": [
        { "text": "Check fuel level" },
        { "text": "Inspect starter motor" }
      ]
    }
  }
}
```

### 2. Using Postman

1. **Create New Request: Get All Work Orders**
   - Method: GET
   - URL: `http://localhost:4000/api/work-orders/all`
   - Headers: `Authorization: Bearer YOUR_JWT_TOKEN`
   - Send and verify you get an ARRAY

2. **Create New Request: Get Single Work Order**
   - Method: GET
   - URL: `http://localhost:4000/api/work-orders/ams002`
   - Headers: `Authorization: Bearer YOUR_JWT_TOKEN`
   - Send and verify you get a SINGLE OBJECT

### 3. Using Test Script

```bash
# Update TOKEN in test_workorder_routes.js first
node test_workorder_routes.js
```

## Debugging Steps

### Step 1: Check Server Logs

When you call each endpoint, check the console logs:

**For /all:**
```
Fetching all work orders with status "IN" and maintained_by "Vendor"...
Successfully fetched 2 work orders with status 'IN' and maintained_by 'Vendor'
```

**For /:id:**
```
Fetching work order with ID: ams002 with status 'IN' and maintained_by 'Vendor'
Successfully fetched work order with ID: ams002 with status 'IN' and maintained_by 'Vendor'
```

### Step 2: Verify Response Structure

**Check if /all returns:**
```javascript
{
  data: [ {...}, {...} ],  // ARRAY
  count: 2
}
```

**Check if /:id returns:**
```javascript
{
  data: { ... }  // SINGLE OBJECT (not array)
}
```

### Step 3: Clear Browser/Client Cache

If testing from browser/Postman:
1. Clear cache
2. Hard refresh (Ctrl+F5 or Cmd+Shift+R)
3. Try again

### Step 4: Restart Server

```bash
# Stop server
Ctrl+C

# Start again
npm start
# or
pm2 restart all
```

## Common Issues & Solutions

### Issue 1: Routes Not Registering

**Check server.js:**
```javascript
app.use("/api/work-orders", workOrderRoutes);
```

**Solution:** Ensure this line exists and server is restarted.

### Issue 2: Middleware Interfering

**Check if any middleware is caching responses:**
```javascript
// server.js - look for caching middleware
app.use(cors());
app.use(express.json());
```

**Solution:** Disable caching for API routes.

### Issue 3: Route Order Wrong

**Verify routes/workOrderRoutes.js:**
```javascript
// ✅ CORRECT ORDER
router.get('/all', protect, getAllWorkOrders);        // First
router.get('/:id', protect, getWorkOrderById);        // Last

// ❌ WRONG ORDER
router.get('/:id', protect, getWorkOrderById);        // Will match 'all' as ID
router.get('/all', protect, getAllWorkOrders);        // Never reached
```

**Current order is CORRECT** ✅

### Issue 4: Client-Side Caching

**Check frontend code:**
```javascript
// If using axios/fetch, check for caching
const response = await axios.get('/api/work-orders/ams002', {
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  }
});
```

## Response Differences

### /all Endpoint Response

```json
{
  "success": true,
  "data": [                    ← ARRAY
    { "ams_id": "ams001", ... },
    { "ams_id": "ams002", ... }
  ],
  "count": 2                   ← Has count
}
```

### /:id Endpoint Response

```json
{
  "success": true,
  "data": {                    ← SINGLE OBJECT
    "ams_id": "ams002",
    "wo_id": "...",
    "breakdown_info": { ... },
    "asset_type": {
      "checklist_items": [ ... ]
    }
  }
}
```

## Verification Checklist

- [ ] Server is running
- [ ] Routes are in correct order in workOrderRoutes.js
- [ ] Server has been restarted after code changes
- [ ] Browser/client cache is cleared
- [ ] Using correct JWT token
- [ ] Checking response structure (array vs object)
- [ ] Checking console logs for correct function calls
- [ ] Both endpoints return different console.log messages

## Quick Verification SQL

```sql
-- Check if work orders exist
SELECT ams_id, wo_id, asset_id, status, maintained_by
FROM "tblAssetMaintSch"
WHERE status = 'IN' AND maintained_by = 'Vendor'
ORDER BY created_on DESC;

-- If results show work orders, API should return them
```

## Expected API Behavior Summary

| Endpoint | Returns | Structure | Use Case |
|----------|---------|-----------|----------|
| `GET /api/work-orders/all` | All work orders | Array | List view, dashboard |
| `GET /api/work-orders/:id` | Single work order | Object | Detail view, print |

## Contact/Support

If the issue persists after following all debugging steps:

1. Check server logs for exact function being called
2. Add console.log in controller to verify which function runs
3. Test with different work order IDs
4. Check if database has work orders with status='IN' and maintained_by='Vendor'

## Updated Files

- ✅ `controllers/workOrderController.js` - Added breakdown_info to responses
- ✅ `models/workOrderModel.js` - Includes breakdown_info in queries
- ✅ `routes/workOrderRoutes.js` - Correct route order

All files are now updated and ready for testing! 🚀

