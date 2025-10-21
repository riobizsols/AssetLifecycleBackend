# Adding Event Logging to ALL ASSETS Operations

## 📋 Current Status

| Function | Logging Status | Priority |
|----------|----------------|----------|
| ✅ addAsset | Complete (9 steps) | High |
| ✅ getAllAssets | Complete | High |
| ✅ uploadAssetDoc | Complete (5 steps) | High |
| ⏳ updateAsset | **Needs logging** | **High** |
| ⏳ deleteAsset | **Needs logging** | **High** |
| ⏳ getAssetById | **Needs logging** | Medium |
| ⏳ searchAssets | **Needs logging** | Medium |
| ⏳ createAsset | **Needs logging** | High |
| ⏳ getAssetsByAssetType | **Needs logging** | Low |
| ⏳ getPrinterAssets | **Needs logging** | Low |
| ⏳ getAssetsByBranch | **Needs logging** | Low |
| ⏳ getAssetsByVendor | **Needs logging** | Low |
| ⏳ getAssetsByStatus | **Needs logging** | Low |
| ⏳ getAssetsWithFilters | **Needs logging** | Medium |
| ⏳ deleteMultipleAssets | **Needs logging** | High |
| ⏳ listDocs | **Needs logging** | Medium |
| ⏳ getDownloadUrl | **Needs logging** | Medium |
| ⏳ updateDocArchiveStatus | **Needs logging** | Medium |

---

## 🚀 Quick Implementation Pattern

### For Simple GET Operations (Read-only):

```javascript
const { logApiCall, logOperationSuccess, logOperationError } = require('../eventLoggers/assetEventLogger');

const getAssetById = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const { asset_id } = req.params;
  
  try {
    // Step 1: Log API called
    await logApiCall({
      operation: 'Get Asset By ID',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_id },
      userId
    });
    
    // Business logic
    const result = await model.getAssetById(asset_id);
    
    // Step 2: Log success
    await logOperationSuccess({
      operation: 'Get Asset By ID',
      requestData: { asset_id },
      responseData: { 
        found: result.rows.length > 0,
        asset_name: result.rows[0]?.text
      },
      duration: Date.now() - startTime,
      userId
    });
    
    res.json(result.rows[0]);
  } catch (err) {
    // Log error
    await logOperationError({
      operation: 'Get Asset By ID',
      requestData: { asset_id },
      error: err,
      duration: Date.now() - startTime,
      userId
    });
    
    res.status(500).json({ error: err.message });
  }
};
```

### For UPDATE Operations:

```javascript
const updateAsset = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const { asset_id } = req.params;
  
  try {
    // Step 1: Log API called
    await logApiCall({
      operation: 'Update Asset',
      method: req.method,
      url: req.originalUrl,
      requestData: {
        asset_id,
        updates: {
          text: req.body.text,
          branch_id: req.body.branch_id,
          current_status: req.body.current_status,
          // ... other fields being updated
        }
      },
      userId
    });
    
    // Business logic
    const result = await model.updateAsset(asset_id, req.body);
    
    // Step 2: Log success
    await logAssetUpdated({
      assetId: asset_id,
      assetName: req.body.text,
      userId,
      duration: Date.now() - startTime
    });
    
    res.json(result);
  } catch (err) {
    // Log error
    await logAssetUpdateError({
      assetId: asset_id,
      error: err,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({ error: err.message });
  }
};
```

### For DELETE Operations:

```javascript
const deleteAsset = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  const { asset_id } = req.params;
  
  try {
    // Step 1: Log API called
    await logApiCall({
      operation: 'Delete Asset',
      method: req.method,
      url: req.originalUrl,
      requestData: { asset_id },
      userId
    });
    
    // Business logic
    const result = await model.deleteAsset(asset_id);
    
    // Step 2: Log success
    await logAssetDeleted({
      assetId: asset_id,
      assetName: result.assetName,
      userId,
      duration: Date.now() - startTime
    });
    
    res.json({ message: 'Asset deleted successfully' });
  } catch (err) {
    // Log error
    await logAssetDeletionError({
      assetId: asset_id,
      error: err,
      userId,
      duration: Date.now() - startTime
    });
    
    res.status(500).json({ error: err.message });
  }
};
```

### For SEARCH Operations:

```javascript
const searchAssets = async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.user_id;
  
  try {
    // Log API called
    await logApiCall({
      operation: 'Search Assets',
      method: req.method,
      url: req.originalUrl,
      requestData: { 
        searchTerm: req.query.q,
        filters: req.query
      },
      userId
    });
    
    const result = await model.searchAssets(req.query);
    
    // Log success
    await logOperationSuccess({
      operation: 'Search Assets',
      requestData: { searchTerm: req.query.q },
      responseData: { count: result.length },
      duration: Date.now() - startTime,
      userId
    });
    
    res.json(result);
  } catch (err) {
    await logOperationError({
      operation: 'Search Assets',
      requestData: { searchTerm: req.query.q },
      error: err,
      duration: Date.now() - startTime,
      userId
    });
    
    res.status(500).json({ error: err.message });
  }
};
```

---

## 📝 Implementation Checklist

Copy this pattern to each function:

```javascript
// At the start of EVERY function
const startTime = Date.now();
const userId = req.user?.user_id;

try {
  // Step 1: Log API called
  await logApiCall({ operation, method, url, requestData, userId });
  
  // ... your business logic ...
  
  // Step 2: Log success
  await logOperationSuccess({ operation, requestData, responseData, duration, userId });
  
} catch (err) {
  // Log error
  await logOperationError({ operation, requestData, error: err, duration, userId });
}
```

---

## 🎯 Priority Implementation Order

### **Priority 1 (Critical Operations):**
1. ✅ `uploadAssetDoc` - Document upload (DONE)
2. `updateAsset` - Update asset
3. `deleteAsset` - Delete asset
4. `deleteMultipleAssets` - Bulk delete

### **Priority 2 (Frequently Used):**
5. `getAssetById` - View single asset
6. `searchAssets` - Search functionality
7. `getAssetsWithFilters` - Filtered view

### **Priority 3 (Less Critical):**
8. All other getAssets* functions
9. Document operations (listDocs, getDownloadUrl, etc.)

---

## 💡 Quick Script to Add Logging

Save this as a template for each function:

```javascript
// TEMPLATE: Add to any function

// 1. ADD AT START
const startTime = Date.now();
const userId = req.user?.user_id;

// 2. WRAP IN TRY
try {
  await logApiCall({
    operation: 'OPERATION_NAME',
    method: req.method,
    url: req.originalUrl,
    requestData: { /* relevant params */ },
    userId
  });
  
  // ... existing code ...
  
  await logOperationSuccess({
    operation: 'OPERATION_NAME',
    requestData: { /* what was sent */ },
    responseData: { /* what was returned */ },
    duration: Date.now() - startTime,
    userId
  });
  
} catch (err) {
  await logOperationError({
    operation: 'OPERATION_NAME',
    requestData: { /* what was attempted */ },
    error: err,
    duration: Date.now() - startTime,
    userId
  });
  
  // ... existing error handling ...
}
```

---

## 📊 Expected Log Output

Once all operations have logging, your `events_ASSETS_2025-10-17.csv` will show:

```csv
10:00:00.123,INFO,API_CALL,AssetController,"GET /api/assets/AST001 - Get Asset By ID"
10:00:00.234,INFO,ASSET_OPERATION,AssetController,"Get Asset By ID completed successfully"

10:01:15.456,INFO,API_CALL,AssetController,"PUT /api/assets/AST001 - Update Asset"
10:01:15.567,INFO,ASSET_UPDATE,AssetController,"Asset updated successfully - Dell Laptop"

10:02:30.789,INFO,API_CALL,AssetDocsController,"POST /api/assets/AST001/docs/upload - Document upload"
10:02:30.890,INFO,FILE_UPLOAD,AssetDocsController,"Uploading file to MinIO storage"
10:02:31.123,INFO,FILE_UPLOAD,AssetDocsController,"File uploaded to MinIO successfully"
10:02:31.234,INFO,DB_QUERY,AssetDocsController,"Inserting document metadata to database"
10:02:31.345,INFO,DOCUMENT_UPLOAD,AssetDocsController,"Document uploaded successfully - invoice.pdf"

10:03:45.678,INFO,API_CALL,AssetController,"DELETE /api/assets/AST001 - Delete Asset"
10:03:45.789,INFO,ASSET_DELETE,AssetController,"Asset deleted successfully - AST001"
```

---

## ✅ Benefits

Once logging is added to ALL operations:

✅ **Complete visibility** - Every API call is logged  
✅ **Easy debugging** - See exactly what was called and what failed  
✅ **Performance monitoring** - Track slow operations  
✅ **User activity tracking** - Know who did what and when  
✅ **Data audit trail** - See data sent and received  
✅ **Security monitoring** - Track suspicious activities  

---

## 🔧 Next Steps

1. Apply the pattern to remaining 15+ functions
2. Test each operation from the frontend
3. Verify logs appear in `events_ASSETS_2025-10-17.csv`
4. Adjust log level as needed (INFO for dev, ERROR for prod)

---

**Quick Start:** Copy the template above and apply it to each function in `assetController.js` and `assetDocsController.js`!

