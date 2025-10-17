# Event Loggers - Centralized Logging Architecture

## 📁 Folder Purpose

This folder contains **dedicated event logging files** for each controller. All logging logic is centralized here, keeping controllers clean and maintainable.

---

## 🏗️ Architecture

```
AssetLifecycleManagementBackend/
│
├── eventLoggers/              ← Logging logic (WHAT to log, WHEN, and HOW)
│   ├── authEventLogger.js     ← All auth/login logging
│   ├── assetEventLogger.js    ← All asset logging
│   └── ...more as needed
│
├── controllers/               ← Business logic (clean, no logging clutter)
│   ├── authController.js      ← Just calls AuthEventLogger methods
│   └── assetController.js     ← Just calls AssetEventLogger methods
│
└── services/
    └── eventLogger.js         ← Core CSV writing (HOW files are written)
```

---

## ✨ Benefits

### Before (Messy):
```javascript
// In controller - cluttered with logging logic (12 lines!)
if (!user) {
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'LOGIN',
        module: 'AUTH',
        message: 'User failed to login',
        logLevel: 'WARNING',
        requestData: { email },
        responseData: { success: false, error: 'User not found' },
        duration: Date.now() - startTime,
        userId: null
    });
    return res.status(404).json({ message: 'User not found' });
}
```

### After (Clean):
```javascript
// In controller - clean and readable (3 lines!)
if (!user) {
    await logFailedLogin({ email, reason: 'User not found', duration: Date.now() - startTime });
    return res.status(404).json({ message: 'User not found' });
}
```

### Why Functions Instead of Classes?

**We use simple exported functions, NOT classes:**

```javascript
✅ GOOD (Functions):
const { logSuccessfulLogin, logFailedLogin } = require('../eventLoggers/authEventLogger');
await logSuccessfulLogin({ email, userId, duration });

❌ BAD (Class with static methods):
const AuthEventLogger = require('../eventLoggers/authEventLogger');
await AuthEventLogger.logSuccessfulLogin({ email, userId, duration });
```

**Reasons:**
- **Simpler**: No need for class syntax when not using instances
- **Cleaner imports**: Destructure only what you need
- **More JavaScript-like**: Functions are first-class citizens
- **Less typing**: `logFailedLogin()` vs `AuthEventLogger.logFailedLogin()`
- **No overhead**: No class instantiation or inheritance needed

---

## 📋 File Structure

### 1. authEventLogger.js
**Purpose:** All authentication & login event logging

**Exported Functions:**
- `logSuccessfulLogin(options)` - INFO level
- `logFailedLogin(options)` - WARNING level
- `logLoginCriticalError(options)` - CRITICAL level

**Usage in authController.js:**
```javascript
const { logSuccessfulLogin, logFailedLogin, logLoginCriticalError } = require('../eventLoggers/authEventLogger');

// Successful login
await logSuccessfulLogin({ email, userId, duration });

// Failed login
await logFailedLogin({ email, reason: 'Invalid credentials', duration });

// Critical error
await logLoginCriticalError({ email, error, duration });
```

---

### 2. assetEventLogger.js
**Purpose:** All asset-related event logging

**Exported Functions:**

**INFO Level:**
- `logAssetCreated(options)` - Asset created successfully
- `logAssetsRetrieved(options)` - Assets retrieved successfully
- `logAssetUpdated(options)` - Asset updated successfully
- `logAssetDeleted(options)` - Asset deleted successfully

**WARNING Level:**
- `logUnauthorizedAccess(options)` - Unauthorized access attempt
- `logMissingRequiredFields(options)` - Missing required fields
- `logInvalidVendor(options)` - Invalid vendor ID
- `logDuplicateAssetId(options)` - Duplicate asset ID
- `logAssetNotFound(options)` - Asset not found

**ERROR Level:**
- `logAssetCreationError(options)` - General creation error
- `logAssetRetrievalError(options)` - Retrieval/query error
- `logAssetUpdateError(options)` - Update error
- `logAssetDeletionError(options)` - Deletion error

**CRITICAL Level:**
- `logDatabaseConstraintViolation(options)` - DB constraint violation
- `logDatabaseConnectionFailure(options)` - DB connection failure

**Usage in assetController.js:**
```javascript
// Import only the functions you need
const { 
    logAssetCreated, 
    logMissingRequiredFields, 
    logAssetCreationError,
    logDatabaseConstraintViolation 
} = require('../eventLoggers/assetEventLogger');

// Success (INFO)
await logAssetCreated({ assetId, assetName, assetTypeId, userId, duration });

// Validation failure (WARNING)
await logMissingRequiredFields({ text, orgId, assetTypeId, userId, duration });

// Error (ERROR)
await logAssetCreationError({ assetName, assetTypeId, error, userId, duration });

// Critical (CRITICAL)
await logDatabaseConstraintViolation({ assetName, assetTypeId, error, userId, duration });
```

---

## 🔧 How to Add Logging to New Controllers

### Step 1: Create Event Logger File

Create `eventLoggers/yourModuleEventLogger.js`:

```javascript
const eventLogger = require('../services/eventLogger');

/**
 * Your Module Event Logger
 * All logging for your module
 */

// INFO Level
async function logOperationSuccess(options) {
    const { data, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'YOUR_APP_ID',
        eventType: 'YOUR_EVENT_TYPE',
        module: 'YourController',
        message: 'INFO: Operation successful',
        logLevel: 'INFO',
        requestData: data,
        responseData: { success: true },
        duration,
        userId
    });
}

// WARNING Level
async function logValidationFailure(options) {
    const { reason, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'YOUR_APP_ID',
        eventType: 'YOUR_EVENT_TYPE',
        module: 'YourController',
        message: `WARNING: Validation failed - ${reason}`,
        logLevel: 'WARNING',
        requestData: { reason },
        responseData: { error: reason },
        duration,
        userId
    });
}

// ERROR Level
async function logOperationError(options) {
    const { error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'YOUR_APP_ID',
        eventType: 'YOUR_EVENT_TYPE',
        module: 'YourController',
        message: `ERROR: Operation failed - ${error.message}`,
        logLevel: 'ERROR',
        requestData: {},
        responseData: { error: error.message },
        duration,
        userId
    });
}

// CRITICAL Level
async function logSystemFailure(options) {
    const { error, userId, duration } = options;
    
    await eventLogger.logEvent({
        appId: 'YOUR_APP_ID',
        eventType: 'SYSTEM_FAILURE',
        module: 'YourController',
        message: `CRITICAL: System failure - ${error.message}`,
        logLevel: 'CRITICAL',
        requestData: {},
        responseData: { error: error.message },
        duration,
        userId
    });
}

// Export all functions
module.exports = {
    logOperationSuccess,
    logValidationFailure,
    logOperationError,
    logSystemFailure
};
```

### Step 2: Use in Controller

```javascript
const { 
    logOperationSuccess, 
    logValidationFailure, 
    logOperationError 
} = require('../eventLoggers/yourModuleEventLogger');

const yourOperation = async (req, res) => {
    const startTime = Date.now();
    const userId = req.user?.user_id;
    
    try {
        // Validation
        if (!requiredField) {
            await logValidationFailure({
                reason: 'Missing required field',
                userId,
                duration: Date.now() - startTime
            });
            return res.status(400).json({ error: 'Missing field' });
        }
        
        // Operation
        const result = await someOperation();
        
        // Success
        await logOperationSuccess({
            data: result,
            userId,
            duration: Date.now() - startTime
        });
        
        res.json(result);
        
    } catch (error) {
        // Error
        await logOperationError({
            error,
            userId,
            duration: Date.now() - startTime
        });
        
        res.status(500).json({ error: error.message });
    }
};
```

---

## 📝 Naming Conventions

### File Names
```
{moduleName}EventLogger.js

Examples:
- authEventLogger.js
- assetEventLogger.js
- vendorEventLogger.js
- maintenanceEventLogger.js
```

### Method Names
```
log{Operation}{Level}

Examples:
- logSuccessfulLogin() - INFO
- logFailedLogin() - WARNING
- logAssetCreated() - INFO
- logInvalidVendor() - WARNING
- logAssetCreationError() - ERROR
- logDatabaseConstraintViolation() - CRITICAL
```

---

## 🎯 Decision Flow

```
Controller Event
     ↓
EventLogger Method (decides log level & message)
     ↓
Core EventLogger Service (writes to CSV)
     ↓
Check tblTechnicalLogConfig (filter by level)
     ↓
Write to CSV (if matches configured level)
```

---

## 💡 Best Practices

### 1. **One Method Per Event Type**
Each distinct event should have its own method:
```javascript
✅ GOOD:
- logSuccessfulLogin()
- logFailedLogin()
- logLoginCriticalError()

❌ BAD:
- logLogin(type, success, error) // Too generic
```

### 2. **Clear Method Names**
Method names should clearly indicate:
- What operation
- What happened
- What log level

```javascript
✅ GOOD:
- logAssetCreated() → Clearly INFO level
- logInvalidVendor() → Clearly WARNING level
- logDatabaseConstraintViolation() → Clearly CRITICAL

❌ BAD:
- logEvent() → Too generic
- handleError() → Unclear level
```

### 3. **Minimal Parameters**
Only pass what's needed:
```javascript
✅ GOOD:
await AssetEventLogger.logAssetCreated({
    assetId,
    assetName,
    userId,
    duration
});

❌ BAD:
await AssetEventLogger.logAssetCreated({
    assetId,
    assetName,
    assetTypeId,
    branchId,
    vendorId,
    purchasedCost,
    // ... 20 more fields
});
```

### 4. **Consistent Duration Tracking**
Always calculate duration the same way:
```javascript
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;

await SomeEventLogger.logSomething({ ..., duration });
```

---

## 📊 Current Implementation Status

| Module | File | Status | Methods |
|--------|------|--------|---------|
| **Auth** | authEventLogger.js | ✅ Complete | 3 methods |
| **Assets** | assetEventLogger.js | ✅ Complete | 13 methods |
| Vendors | vendorEventLogger.js | ⏳ Pending | - |
| Maintenance | maintenanceEventLogger.js | ⏳ Pending | - |
| Reports | reportsEventLogger.js | ⏳ Pending | - |

---

## 🔄 Migration Guide

### To Add Logging to an Existing Controller:

**Step 1:** Create event logger file
```bash
# Create new file
New-Item eventLoggers/yourModuleEventLogger.js
```

**Step 2:** Define methods for each log level
```javascript
class YourModuleEventLogger {
    static async logSuccess(options) { /* INFO */ }
    static async logWarning(options) { /* WARNING */ }
    static async logError(options) { /* ERROR */ }
    static async logCritical(options) { /* CRITICAL */ }
}
```

**Step 3:** Import in controller
```javascript
const YourModuleEventLogger = require('../eventLoggers/yourModuleEventLogger');
```

**Step 4:** Replace logging calls
```javascript
// Before
await eventLogger.logEvent({ appId, eventType, ... });

// After
await YourModuleEventLogger.logOperationSuccess({ ... });
```

---

## 🧪 Testing

Test that logging still works after refactoring:

```javascript
const AuthEventLogger = require('./eventLoggers/authEventLogger');

async function test() {
    await AuthEventLogger.logSuccessfulLogin({
        email: 'test@test.com',
        userId: 'USR001',
        duration: 100
    });
    
    // Check CSV file for entry
}

test();
```

---

## 📚 Quick Reference

### Import Pattern (Functions - Not Classes):
```javascript
// Import only what you need
const { logSuccess, logError, logCritical } = require('../eventLoggers/moduleEventLogger');
```

### Usage Pattern:
```javascript
// Just call the function directly - simple and clean!
await logSuccess({
    param1,
    param2,
    userId,
    duration
});
```

### Benefits:
✅ **Clean Controllers** - No logging clutter  
✅ **Easy Maintenance** - All logging in one place  
✅ **Consistent Logging** - Standardized messages  
✅ **Easy Changes** - Modify logging without touching business logic  
✅ **Reusable** - Same logging methods can be used from multiple places  
✅ **Testable** - Easy to unit test logging logic separately  

---

## 🎓 Example Comparison

### Before (Inline Logging):
```javascript
// authController.js - 80 lines of code mixed with logging
const login = async (req, res) => {
    const startTime = Date.now();
    const { email, password } = req.body;
    const ipAddress = req.ip || ...;  // 15 lines of logging setup
    
    try {
        const user = await findUserByEmail(email);
        
        if (!user) {
            await eventLogger.logEvent({   // 12 lines
                appId: 'LOGIN',            // of logging
                eventType: 'LOGIN',        // logic
                module: 'AUTH',            // cluttering
                message: 'Failed login',   // the
                logLevel: 'WARNING',       // controller
                requestData: { email },
                responseData: { success: false },
                duration: Date.now() - startTime,
                userId: null,
                ipAddress
            });
            return res.status(404).json({ message: 'User not found' });
        }
        // ... more code
    }
};
```

### After (Clean):
```javascript
// authController.js - 40 lines of pure business logic
const { logFailedLogin } = require('../eventLoggers/authEventLogger');

const login = async (req, res) => {
    const startTime = Date.now();
    const { email, password } = req.body;
    
    try {
        const user = await findUserByEmail(email);
        
        if (!user) {
            await logFailedLogin({  // 1 clean line!
                email, reason: 'User not found', duration: Date.now() - startTime
            });
            return res.status(404).json({ message: 'User not found' });
        }
        // ... more code
    }
};

// authEventLogger.js - All logging logic in one place
async function logFailedLogin(options) {
    const { email, reason, duration } = options;
    await eventLogger.logLogin({
        appId: 'LOGIN',
        email,
        success: false,
        error: { message: reason },
        duration
    });
}

module.exports = { logFailedLogin };
```

---

## 🚀 Future Enhancements

Create event loggers for:
- [ ] `vendorEventLogger.js` - Vendor CRUD operations
- [ ] `maintenanceEventLogger.js` - Maintenance operations
- [ ] `departmentEventLogger.js` - Department operations
- [ ] `branchEventLogger.js` - Branch operations
- [ ] `userEventLogger.js` - User management operations
- [ ] `reportEventLogger.js` - Report generation operations
- [ ] `workflowEventLogger.js` - Workflow operations

---

## 📖 Documentation

For detailed information about:
- **Event Logger Service**: See `services/eventLogger.js`
- **Log Levels**: See `EVENT_LOGGING_RND.md`
- **Testing Guide**: See `HOW_TO_TEST_EVENT_LOGGING.md`
- **Log Level Decisions**: See `HOW_LOG_LEVELS_ARE_DECIDED.md`
- **ASSETS Implementation**: See `ASSETS_EVENT_LOGGING_SUMMARY.md`
- **CRITICAL Events**: See `CRITICAL_EVENT_EXAMPLES.md`

---

**Last Updated:** October 16, 2025  
**Architecture Version:** 2.0 (Centralized Event Loggers)

