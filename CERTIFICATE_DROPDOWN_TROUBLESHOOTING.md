# Certificate Dropdown Empty - Troubleshooting Guide

## Problem
The "Select Certificate" dropdown in the Technician Certificates page is empty, even though you know certificates exist in the database.

## Root Causes
This issue can happen for 3 main reasons:
1. **No certificates exist in the database** for your organization
2. **API call is failing** but errors are hidden
3. **Data filtering** is removing all results (org_id mismatch)

## Troubleshooting Steps

### Step 1: Check Database Has Data
```bash
# Run this diagnostic script to check the database:
node scripts/diagnose-certificate-dropdown.js
```

**What to look for in the output:**
- ✅ "Table tblTechCert exists" = Table is set up correctly
- ✅ "Total records in tblTechCert: N" = Database has certificate data
- ❌ "NO CERTIFICATES FOUND" = Database is empty

**If database is empty:**
1. Go to **Admin Settings → Certifications**
2. Click **+ Add Certificate**
3. Create at least one certificate (name, number, etc.)
4. Return to **Technician Certificates** page
5. Refresh the browser (Ctrl+F5)
6. Try again

### Step 2: Check Browser Console for Errors
1. Open the Technician Certificates page
2. Press **F12** to open Developer Tools
3. Click **Console** tab
4. Look for messages starting with:
   - `🔍 [Axios] Request URL:` - Shows the API being called
   - `Certificate Response:` - Shows the raw response
   - `Processed Certificate Data:` - Shows formatted data
   - `Failed to fetch certificate options:` - Shows error details

**Expected console output (if working):**
```
🔍 [Axios] Request URL: http://localhost:3000/api/tech-certificates
Certificate Response: {success: true, data: Array(5), count: 5}
Processed Certificate Data: Array(5)
```

**Common errors:**
```
Certificate data is not an array

→ The API response format is wrong. Check backend response structure.
```

```
Failed to fetch certificate options: Error 401

→ Authentication failed. User might not have permission or token expired.
→ Solution: Log out and log back in.
```

```
Failed to fetch certificate options: Error 404

→ The API endpoint doesn't exist. Backend might not be running.
→ Solution: Restart the backend server and check routes/certification.js
```

```
Failed to fetch certificate options: Error 500

→ Server error. Check the backend console for what went wrong.
→ Solution: Restart backend and check logs for errors.
```

### Step 3: Verify API Response Format
In browser console, after you see "Certificate Response:", expand it and check:

**Correct format:**
```javascript
{
  success: true,
  data: [
    { 
      tech_cert_id: "CERT001", 
      cert_name: "AWS Solutions Architect",
      cert_number: "AWS-123456"
    },
    { 
      tech_cert_id: "CERT002", 
      cert_name: "Azure Administrator",
      cert_number: "AZ-900"
    }
  ],
  count: 2
}
```

**Wrong format examples:**
```javascript
// ❌ Missing 'data' wrapper
{
  success: true,
  certificates: [...]  // Should be 'data'
}

// ❌ Data is not an array  
{
  success: true,
  data: { tech_cert_id: "CERT001" }  // Should be [...]
}

// ❌ Wrong property names
{
  success: true,
  data: [
    { id: "CERT001", name: "AWS" }  // Should be tech_cert_id, cert_name
  ]
}
```

If the format is wrong, check [controllers/techCertController.js](../controllers/techCertController.js) `getAllCertificates()` function.

### Step 4: Check Network Activity
1. Open DevTools → **Network** tab
2. Refresh the page
3. Look for request to `/tech-certificates` or `/api/tech-certificates`
4. Click on it to see:
   - **Status:** Should be 200 (green)
   - **Response:** Should show the JSON with certificate data
   - **Headers:** Should include `Authorization: Bearer <token>`

**Status Code Reference:**
| Status | Meaning | Solution |
|--------|---------|----------|
| 200 | Success | Data should appear in dropdown |
| 401 | Unauthorized | Log out and log back in |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | API endpoint missing |
| 500 | Server Error | Check backend logs |

### Step 5: Check Backend Logs
Run the backend server and watch the console when you access the Technician Certificates page:

**Expected log output:**
```
[TechCertController] GET /tech-certificates - orgId: ORG001
[TechCertController] Certificates found: 5
[TechCertController] Returning certificates for org: ORG001
```

**Error log output:**
```
[TechCertController] Error in getAllCertificates: ENOENT
[TechCertController] Stack: Error: Database connection failed...
```

### Step 6: Verify Org_ID Matching
The certificates are filtered by your organization. Ensure:

1. Run the diagnostic script again and check **"org_id filtering"** section:
   ```bash
   node scripts/diagnose-certificate-dropdown.js
   ```
   
   Look for output like:
   ```
   ✅ Certificates distributed across 1 organization(s):
      • org_id: ORG001
   ```

2. Make sure your user account belongs to the same org as the certificates

3. If you see different org_ids, you may need to move certificates or adjust user org assignment

### Step 7: Browser Cache Issues
If you've already tried these steps, the browser cache might be stale:

1. **Hard refresh:** Ctrl+F5 (or Cmd+Shift+R on Mac)
2. **Clear cache:** DevTools → Application → Clear Storage → All
3. **Incognito mode:** Test in a private/incognito window
4. **Different browser:** Try Chrome, Firefox, or Edge

## Complete Debugging Flow

### If dropdown is empty:
```
1. Run: node scripts/diagnose-certificate-dropdown.js
   ├─ Do you see "Total records: 0"?
   │  ├─ YES → Create certificates in Admin Settings
   │  └─ NO → Continue to step 2
   │
2. Open browser console (F12)
   ├─ See "Certificate Response" logged?
   │  ├─ YES → Check format of response.data
   │  └─ NO → API call failed (see "Failed to fetch" error)
   │
3. Check Network tab
   ├─ /tech-certificates request returning 200?
   │  ├─ YES → Check Response for correct data format/size
   │  └─ NO → Use status code table above for solution
   │
4. Check backend console
   ├─ See [TechCertController] logs?
   │  ├─ YES → Check "Certificates found" count
   │  └─ NO → API route might not be registered
```

## Common Solutions

### 1. Empty Database
**Symptom:** "NO CERTIFICATES FOUND" in diagnostic output
```bash
# Solution: Create certificates via Admin UI or SQL
INSERT INTO "tblTechCert" (certificate_name, certificate_no, org_id)
VALUES ('AWS Solutions Architect', 'AWS-SA-001', 'ORG001');
```

### 2. Wrong Column Names
**Symptom:** Dropdown shows empty options despite data in database
**Solution:** Update [models/techCertModel.js](../models/techCertModel.js) to match your actual column names:
```javascript
// Find this in getTechCertColumns():
const columnMapping = {
  'tc_id': 'tech_cert_id',              // Adjust these
  'cert_name': 'cert_name',              // to match your
  'cert_number': 'cert_number'           // actual columns
};
```

### 3. Authentication Token Expired
**Symptom:** 401 errors in Network tab
```javascript
// Solution: Log out and log back in
// Or manually clear localStorage and refresh
localStorage.removeItem('auth'); // If your auth store uses this
```

### 4. CORS Errors
**Symptom:** API call blocked, console shows CORS error
```javascript
// Backend should already allow this, but check:
// app.use(cors()); in server.js
// And ALLOWED_ORIGINS in your env
```

### 5. API Endpoint Not Responding
**Symptom:** 404 error in Network tab
**Solution:** Verify route is registered in [routes/certification.js](../routes/certification.js):
```javascript
// Should have:
router.get('/tech-certificates', authenticate, techCertController.getAllCertificates);
```

## Testing Checklist

After fixing the issue, verify:

- [ ] Diagnostic script shows ✅ Table exists
- [ ] Diagnostic script shows ✅ Total records > 0
- [ ] Browser console shows "Certificate Response:" with data array
- [ ] Network tab shows 200 status for /tech-certificates request
- [ ] Dropdown shows certificate names in the select field
- [ ] Can select a certificate and upload successfully
- [ ] Uploaded record appears in the list below

## Emergency Commands

**Reset everything (caution - deletes data):**
```bash
# 1. Stop the backend server
# 2. Delete all certificate records:
psql -U postgres -d asset_lifecycle -c "DELETE FROM \"tblTechCert\";"

# 3. Restart backend
npm start

# 4. Create certificates in Admin Settings
```

**Restart just the services:**
```bash
# Backend
npm start

# Frontend (if needed)
npm run dev
```

## Still Having Issues?

Collect this information and share for support:

1. **Output from diagnostic script:**
   ```bash
   node scripts/diagnose-certificate-dropdown.js 2>&1 | tee diagnostic-output.txt
   ```

2. **Browser console logs** (scroll to see all messages):
   - Screenshot or copy the entire console output

3. **Network tab response:**
   - Right-click the /tech-certificates request → Copy as cURL
   - Paste the cURL command

4. **Backend server logs:**
   - Stop server and run with: `NODE_ENV=development npm start`
   - Look for [TechCertController] messages

5. **Database query output:**
   ```sql
   SELECT * FROM "tblTechCert" LIMIT 5;
   SELECT DISTINCT org_id FROM "tblTechCert";
   ```
