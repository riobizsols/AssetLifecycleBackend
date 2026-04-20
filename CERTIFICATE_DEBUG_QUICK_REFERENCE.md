# Quick Reference: Certificate Dropdown Debugging

## 🚀 One-Liner Diagnostic
```bash
node scripts/diagnose-certificate-dropdown.js
```

## 🔍 What to Look For

### In Browser Console (F12 → Console)
| Message | Status | Next Action |
|---------|--------|------------|
| `Certificate Response: {success: true, data: Array(N)}` | ✅ Working | Check dropdown displays options |
| `No certificates found in database` | ⚠️ Warning | Create certificates in Admin Settings |
| `Certificate data is not an array` | ❌ Error | Check API response format in DevTools Network tab |
| `Failed to fetch certificate options: Error 401` | ❌ Error | Log out → Log back in |
| `Failed to fetch certificate options: Error 500` | ❌ Error | Check backend console for [TechCertController] errors |

### In Backend Console
| Message | Meaning | Action |
|---------|---------|--------|
| `[TechCertController] GET /tech-certificates - orgId: ORG001` | ✅ Request received | Good! |
| `[TechCertController] Certificates found: 5` | ✅ Data retrieved | Good! Check frontend for rendering |
| `[TechCertController] Certificates found: 0` | ⚠️ No data | Create certificates or check org_id |
| `[TechCertController] Error in getAllCertificates:` | ❌ Server error | Read the full error message and stack trace |

### In DevTools Network Tab (F12 → Network)
| Status | Expected | Meaning |
|--------|----------|---------|
| 200 | ✅ | Success - Check response data in Preview tab |
| 401 | ❌ | Unauthorized - User not logged in or token expired |
| 403 | ❌ | Forbidden - User lacks permission to view certificates |
| 404 | ❌ | Not Found - API endpoint doesn't exist or route not registered |
| 500 | ❌ | Server Error - Backend crashed, check server logs |

## 🛠️ Common Fixes

### Dropdown is empty
```bash
# 1. Check database
node scripts/diagnose-certificate-dropdown.js

# 2. If "Total records: 0"
# → Create certificates in Admin Settings → Certifications

# 3. If records exist but dropdown empty
# → Check browser console (F12) for fetch errors
# → Hard refresh: Ctrl+F5
# → Check Network tab for API response
```

### Getting 401 error
```javascript
// Solution: Re-authenticate
// 1. Open app
// 2. Log out
// 3. Log back in
// 4. Try again
```

### API returns wrong data
```javascript
// Check response format in Network tab:
// CORRECT:
{ success: true, data: [{tech_cert_id, cert_name, cert_number}] }

// WRONG:
{ success: true, certificates: [...] }  // Should be 'data'
{ success: true, data: {...} }           // Should be [{...}]

// Fix: Update techCertController.js getAllCertificates() response
```

### Query returns 0 results but database has data
```sql
-- Check if org_id matches:
SELECT * FROM "tblTechCert";
-- Look at the org_id values

-- Check what org_id the user has:
-- (Check in admin user management page)

-- If different org_ids, either:
-- 1. Create certs for user's org
-- 2. Change user's org assignment
```

## 🔧 Emergency Fixes

### Clear all cache and try again
```javascript
// In browser console:
localStorage.clear();
sessionStorage.clear();
// Then refresh: Ctrl+F5
```

### Reset backend connection
```bash
# 1. Stop backend: Ctrl+C
# 2. Restart: npm start
```

### Check if server is running
```bash
# Frontend will fail silently if backend is down
# Check if you see this in browser console:
# 🔍 [Axios] Base URL configured as: http://localhost:5000/api

# If not, backend not running
# Start it: npm start (in AssetLifecycleBackend folder)
```

## 📋 Debug Checklist

- [ ] Backend is running (`npm start`)
- [ ] Database connection works (can access other pages)
- [ ] User is logged in (token in localStorage)
- [ ] Browser console shows request being sent to `/tech-certificates`
- [ ] Browser Network tab shows 200 response with certificate data
- [ ] Response data is an array with objects containing: tech_cert_id, cert_name
- [ ] Dropdown shows "Select Certificate" option
- [ ] Can select an option without error

## 🎯 Most Common Reason

**95% of cases:** No certificates exist in database for user's organization

**Solution:**
1. Go to Admin Settings → Certifications
2. Click + Add Certificate
3. Fill in details
4. Save
5. Go back to Technician Certificates page
6. Refresh browser (F5)
7. Try again

---

## 📞 Still Stuck?

Run this and share the output:
```bash
# Get all diagnostic info
echo "=== Diagnostic Output ===" && \
node scripts/diagnose-certificate-dropdown.js && \
echo "" && \
echo "=== Environment ===" && \
cat .env | grep -i "DATABASE\|NODE_ENV\|API" && \
echo "" && \
echo "=== Package Versions ===" && \
npm list express react axios 2>/dev/null | head -5
```

---

**Last Updated:** 2024  
**Status:** Ready for all team members  
**Print friendly:** Yes, fits on 1-2 pages
