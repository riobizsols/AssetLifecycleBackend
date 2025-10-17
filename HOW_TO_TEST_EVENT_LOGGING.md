# How to Test Event Logging - Quick Guide

## Testing Different Log Levels for LOGIN

### Current Status
- **App ID:** `LOGIN`
- **Current Log Level:** Check with query below
- **Log File Location:** `logs/events/events_YYYY-MM-DD.csv`

---

## 1. Check Current Log Level

```sql
SELECT app_id, log_level, enabled 
FROM "tblTechnicalLogConfig" 
WHERE app_id = 'LOGIN';
```

---

## 2. Change Log Level

### Set to INFO (logs only successful logins)
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'INFO' 
WHERE app_id = 'LOGIN';
```

### Set to WARNING (logs only failed logins)
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'WARNING' 
WHERE app_id = 'LOGIN';
```

### Set to ERROR (logs only system errors during login)
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'ERROR' 
WHERE app_id = 'LOGIN';
```

### Set to NONE (disables all logging)
```sql
UPDATE "tblTechnicalLogConfig" 
SET log_level = 'NONE' 
WHERE app_id = 'LOGIN';
```

---

## 3. Test Scenarios

### A. Testing INFO Level
**Set log level to INFO, then:**

1. ✅ **Try successful login** (valid credentials)
   - **Expected:** Logged as INFO
   - **Message:** "User successfully logged in with email: ..."

2. ✅ **Try failed login** (wrong password)
   - **Expected:** Logged as WARNING
   - **Message:** "User failed to login - Reason: Invalid credentials"

3. ✅ **Cause system error** (database down)
   - **Expected:** Logged as CRITICAL
   - **Message:** "CRITICAL: System failure during login"

**Result:** ALL 3 entries logged (INFO logs everything)

---

### B. Testing WARNING Level
**Set log level to WARNING, then:**

1. ❌ **Try successful login** (valid credentials)
   - **Expected:** NOT logged (INFO event, INFO < WARNING)

2. ✅ **Try failed login** (wrong password)
   - **Expected:** Logged as WARNING
   - **Message:** "User failed to login with email: ... - Reason: Invalid credentials"

3. ✅ **Try with non-existent user**
   - **Expected:** Logged as WARNING
   - **Message:** "User failed to login with email: ... - Reason: User not found"

4. ✅ **Cause system error** (database down)
   - **Expected:** Logged as CRITICAL (CRITICAL >= WARNING)
   - **Message:** "CRITICAL: System failure during login"

**Result:** 3 entries logged (failed logins + system errors, but NOT successful logins)

---

### C. Testing ERROR Level
**Set log level to ERROR, then:**

1. ❌ **Try successful login** (valid credentials)
   - **Expected:** NOT logged (INFO < ERROR)

2. ❌ **Try failed login** (wrong password)
   - **Expected:** NOT logged (WARNING < ERROR)

3. ✅ **Cause system error** (stop database, then try to login)
   - **Expected:** Logged as CRITICAL (CRITICAL >= ERROR)
   - **Message:** "CRITICAL: System failure during login"

**Result:** Only CRITICAL events logged (system errors). INFO and WARNING are filtered out.

---

### D. Testing CRITICAL Level
**Set log level to CRITICAL, then:**

1. ❌ **Try successful login** (valid credentials)
   - **Expected:** NOT logged (INFO event, but level is CRITICAL)

2. ❌ **Try failed login** (wrong password)
   - **Expected:** NOT logged (WARNING event, but level is CRITICAL)

3. ❌ **Cause system error** (database timeout)
   - **Expected:** NOT logged (ERROR event, but level is CRITICAL)

4. ✅ **Cause CRITICAL system failure**
   - **Option A:** Stop database completely, then try to login
   - **Option B:** Remove JWT_SECRET from env, restart server, try to login
   - **Option C:** Temporarily add `throw new Error('Test')` in login function
   - **Expected:** Logged as CRITICAL
   - **Message:** "CRITICAL: System failure during login - ..."

**Result:** Only catastrophic system failures are logged

---

### E. Trigger CRITICAL Event Test

**Method 1: Stop Database**
```bash
# Windows
net stop postgresql-x64-14

# Linux
sudo systemctl stop postgresql

# Try to login
# Check log file for CRITICAL entry
```

**Method 2: Invalid JWT_SECRET**
```javascript
// In server startup, temporarily add:
if (!process.env.JWT_SECRET) {
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'SYSTEM_FAILURE',
        module: 'AUTH',
        message: 'CRITICAL: JWT_SECRET not configured',
        logLevel: 'CRITICAL',
        userId: 'SYSTEM'
    });
}
```

**Method 3: Force Exception**
```javascript
// In authController.js login function, add at the start:
if (email === 'test-critical@example.com') {
    throw new Error('Forced CRITICAL error for testing');
}
```

See `CRITICAL_EVENT_EXAMPLES.md` for more scenarios.

---

## 4. How to Manually Test

### From Frontend (Real Login)
```bash
# 1. Start backend server
cd AssetLifecycleManagementBackend
npm start

# 2. Start frontend
cd ../AssetLifecycleManagementFrontend
npm run dev

# 3. Try logging in with different scenarios
```

### Using cURL (Direct API Call)
```bash
# Successful login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"correctpassword"}'

# Failed login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"wrongpassword"}'
```

### Using Postman
1. Create POST request to `http://localhost:4000/api/auth/login`
2. Set Body (JSON):
   ```json
   {
     "email": "your@email.com",
     "password": "yourpassword"
   }
   ```
3. Send request
4. Check log file: `logs/events/events_2025-10-16.csv`

---

## 5. View Log File

### Windows
```powershell
# View latest log file
Get-Content logs\events\events_$(Get-Date -Format "yyyy-MM-dd").csv

# Watch log file in real-time (like tail -f)
Get-Content logs\events\events_$(Get-Date -Format "yyyy-MM-dd").csv -Wait
```

### Linux/Mac
```bash
# View latest log file
cat logs/events/events_$(date +%Y-%m-%d).csv

# Watch log file in real-time
tail -f logs/events/events_$(date +%Y-%m-%d).csv
```

---

## 6. Quick Test Script

Create `test_login_levels.js`:

```javascript
const axios = require('axios');

async function testLoginLevels() {
    const baseURL = 'http://localhost:4000';
    
    try {
        // Test successful login
        console.log('Testing successful login...');
        await axios.post(`${baseURL}/api/auth/login`, {
            email: 'your@email.com',
            password: 'correctpassword'
        });
        console.log('✅ Success');
    } catch (error) {
        console.log('❌ Failed:', error.response?.data?.message);
    }
    
    try {
        // Test failed login
        console.log('\nTesting failed login...');
        await axios.post(`${baseURL}/api/auth/login`, {
            email: 'your@email.com',
            password: 'wrongpassword'
        });
    } catch (error) {
        console.log('✅ Expected failure:', error.response?.data?.message);
    }
    
    console.log('\n✅ Check logs/events/events_YYYY-MM-DD.csv for results');
}

testLoginLevels();
```

Run with: `node test_login_levels.js`

---

## 7. Understanding Log Levels (Hierarchical)

| Log Level | Code | What Gets Logged | Use Case |
|-----------|------|------------------|----------|
| **INFO** | 0 | INFO + WARNING + ERROR + CRITICAL | Development, debugging (see everything) |
| **WARNING** | 1 | WARNING + ERROR + CRITICAL | Staging, QA testing |
| **ERROR** | 2 | ERROR + CRITICAL | Production (only serious issues) |
| **CRITICAL** | 3 | CRITICAL only | Emergency mode (only catastrophic failures) |
| **NONE** | 4 | Nothing logged | Disable logging completely |

**Hierarchical means:** Higher severity levels are always logged. If you set WARNING, you get WARNING + ERROR + CRITICAL.

---

## 8. Troubleshooting

### Logs not appearing?
1. Check if logging is enabled:
   ```sql
   SELECT * FROM "tblTechnicalLogConfig" WHERE app_id = 'LOGIN';
   ```
2. Verify `enabled = true`
3. Check if `logs/events/` directory exists
4. Verify event level matches configured log level

### Wrong events being logged?
- Remember: Hierarchical logging
- INFO level = Logs INFO + WARNING + ERROR + CRITICAL (everything)
- WARNING level = Logs WARNING + ERROR + CRITICAL (skips INFO)
- ERROR level = Logs ERROR + CRITICAL (skips INFO and WARNING)

---

## Quick Reference

```bash
# Change to INFO (log successful logins only)
psql -d your_db -c "UPDATE \"tblTechnicalLogConfig\" SET log_level = 'INFO' WHERE app_id = 'LOGIN';"

# Change to WARNING (log failed logins only)  
psql -d your_db -c "UPDATE \"tblTechnicalLogConfig\" SET log_level = 'WARNING' WHERE app_id = 'LOGIN';"

# Change to ERROR (log system errors only)
psql -d your_db -c "UPDATE \"tblTechnicalLogConfig\" SET log_level = 'ERROR' WHERE app_id = 'LOGIN';"

# Disable logging
psql -d your_db -c "UPDATE \"tblTechnicalLogConfig\" SET log_level = 'NONE' WHERE app_id = 'LOGIN';"

# View today's logs
cat logs/events/events_$(date +%Y-%m-%d).csv
```

