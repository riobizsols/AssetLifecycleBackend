# CRITICAL Event Examples for Event Logging

## What Makes an Event CRITICAL?

CRITICAL events are **catastrophic failures** that:
- ✅ Require **immediate attention**
- ✅ Affect **system security or availability**
- ✅ Could impact **multiple users or the entire system**
- ✅ Indicate **severe system malfunction** or **security threat**
- ✅ May require **emergency response** or **system shutdown**

---

## CRITICAL Events for LOGIN

### 1. 🔐 **System Failures**

#### A. JWT Configuration Missing
```javascript
// JWT_SECRET not configured - cannot generate tokens
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SYSTEM_FAILURE',
    module: 'AUTH',
    message: 'CRITICAL: JWT_SECRET not configured - authentication system disabled',
    logLevel: 'CRITICAL',
    requestData: { configCheck: 'JWT_SECRET' },
    responseData: { error: 'Missing critical configuration', impact: 'All logins blocked' },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

#### B. Database Complete Failure
```javascript
// Database completely unreachable
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SYSTEM_FAILURE',
    module: 'AUTH',
    message: 'CRITICAL: Database connection pool exhausted - all logins failing',
    logLevel: 'CRITICAL',
    requestData: { 
        activeConnections: 0,
        maxConnections: 100,
        queuedRequests: 500
    },
    responseData: { error: 'Cannot authenticate any users', impact: 'System-wide' },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

#### C. Uncaught Exception During Login
```javascript
// Unexpected system error (already implemented in catch block)
try {
    // login logic
} catch (error) {
    await eventLogger.logEvent({
        appId: 'LOGIN',
        eventType: 'SYSTEM_FAILURE',
        module: 'AUTH',
        message: `CRITICAL: System failure during login - ${error.message}`,
        logLevel: 'CRITICAL',
        requestData: { email },
        responseData: { error: error.message, stack: error.stack?.substring(0, 200) },
        duration,
        userId: null,
        ipAddress
    });
}
```

---

### 2. 🚨 **Security Threats**

#### A. Brute Force Attack Detected
```javascript
// 100+ failed login attempts from same IP in 1 minute
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SECURITY_THREAT',
    module: 'AUTH',
    message: 'CRITICAL: Brute force attack detected - automated login attempts',
    logLevel: 'CRITICAL',
    requestData: { 
        ipAddress: '192.168.1.100',
        failedAttempts: 150,
        timeWindow: '60 seconds',
        targetUsers: ['admin@company.com', 'root@company.com']
    },
    responseData: { 
        action: 'IP automatically blocked',
        duration: '24 hours'
    },
    userId: null,
    ipAddress: '192.168.1.100'
});
```

#### B. SQL Injection Attempt
```javascript
// SQL injection detected in login request
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SECURITY_THREAT',
    module: 'AUTH',
    message: 'CRITICAL: SQL injection attempt detected in login credentials',
    logLevel: 'CRITICAL',
    requestData: { 
        email: "admin' OR '1'='1",
        pattern: 'SQL injection signature detected'
    },
    responseData: { 
        action: 'Request blocked',
        ipBlocked: true,
        securityTeamNotified: true
    },
    userId: null,
    ipAddress: '192.168.1.100'
});
```

#### C. Privilege Escalation Attempt
```javascript
// User attempting to manipulate JWT to gain admin rights
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SECURITY_THREAT',
    module: 'AUTH',
    message: 'CRITICAL: Privilege escalation attempt - token manipulation detected',
    logLevel: 'CRITICAL',
    requestData: { 
        userId: 'USR123',
        currentRole: 'user',
        attemptedRole: 'super_admin',
        tokenTampering: true
    },
    responseData: { 
        action: 'Account locked',
        sessionTerminated: true,
        securityInvestigation: 'initiated'
    },
    userId: 'USR123',
    ipAddress: '192.168.1.100'
});
```

#### D. Credential Stuffing Attack
```javascript
// Massive login attempts using stolen credentials database
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SECURITY_THREAT',
    module: 'AUTH',
    message: 'CRITICAL: Credential stuffing attack detected - multiple accounts targeted',
    logLevel: 'CRITICAL',
    requestData: { 
        uniqueIPs: 50,
        uniqueUsers: 200,
        failedAttempts: 1000,
        timeWindow: '5 minutes'
    },
    responseData: { 
        action: 'Emergency rate limiting enabled',
        affectedAccounts: 'All users forced to 2FA'
    },
    userId: 'SYSTEM',
    ipAddress: 'MULTIPLE'
});
```

---

### 3. 💾 **Data Integrity Issues**

#### A. Database Corruption
```javascript
// User table corruption detected
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'DATA_CORRUPTION',
    module: 'AUTH',
    message: 'CRITICAL: User table corruption detected - data integrity violated',
    logLevel: 'CRITICAL',
    requestData: { 
        table: 'tblUsers',
        corruptedRows: 150,
        totalRows: 1000,
        integrityCheck: 'FAILED'
    },
    responseData: { 
        action: 'Login system disabled',
        backupRestore: 'in progress',
        estimatedDowntime: '30 minutes'
    },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

#### B. Password Hash Failure
```javascript
// bcrypt library failure - cannot verify passwords
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SYSTEM_FAILURE',
    module: 'AUTH',
    message: 'CRITICAL: Password verification system failure - bcrypt error',
    logLevel: 'CRITICAL',
    requestData: { 
        library: 'bcrypt',
        error: 'hash comparison failed'
    },
    responseData: { 
        impact: 'Cannot authenticate any users',
        action: 'Emergency maintenance required'
    },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

---

### 4. 🌐 **Service Availability**

#### A. Authentication Service Down
```javascript
// External auth service (LDAP, OAuth) completely unavailable
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SERVICE_DOWN',
    module: 'AUTH',
    message: 'CRITICAL: External authentication service unavailable - SSO login disabled',
    logLevel: 'CRITICAL',
    requestData: { 
        service: 'LDAP',
        endpoint: 'ldap://auth.company.com',
        healthCheck: 'FAILED',
        retries: 5
    },
    responseData: { 
        impact: 'SSO users cannot login',
        fallback: 'Local authentication only',
        affectedUsers: 5000
    },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

#### B. Session Store Failure
```javascript
// Redis/session store completely down
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SERVICE_DOWN',
    module: 'AUTH',
    message: 'CRITICAL: Session store unavailable - cannot create login sessions',
    logLevel: 'CRITICAL',
    requestData: { 
        service: 'Redis',
        endpoint: 'redis://localhost:6379',
        error: 'Connection refused'
    },
    responseData: { 
        impact: 'Users can login but sessions not persisted',
        action: 'Emergency session fallback enabled'
    },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

---

### 5. 🔥 **Cascading Failures**

#### A. Multiple System Components Down
```javascript
// Database + Redis + Email service all down
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'CASCADING_FAILURE',
    module: 'AUTH',
    message: 'CRITICAL: Multiple critical services failed - authentication system compromised',
    logLevel: 'CRITICAL',
    requestData: { 
        failedServices: ['Database', 'Redis', 'Email'],
        healthyServices: [],
        systemStatus: 'CRITICAL'
    },
    responseData: { 
        action: 'Emergency maintenance mode activated',
        userMessage: 'System temporarily unavailable'
    },
    userId: 'SYSTEM',
    ipAddress: 'N/A'
});
```

---

## Comparison: ERROR vs CRITICAL

| Scenario | ERROR | CRITICAL |
|----------|-------|----------|
| Single user can't login (wrong password) | ❌ | ✅ (This is WARNING) |
| Database timeout for 1 query | ✅ | ❌ |
| Database completely unreachable | ❌ | ✅ |
| Email service down (can't send reset) | ✅ | ❌ |
| JWT_SECRET missing (no logins possible) | ❌ | ✅ |
| Single failed API call | ✅ | ❌ |
| 100+ failed logins from same IP | ❌ | ✅ |
| User session expired | ❌ | ✅ (This is INFO) |
| All user sessions deleted | ❌ | ✅ |

---

## Implementation Guidelines

### When to Use CRITICAL Level:

✅ **DO use CRITICAL when:**
- System-wide authentication failure
- Security breach or attack detected
- Critical configuration missing (JWT_SECRET, DB credentials)
- Data corruption in user/auth tables
- Multiple simultaneous service failures
- Automated attack patterns detected

❌ **DON'T use CRITICAL when:**
- Single user login failure
- Individual API request fails
- Temporary network glitch
- User provides wrong password
- Non-critical service degradation

---

## Testing CRITICAL Events

### Test 1: Simulate Database Failure
```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Try to login
# Should log CRITICAL event
```

### Test 2: Remove JWT_SECRET
```bash
# Edit .env file
# Comment out JWT_SECRET=...

# Restart server
# Try to login
# Should log CRITICAL event
```

### Test 3: Trigger Catch Block
```javascript
// In authController.js, temporarily add:
throw new Error('Test CRITICAL error');

// Try to login
// Should log CRITICAL event
```

---

## Alert Configuration

When CRITICAL events are logged, you should:

1. **Immediate Notification**
   - Send SMS to on-call engineer
   - Create PagerDuty incident
   - Post to emergency Slack channel

2. **Automatic Actions**
   - Enable rate limiting
   - Block suspicious IPs
   - Switch to maintenance mode
   - Trigger backup authentication

3. **Monitoring**
   - Real-time dashboard alert
   - Email to security team
   - Log aggregation alert (Datadog, New Relic)

---

## Quick Reference

```javascript
// CRITICAL event template
await eventLogger.logEvent({
    appId: 'LOGIN',
    eventType: 'SYSTEM_FAILURE' | 'SECURITY_THREAT' | 'DATA_CORRUPTION' | 'SERVICE_DOWN',
    module: 'AUTH',
    message: 'CRITICAL: [Brief description of catastrophic failure]',
    logLevel: 'CRITICAL',
    requestData: { /* context data */ },
    responseData: { 
        error: 'error details',
        impact: 'who/what is affected',
        action: 'what was done automatically'
    },
    userId: 'user_id or SYSTEM',
    ipAddress: 'ip or N/A'
});
```

