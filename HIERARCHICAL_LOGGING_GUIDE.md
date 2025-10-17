# Hierarchical Logging - Complete Guide

## 🎯 What is Hierarchical Logging?

Hierarchical logging means **higher severity events are always logged**. When you set a log level, you get that level **AND all higher severity levels**.

---

## 📊 Visual Hierarchy

```
Severity: LOW ←──────────────────────────────────→ HIGH

         INFO  →  WARNING  →  ERROR  →  CRITICAL  →  NONE
         (0)      (1)         (2)        (3)          (4)
          ↓        ↓           ↓          ↓            ↓
       Success   Warnings   Errors   Catastrophic   Nothing
```

---

## 🔍 How It Works

### Log Level: INFO (0)
```
┌─────────────────────────────────────────┐
│ Configured Level: INFO (0)              │
├─────────────────────────────────────────┤
│                                         │
│  INFO      (0) ≥ 0  → ✅ LOGGED        │
│  WARNING   (1) ≥ 0  → ✅ LOGGED        │
│  ERROR     (2) ≥ 0  → ✅ LOGGED        │
│  CRITICAL  (3) ≥ 0  → ✅ LOGGED        │
│                                         │
│  Result: ALL EVENTS LOGGED              │
└─────────────────────────────────────────┘
```

### Log Level: WARNING (1)
```
┌─────────────────────────────────────────┐
│ Configured Level: WARNING (1)           │
├─────────────────────────────────────────┤
│                                         │
│  INFO      (0) ≥ 1  → ❌ NOT LOGGED    │
│  WARNING   (1) ≥ 1  → ✅ LOGGED        │
│  ERROR     (2) ≥ 1  → ✅ LOGGED        │
│  CRITICAL  (3) ≥ 1  → ✅ LOGGED        │
│                                         │
│  Result: SKIP INFO, LOG REST            │
└─────────────────────────────────────────┘
```

### Log Level: ERROR (2)
```
┌─────────────────────────────────────────┐
│ Configured Level: ERROR (2)             │
├─────────────────────────────────────────┤
│                                         │
│  INFO      (0) ≥ 2  → ❌ NOT LOGGED    │
│  WARNING   (1) ≥ 2  → ❌ NOT LOGGED    │
│  ERROR     (2) ≥ 2  → ✅ LOGGED        │
│  CRITICAL  (3) ≥ 2  → ✅ LOGGED        │
│                                         │
│  Result: ONLY ERRORS AND CRITICAL       │
└─────────────────────────────────────────┘
```

### Log Level: CRITICAL (3)
```
┌─────────────────────────────────────────┐
│ Configured Level: CRITICAL (3)          │
├─────────────────────────────────────────┤
│                                         │
│  INFO      (0) ≥ 3  → ❌ NOT LOGGED    │
│  WARNING   (1) ≥ 3  → ❌ NOT LOGGED    │
│  ERROR     (2) ≥ 3  → ❌ NOT LOGGED    │
│  CRITICAL  (3) ≥ 3  → ✅ LOGGED        │
│                                         │
│  Result: ONLY CRITICAL EVENTS           │
└─────────────────────────────────────────┘
```

### Log Level: NONE (4)
```
┌─────────────────────────────────────────┐
│ Configured Level: NONE (4)              │
├─────────────────────────────────────────┤
│                                         │
│  INFO      (0) ≥ 4  → ❌ NOT LOGGED    │
│  WARNING   (1) ≥ 4  → ❌ NOT LOGGED    │
│  ERROR     (2) ≥ 4  → ❌ NOT LOGGED    │
│  CRITICAL  (3) ≥ 4  → ❌ NOT LOGGED    │
│                                         │
│  Result: NOTHING LOGGED                 │
└─────────────────────────────────────────┘
```

---

## 📋 Practical Examples

### Example 1: Development Environment

**Set Level: INFO**
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'INFO' WHERE app_id = 'LOGIN';
```

**You Get:**
```csv
2025-10-16T10:00:00.000Z,INFO,LOGIN,AUTH,"User successfully logged in..."
2025-10-16T10:01:00.000Z,WARNING,LOGIN,AUTH,"User failed to login..."
2025-10-16T10:02:00.000Z,ERROR,API_CALL,API,"API request timeout..."
2025-10-16T10:03:00.000Z,CRITICAL,SYSTEM,AUTH,"Database completely down..."
```

**All 4 event types are logged** - Perfect for development!

---

### Example 2: Staging Environment

**Set Level: WARNING**
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'WARNING' WHERE app_id = 'LOGIN';
```

**You Get:**
```csv
2025-10-16T10:01:00.000Z,WARNING,LOGIN,AUTH,"User failed to login..."
2025-10-16T10:02:00.000Z,ERROR,API_CALL,API,"API request timeout..."
2025-10-16T10:03:00.000Z,CRITICAL,SYSTEM,AUTH,"Database completely down..."
```

**INFO filtered out, rest logged** - Good for staging!

---

### Example 3: Production Environment

**Set Level: ERROR**
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'ERROR' WHERE app_id = 'LOGIN';
```

**You Get:**
```csv
2025-10-16T10:03:00.000Z,CRITICAL,SYSTEM,AUTH,"Database completely down..."
```

**Only serious issues logged** - Perfect for production!

---

## 🧪 Real-World Test

### Test Scenario: User Login Flow

**Setup:**
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'INFO' WHERE app_id = 'LOGIN';
```

**Actions:**
1. User logs in successfully ✅
2. User tries wrong password ❌
3. Database goes down 🚨

**Log File:**
```csv
Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID
2025-10-16T10:00:00.123Z,INFO,LOGIN,AUTH,"User successfully logged in with email: user@test.com","{""email"":""user@test.com""}","{""success"":true}",150,USR001
2025-10-16T10:01:15.456Z,WARNING,LOGIN,AUTH,"User failed to login with email: user@test.com - Reason: Invalid credentials","{""email"":""user@test.com""}","{""success"":false,""error"":""Invalid credentials""}",75,USR001
2025-10-16T10:02:30.789Z,CRITICAL,SYSTEM_FAILURE,AUTH,"CRITICAL: System failure during login - connection refused","{""email"":""user@test.com""}","{""error"":""connection refused""}",5000,N/A
```

**All 3 events logged** because INFO level logs everything!

---

## 📊 Quick Comparison Table

| Event Severity | Log Level Setting | | | | |
|----------------|-------------------|---|---|---|---|
| | **INFO (0)** | **WARNING (1)** | **ERROR (2)** | **CRITICAL (3)** | **NONE (4)** |
| **INFO** | ✅ Logged | ❌ Filtered | ❌ Filtered | ❌ Filtered | ❌ Filtered |
| **WARNING** | ✅ Logged | ✅ Logged | ❌ Filtered | ❌ Filtered | ❌ Filtered |
| **ERROR** | ✅ Logged | ✅ Logged | ✅ Logged | ❌ Filtered | ❌ Filtered |
| **CRITICAL** | ✅ Logged | ✅ Logged | ✅ Logged | ✅ Logged | ❌ Filtered |

---

## 🎓 Use Cases by Environment

### Development Environment
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'INFO';
```
**Logs:** Everything (INFO, WARNING, ERROR, CRITICAL)  
**Purpose:** See all activity, debug issues, understand flow

### Testing/QA Environment
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'WARNING';
```
**Logs:** Warnings, Errors, Critical  
**Purpose:** Focus on problems, skip normal operations

### Production Environment
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'ERROR';
```
**Logs:** Only Errors and Critical  
**Purpose:** Minimize log volume, catch serious issues only

### Emergency/Troubleshooting
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'CRITICAL';
```
**Logs:** Only catastrophic failures  
**Purpose:** When system is overwhelmed, log only critical issues

### Disable Logging
```sql
UPDATE "tblTechnicalLogConfig" SET log_level = 'NONE';
```
**Logs:** Nothing  
**Purpose:** Performance optimization, disable logging completely

---

## 💡 Decision Guide

**"What log level should I use?"**

```
Are you developing/debugging?
  └─ YES → Use INFO (see everything)
  
Are you in production?
  ├─ Is disk space limited?
  │   └─ YES → Use ERROR or CRITICAL (minimize logs)
  │
  ├─ Do you need to monitor user issues?
  │   └─ YES → Use WARNING (see failed logins, warnings)
  │
  └─ Only care about system failures?
      └─ YES → Use ERROR (only serious issues)
```

---

## 🔢 The Math Behind It

```javascript
// Code in technicalLogConfigModel.js

const requiredLevel = getLogLevelCode(eventLevel);     // Event's severity
const configuredLevel = getLogLevelCode(config.log_level); // Your setting

return requiredLevel >= configuredLevel;  // Hierarchical check

// Examples:
// Event: WARNING (1), Config: INFO (0)
// 1 >= 0 → true → Log it! ✅

// Event: INFO (0), Config: WARNING (1)
// 0 >= 1 → false → Don't log ❌

// Event: CRITICAL (3), Config: ERROR (2)
// 3 >= 2 → true → Log it! ✅
```

---

## 📝 Summary Table

| If You Set | You Will See |
|------------|--------------|
| **INFO** | All events (100% of logs) |
| **WARNING** | ~75% of logs (skips INFO) |
| **ERROR** | ~25% of logs (only serious issues) |
| **CRITICAL** | ~5% of logs (only catastrophic failures) |
| **NONE** | 0% of logs (nothing) |

---

## 🚀 Best Practices

### 1. Start with INFO in Development
```sql
-- Development
UPDATE "tblTechnicalLogConfig" SET log_level = 'INFO';
```
See everything, understand the system.

### 2. Use WARNING in Testing
```sql
-- QA/Staging
UPDATE "tblTechnicalLogConfig" SET log_level = 'WARNING';
```
Focus on problems without info noise.

### 3. Use ERROR in Production
```sql
-- Production (default)
UPDATE "tblTechnicalLogConfig" SET log_level = 'ERROR';
```
Only log serious issues.

### 4. Switch to INFO When Debugging Production Issues
```sql
-- Temporarily for troubleshooting
UPDATE "tblTechnicalLogConfig" SET log_level = 'INFO';

-- After debugging, restore
UPDATE "tblTechnicalLogConfig" SET log_level = 'ERROR';
```

---

## ✅ Verification

Run this test to verify hierarchical logging:

```javascript
const TechnicalLogConfigModel = require('./models/technicalLogConfigModel');

async function verify() {
    // Set to INFO
    await updateConfig('INFO');
    
    // These should all return true (INFO logs everything)
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 0)); // INFO → true
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 1)); // WARNING → true
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 2)); // ERROR → true
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 3)); // CRITICAL → true
    
    // Set to ERROR
    await updateConfig('ERROR');
    
    // Only ERROR and CRITICAL should be true
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 0)); // INFO → false
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 1)); // WARNING → false
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 2)); // ERROR → true ✓
    console.log(await TechnicalLogConfigModel.shouldLog('LOGIN', 3)); // CRITICAL → true ✓
}
```

---

**Last Updated:** October 16, 2025  
**Logging Type:** Hierarchical ✅

