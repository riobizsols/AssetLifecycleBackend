# How Dynamic Subdomain Routing Works in Real-Time

## Overview

This document explains how the multi-tenant subdomain system works **dynamically** without requiring Nginx restarts or configuration changes when new tenants are created.

## Key Concept: No Configuration Needed for New Subdomains

✅ **Once Nginx is configured with `server_name *.riowebworks.net`, ALL subdomains work automatically!**

- No Nginx restart needed
- No configuration file changes
- No DNS changes (wildcard already covers all subdomains)
- Works in real-time as soon as:
  1. Organization record is created in database
  2. DNS propagation completes (only needed once for wildcard)

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User Browser                                                │
│  https://neworg.riowebworks.net                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS Request
                       │ Host: neworg.riowebworks.net
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Nginx (Port 443)                                            │
│  server_name *.riowebworks.net                              │
│  └─ Matches ANY subdomain automatically                      │
│  └─ Proxies to: http://localhost:5000/api/...               │
│  └─ Preserves Host header: neworg.riowebworks.net           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Proxy Request
                       │ Host: neworg.riowebworks.net
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Server (Port 5000)                                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ subdomainMiddleware.js                             │     │
│  │ 1. Extracts subdomain from req.headers.host       │     │
│  │    → "neworg"                                      │     │
│  │ 2. Queries database:                               │     │
│  │    SELECT org_id FROM tblOrgs                     │     │
│  │    WHERE subdomain = 'neworg'                      │     │
│  │ 3. Attaches to request:                            │     │
│  │    req.subdomain = "neworg"                        │     │
│  │    req.orgId = "123"                               │     │
│  └────────────────────────────────────────────────────┘     │
│                       │                                      │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────┐     │
│  │ authController.js (or any controller)              │     │
│  │ 1. Uses req.orgId to get tenant database           │     │
│  │ 2. Connects to correct database                    │     │
│  │ 3. Processes request                                │     │
│  │ 4. Returns response                                 │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step: What Happens When a New Tenant is Created

### Step 1: Tenant Registration

**User Action:** Fills out tenant setup form at `https://riowebworks.net/tenant-setup`

**Backend Process:**
```javascript
// tenantSetupService.js
1. Generate unique subdomain: "acmecorp"
2. Create organization record in database:
   INSERT INTO tblOrgs (org_name, subdomain, ...)
   VALUES ('Acme Corp', 'acmecorp', ...)
3. Return subdomain URL: "https://acmecorp.riowebworks.net"
```

**Result:** Organization exists in database with subdomain `acmecorp`

### Step 2: User Navigates to Subdomain

**User Action:** Clicks on or types `https://acmecorp.riowebworks.net`

**DNS Resolution:**
```
1. Browser queries DNS: "acmecorp.riowebworks.net"
2. GoDaddy DNS returns: 103.27.234.248 (wildcard A record)
3. Browser connects to server
```

**Note:** DNS propagation only needed once when wildcard is set up. After that, all subdomains resolve immediately.

### Step 3: Nginx Receives Request

**Nginx Configuration:**
```nginx
server {
    server_name *.riowebworks.net;  # Matches ANY subdomain
    ...
}
```

**What Happens:**
- Nginx receives request with `Host: acmecorp.riowebworks.net`
- `server_name *.riowebworks.net` **matches** (wildcard pattern)
- Nginx proxies to `http://localhost:5000`
- **Preserves Host header** in proxy request

**Key Point:** Nginx doesn't need to know about specific subdomains. The wildcard `*` matches everything!

### Step 4: Backend Extracts Subdomain

**subdomainMiddleware.js:**
```javascript
// Runs on EVERY request (app.use(subdomainMiddleware))
const hostname = req.headers.host;  // "acmecorp.riowebworks.net"
const subdomain = extractSubdomain(hostname);  // "acmecorp"

// Query database
const orgId = await getOrgIdFromSubdomain(subdomain);
// SELECT org_id FROM tblOrgs WHERE subdomain = 'acmecorp'

// Attach to request
req.subdomain = "acmecorp";
req.orgId = "org-123";
```

**Result:** Request now has `orgId` attached, ready for tenant-specific database connection.

### Step 5: Controller Uses Tenant Context

**authController.js (example):**
```javascript
async function login(req, res) {
  const orgId = req.orgId;  // From middleware
  
  // Get tenant database connection
  const tenantPool = await getTenantPool(orgId);
  
  // Query tenant-specific database
  const user = await tenantPool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  
  // Process login...
}
```

**Result:** User authenticates against their tenant's database.

---

## Why It Works in Real-Time

### 1. DNS Wildcard (One-Time Setup)

```
GoDaddy DNS:
* → 103.27.234.248

This means:
- acmecorp.riowebworks.net → 103.27.234.248 ✅
- neworg.riowebworks.net → 103.27.234.248 ✅
- anyname.riowebworks.net → 103.27.234.248 ✅
```

**No DNS changes needed** when creating new tenants!

### 2. Nginx Wildcard Configuration (One-Time Setup)

```nginx
server_name *.riowebworks.net;
```

**Matches all subdomains automatically!** No need to add each subdomain.

### 3. Database-Driven Subdomain Resolution

```javascript
// Middleware queries database on every request
SELECT org_id FROM tblOrgs WHERE subdomain = ?
```

**New tenant works immediately** after database record is created!

### 4. No Caching or Restart Required

- Nginx doesn't cache subdomain mappings
- Backend queries database fresh on each request
- No application restart needed

---

## Timeline: Creating a New Tenant

```
T+0s:   User submits tenant setup form
T+0s:   Backend creates org record with subdomain "neworg"
T+0s:   Backend returns URL: "https://neworg.riowebworks.net"
T+0s:   User clicks URL or types it in browser
T+1s:   DNS resolves (wildcard already configured)
T+1s:   Nginx receives request (wildcard matches)
T+1s:   Backend extracts subdomain from Host header
T+1s:   Backend queries database for org_id
T+1s:   Backend connects to tenant database
T+1s:   Application loads and works! ✅
```

**Total time: ~1 second** (no waiting for DNS propagation if wildcard already set up)

---

## Comparison: Static vs Dynamic Subdomain Setup

### ❌ Static Approach (NOT what we use)

```nginx
# Would need to add each subdomain manually
server {
    server_name acmecorp.riowebworks.net;
    ...
}

server {
    server_name neworg.riowebworks.net;
    ...
}

# Every new tenant requires:
# 1. Edit Nginx config
# 2. Reload Nginx
# 3. Add DNS record
```

### ✅ Dynamic Approach (What we use)

```nginx
# One configuration for all subdomains
server {
    server_name *.riowebworks.net;  # Matches everything!
    ...
}

# New tenant requires:
# 1. Create database record (automatic)
# 2. Done! ✅
```

---

## Testing Dynamic Subdomain Creation

### Test Script

```bash
# 1. Create a test organization via API
curl -X POST https://riowebworks.net/api/tenant-setup \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Test Corp",
    "adminEmail": "admin@testcorp.com",
    "adminPassword": "password123"
  }'

# Response will include:
# {
#   "subdomain": "test-corp",
#   "subdomainUrl": "https://test-corp.riowebworks.net"
# }

# 2. Immediately access the subdomain (no wait needed!)
curl https://test-corp.riowebworks.net

# 3. Should work immediately! ✅
```

---

## Key Components Summary

| Component | Role | Dynamic? |
|-----------|------|----------|
| **GoDaddy DNS** | Wildcard A record `* → IP` | ✅ One-time setup |
| **Nginx** | Wildcard `server_name *.domain` | ✅ One-time setup |
| **subdomainMiddleware** | Extract subdomain, query DB | ✅ Runs on every request |
| **Database** | Store org_id ↔ subdomain mapping | ✅ Updated when tenant created |
| **Backend Controllers** | Use `req.orgId` for tenant DB | ✅ Works automatically |

---

## Troubleshooting: Why a Subdomain Might Not Work

### Issue 1: DNS Not Resolving

**Check:**
```bash
nslookup neworg.riowebworks.net
# Should return: 103.27.234.248
```

**Fix:** Verify wildcard DNS record in GoDaddy

### Issue 2: Subdomain Not in Database

**Check:**
```sql
SELECT * FROM tblOrgs WHERE subdomain = 'neworg';
-- Should return a row
```

**Fix:** Verify tenant creation completed successfully

### Issue 3: Nginx Not Matching

**Check:**
```bash
sudo nginx -T | grep server_name
# Should show: server_name *.riowebworks.net
```

**Fix:** Verify Nginx configuration has wildcard

### Issue 4: Backend Not Extracting Subdomain

**Check backend logs:**
```
[SubdomainMiddleware] Subdomain: neworg, Org ID: org-123
```

**Fix:** Verify middleware is running and database connection works

---

## Best Practices

1. **Always use HTTPS** for production subdomains
2. **Validate subdomain format** when creating tenants (alphanumeric + hyphens)
3. **Handle subdomain conflicts** (already handled by `generateUniqueSubdomain`)
4. **Monitor database queries** for subdomain lookups (can be cached if needed)
5. **Log subdomain extraction** for debugging

---

## Performance Considerations

### Current Implementation

- **Database query on every request** to resolve subdomain → org_id
- **No caching** (simple and reliable)

### Optimization (Optional)

If you have many requests, you can add caching:

```javascript
// In subdomainMiddleware.js
const subdomainCache = new Map();

async function getOrgIdFromSubdomain(subdomain) {
  // Check cache first
  if (subdomainCache.has(subdomain)) {
    return subdomainCache.get(subdomain);
  }
  
  // Query database
  const orgId = await db.query(...);
  
  // Cache for 5 minutes
  subdomainCache.set(subdomain, orgId);
  setTimeout(() => subdomainCache.delete(subdomain), 5 * 60 * 1000);
  
  return orgId;
}
```

**Note:** Only add caching if you experience performance issues. Current implementation is simple and works well for most use cases.

---

## Summary

✅ **Dynamic subdomain routing works because:**
1. DNS wildcard covers all subdomains (one-time setup)
2. Nginx wildcard matches all subdomains (one-time setup)
3. Backend queries database on each request (real-time)
4. No configuration changes needed for new tenants
5. Works immediately after database record is created

**The system is fully dynamic and requires zero manual configuration for new tenants!** 🚀

