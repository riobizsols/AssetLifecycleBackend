# 📋 Checklist Testing Guide

## Quick Testing Steps

### **Step 1: Verify Checklist in Database**

```sql
-- Check if checklist exists
SELECT * FROM "tblATMaintCheckList" 
WHERE asset_type_id = 'YOUR_ASSET_TYPE_ID' 
  AND org_id = 'ORG001';
```

**If no results**, you need to add checklist items first (see "Adding Checklist Items" section).

---

### **Step 2: Test via Checklist API**

```bash
# Get checklist for asset type
curl -X GET "http://localhost:4000/api/checklist/asset-type/ATYPE001" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    { "text": "Check motor bearings" },
    { "text": "Inspect motor windings" }
  ],
  "count": 2
}
```

---

### **Step 3: Test in Work Order**

```bash
# Get work order with checklist
curl -X GET "http://localhost:4000/api/work-orders/ams002" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Look for this in response:**
```json
{
  "data": {
    "asset_type": {
      "checklist_items": [
        { "text": "Check motor bearings" }
      ]
    }
  }
}
```

---

### **Step 4: Test Complete BF01 Flow**

1. **Create BF01 Breakdown**
   ```bash
   POST /api/reportbreakdown/create
   {
     "asset_id": "ASSET001",
     "atbrrc_id": "ATBRRC_001",
     "decision_code": "BF01",
     "description": "Motor failure"
   }
   ```

2. **Approve Workflow** (all approvers)

3. **Check Work Order**
   ```bash
   GET /api/work-orders/all
   ```
   
4. **Verify Response Includes:**
   - ✅ `wo_id` with breakdown info
   - ✅ `breakdown_info` object
   - ✅ `checklist_items` array in `asset_type`

---

## Testing with Postman

### Collection Setup

1. **Create Collection: "Checklist Tests"**

2. **Request 1: Get Checklist by Asset Type**
   - Method: GET
   - URL: `{{base_url}}/api/checklist/asset-type/{{asset_type_id}}`
   - Headers: `Authorization: Bearer {{token}}`

3. **Request 2: Get Work Order with Checklist**
   - Method: GET
   - URL: `{{base_url}}/api/work-orders/{{ams_id}}`
   - Headers: `Authorization: Bearer {{token}}`

4. **Test Script** (add to Request 2):
   ```javascript
   pm.test("Response has checklist", function() {
     var jsonData = pm.response.json();
     pm.expect(jsonData.data.asset_type.checklist_items).to.be.an('array');
   });
   
   pm.test("Checklist has items", function() {
     var jsonData = pm.response.json();
     pm.expect(jsonData.data.asset_type.checklist_items.length).to.be.above(0);
   });
   ```

---

## Testing with Frontend

### React/JavaScript Example

```javascript
// Fetch work order
const response = await fetch(`/api/work-orders/${amsId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

const workOrder = await response.json();

// Access checklist
const checklist = workOrder.data.asset_type?.checklist_items || [];

console.log('Checklist items:', checklist.length);
checklist.forEach((item, index) => {
  console.log(`${index + 1}. ${item.text}`);
});

// Display in UI
if (checklist.length > 0) {
  return (
    <div>
      <h3>Maintenance Checklist</h3>
      <ul>
        {checklist.map((item, index) => (
          <li key={index}>
            <input type="checkbox" id={`check-${index}`} />
            <label htmlFor={`check-${index}`}>{item.text}</label>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Automated Test Script

**Run the complete test:**
```bash
# 1. Update token and IDs in test_checklist_complete.js
# 2. Run test
node test_checklist_complete.js
```

**Expected Output:**
```
📋 TEST 1: Verify Checklist Exists
─────────────────────────────────────
✅ Status: 200
✅ Checklist items found: 3

📝 Checklist Items:
   1. Check motor bearings
   2. Inspect motor windings
   3. Test motor cooling system

📋 TEST 2: Get Checklist by Asset ID
─────────────────────────────────────
✅ Status: 200
✅ Checklist items: 3

📋 TEST 3: Verify Checklist in Work Order
─────────────────────────────────────
✅ Status: 200
✅ Work Order ID: ams002
✅ WO ID: WO-WFAMSH_06-ABR002-Motor_Failure
✅ Checklist included: 3 items

📝 Work Order Checklist:
   1. Check motor bearings
   2. Inspect motor windings
   3. Test motor cooling system

🔧 Breakdown Information:
   Reason: Motor Failure
   Description: Motor stopped working
   ABR ID: ABR002
```

---

## Troubleshooting

### Issue 1: Checklist is Empty

**Problem:** `checklist_items: []` or `null`

**Solutions:**

1. **Check if checklist exists:**
   ```sql
   SELECT COUNT(*) FROM "tblATMaintCheckList" 
   WHERE asset_type_id = 'ATYPE001';
   ```

2. **If count = 0, add checklist items** (see next section)

3. **Verify asset type ID matches:**
   ```sql
   SELECT a.asset_id, a.asset_type_id, at.text 
   FROM "tblAssets" a
   JOIN "tblAssetTypes" at ON a.asset_type_id = at.asset_type_id
   WHERE a.asset_id = 'ASSET001';
   ```

### Issue 2: Checklist Not Showing in Work Order

**Solutions:**

1. **Restart server:**
   ```bash
   pm2 restart all
   ```

2. **Clear cache:**
   - Browser: Ctrl+F5
   - Postman: Disable cache in settings

3. **Check SQL query includes checklist:**
   - Verify `workOrderModel.js` has checklist subquery
   - It should be there automatically

### Issue 3: Wrong Checklist Showing

**Problem:** Checklist from different asset type

**Solution:** Verify asset's asset_type_id:
```sql
SELECT ams.ams_id, ams.asset_id, a.asset_type_id
FROM "tblAssetMaintSch" ams
JOIN "tblAssets" a ON ams.asset_id = a.asset_id
WHERE ams.ams_id = 'ams002';
```

---

## Adding Checklist Items

If no checklist exists, add items to the database:

```sql
-- Insert checklist items
INSERT INTO "tblATMaintCheckList" (
  at_main_checklist_id,
  asset_type_id,
  text,
  at_main_freq_id,
  org_id
) VALUES
('CHECKLIST_001', 'ATYPE001', 'Check motor bearings', 'ATMF_001', 'ORG001'),
('CHECKLIST_002', 'ATYPE001', 'Inspect motor windings', 'ATMF_001', 'ORG001'),
('CHECKLIST_003', 'ATYPE001', 'Test motor cooling system', 'ATMF_001', 'ORG001'),
('CHECKLIST_004', 'ATYPE001', 'Clean air filters', 'ATMF_001', 'ORG001'),
('CHECKLIST_005', 'ATYPE001', 'Check electrical connections', 'ATMF_001', 'ORG001');
```

**Generate ID automatically:**
```sql
-- Get next ID
SELECT COALESCE(
  MAX(CAST(SUBSTRING(at_main_checklist_id FROM 11) AS INTEGER)),
  0
) + 1 as next_id
FROM "tblATMaintCheckList";

-- Use result in INSERT: CHECKLIST_XXX
```

---

## Verification Checklist

Use this to verify everything works:

- [ ] Checklist exists in `tblATMaintCheckList`
- [ ] Checklist API returns items: `/api/checklist/asset-type/{id}`
- [ ] Work order includes checklist: `/api/work-orders/{id}`
- [ ] Checklist items array is not empty
- [ ] Each item has `text` property
- [ ] Breakdown info also included in work order
- [ ] Frontend displays checklist properly

---

## Quick Test Commands

```bash
# 1. Check database
psql -U your_user -d your_db -c "SELECT * FROM \"tblATMaintCheckList\" LIMIT 5;"

# 2. Test API
curl http://localhost:4000/api/checklist/asset-type/ATYPE001 \
  -H "Authorization: Bearer TOKEN"

# 3. Test work order
curl http://localhost:4000/api/work-orders/ams002 \
  -H "Authorization: Bearer TOKEN" | jq '.data.asset_type.checklist_items'

# 4. Run automated test
node test_checklist_complete.js
```

---

## Expected Data Flow

```
1. Asset has asset_type_id
   ↓
2. tblATMaintCheckList has items for that asset_type_id
   ↓
3. Work order query joins:
   tblAssetMaintSch → tblAssets → tblATMaintCheckList
   ↓
4. Checklist automatically included in work order response
   ↓
5. Frontend displays checklist items
```

---

## Support

If checklist still not showing:

1. ✅ Verify checklist exists in database
2. ✅ Verify asset_type_id matches
3. ✅ Restart server
4. ✅ Clear all caches
5. ✅ Check server logs for errors
6. ✅ Run automated test script
7. ✅ Check if work order has correct asset_id

**All components are in place!** The checklist should work automatically. 🎯

