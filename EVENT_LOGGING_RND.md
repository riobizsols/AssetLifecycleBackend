# Event Logging System - R&D Document

**Date:** October 14, 2025  
**Prepared by:** Technical Team  
**Purpose:** Internal technical event logging for system monitoring and debugging

---

## 1. Executive Summary

The Event Logging System is an **internal technical logging mechanism** designed for system administrators and developers to monitor API calls, database operations, and system events. This is **separate and distinct** from the user-facing Audit Log system which tracks user actions for compliance.

### Key Differences: Event Logs vs Audit Logs

| Feature | Event Logs (Technical) | Audit Logs (User-Facing) |
|---------|----------------------|--------------------------|
| **Audience** | System Admins, Developers | End Users, Compliance Teams |
| **Purpose** | Technical monitoring, debugging | User action tracking, compliance |
| **Storage** | Daily CSV files (10-day retention) | Database (long-term storage) |
| **Location** | File system (`/logs` directory) | Database table `tblAuditLogs` |
| **Data Logged** | API requests/responses, DB calls, system events | User actions, business operations |
| **Access** | Admin panel only | User-accessible log viewer |
| **Log Levels** | Info, Warning, Error, Critical, None | Event enabled/disabled |

---

## 2. Requirements Specification

### 2.1 Functional Requirements

#### A. Event Types to Log
1. **API Calls**
   - Endpoint URL
   - HTTP method
   - Request headers
   - Request body
   - Response status code
   - Response body
   - Response time

2. **Database Calls**
   - Query type (SELECT, INSERT, UPDATE, DELETE)
   - Table name
   - Query execution time
   - Number of rows affected
   - Error messages (if any)

3. **Authentication Events**
   - Login attempts (success/failure)
   - Token generation
   - Token validation
   - Logout events
   - Session expiry

4. **System Events**
   - Server start/stop
   - Cron job executions
   - File uploads/downloads
   - Email sending
   - Error exceptions

#### B. File Management
1. **File Naming Convention**
   ```
   events_YYYY-MM-DD.csv
   Example: events_2025-10-14.csv
   ```

2. **File Creation Schedule**
   - New file created at **00:00 (midnight)** daily
   - Automatic rollover at midnight
   - Old files deleted after **10 days**

3. **File Location**
   ```
   AssetLifecycleManagementBackend/logs/events/
   ```

4. **File Format (CSV)**
   ```csv
   Timestamp,Log Level,Event Type,Module,Message,Request Data,Response Data,Duration (ms),User ID
   ```

#### C. Log Levels (Hierarchical)

| Level | Code | Description | When to Use | What Gets Logged |
|-------|------|-------------|-------------|------------------|
| **INFO** | 0 | Informational | Development, testing - see everything | **INFO + WARNING + ERROR + CRITICAL** (all events) |
| **WARNING** | 1 | Warning | Production monitoring - skip info logs | **WARNING + ERROR + CRITICAL** |
| **ERROR** | 2 | Error | Production - only errors and critical | **ERROR + CRITICAL** |
| **CRITICAL** | 3 | Critical | Emergency - only critical failures | **CRITICAL only** |
| **NONE** | 4 | Disabled | Logging completely off | **Nothing logged** |

**Note:** This system uses **hierarchical logging**. If log level is set to INFO, ALL events are logged (INFO, WARNING, ERROR, CRITICAL). If set to ERROR, only ERROR and CRITICAL events are logged.

#### D. Configuration Management

**Database Table:** `tblTechnicalLogConfig`

```sql
CREATE TABLE "tblTechnicalLogConfig" (
    config_id SERIAL PRIMARY KEY,
    app_id VARCHAR(50) NOT NULL,
    log_level VARCHAR(20) NOT NULL,
    log_level_code INTEGER NOT NULL DEFAULT 2,
    enabled BOOLEAN DEFAULT TRUE,
    file_retention_days INTEGER DEFAULT 10,
    max_file_size_mb INTEGER DEFAULT 100,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(50),
    CONSTRAINT unique_app_log_config UNIQUE(app_id)
);

-- Insert default configuration
INSERT INTO "tblTechnicalLogConfig" (app_id, log_level, log_level_code, enabled)
VALUES 
    ('SYSTEM', 'ERROR', 2, true),
    ('API', 'ERROR', 2, true),
    ('DATABASE', 'ERROR', 2, true),
    ('AUTH', 'WARNING', 1, true);
```

### 2.2 Non-Functional Requirements

1. **Performance**
   - Logging should not block main application flow (asynchronous)
   - Write operations should be buffered
   - Max 5ms overhead per logged event

2. **Storage**
   - Max file size: 100MB per day
   - Automatic file rotation
   - Compression for archived files (optional)

3. **Security**
   - Sensitive data (passwords, tokens) must be masked
   - Access restricted to admin users only
   - Secure file permissions

4. **Reliability**
   - Continue application operation even if logging fails
   - Retry mechanism for failed writes
   - Error handling for disk space issues

---

## 3. System Architecture

### 3.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Express Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ API Routes   │───▶│ Event Logger │───▶│ File Writer  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                             │                     │          │
│  ┌──────────────┐          │              ┌──────▼──────┐  │
│  │ DB Queries   │──────────┤              │ CSV Files   │  │
│  └──────────────┘          │              │ (Daily)     │  │
│                             │              └─────────────┘  │
│  ┌──────────────┐          │                                │
│  │ Auth Events  │──────────┤                                │
│  └──────────────┘          │                                │
│                             │                                │
│                      ┌──────▼──────┐                        │
│                      │ Log Config  │                        │
│                      │ (Database)  │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

1. **Event Occurs** → API call, DB query, or system event
2. **Check Log Level** → Compare event level with configured level
3. **Format Log Entry** → Structure data according to CSV format
4. **Buffer Write** → Add to write buffer (async)
5. **Flush to File** → Write buffer to current day's file
6. **File Rotation** → Create new file at midnight
7. **Cleanup** → Delete files older than 10 days

---

## 4. Implementation Plan

### Phase 1: Foundation (Week 1)
- [ ] Create database table `tblTechnicalLogConfig`
- [ ] Create log file directory structure
- [ ] Implement core EventLogger class
- [ ] Implement file rotation logic
- [ ] Write unit tests for core functionality

### Phase 2: Integration (Week 2)
- [ ] Create middleware for API logging
- [ ] Add database query logging
- [ ] Implement authentication event logging
- [ ] Add configuration management API
- [ ] Test with existing endpoints

### Phase 3: Admin Interface (Week 3)
- [ ] Create admin page for log configuration
- [ ] Implement log viewer interface
- [ ] Add log level management UI
- [ ] Create file download functionality
- [ ] Implement search and filter features

### Phase 4: Testing & Optimization (Week 4)
- [ ] Performance testing and optimization
- [ ] Load testing (high-volume logging)
- [ ] Security audit
- [ ] Documentation completion
- [ ] Deployment to staging

---

## 5. Code Structure

### File Organization
```
AssetLifecycleManagementBackend/
├── services/
│   ├── eventLogger.js          # Core event logging service
│   └── logFileManager.js       # File rotation and cleanup
├── middlewares/
│   ├── apiLogger.js            # API request/response logging
│   └── dbLogger.js             # Database query logging
├── controllers/
│   └── eventLogController.js   # Admin endpoints for log management
├── routes/
│   └── eventLogRoutes.js       # Routes for event log admin
├── models/
│   └── eventLogConfigModel.js  # Database config operations
├── migrations/
│   └── create_technical_log_config.sql
└── logs/
    └── events/                 # Daily CSV files stored here
        ├── events_2025-10-14.csv
        ├── events_2025-10-15.csv
        └── ...
```

---

## 6. Sample Log Entries

### Example 1: API Call Log
```csv
"2025-10-14 10:15:32.145","INFO","API_CALL","AuthController","POST /api/auth/login","{ \"username\": \"admin@company.com\" }","{ \"success\": true, \"token\": \"***MASKED***\" }","125","USR001"
```

### Example 2: Database Query Log
```csv
"2025-10-14 10:15:32.270","INFO","DB_QUERY","AssetModel","SELECT query on tblAssets","WHERE asset_id = $1","45 rows returned","32","USR001"
```

### Example 3: Error Log
```csv
"2025-10-14 10:16:45.890","ERROR","API_ERROR","AssetController","Failed to create asset","ValidationError: Asset name is required","null","5","USR002"
```

### Example 4: Critical Error
```csv
"2025-10-14 10:20:15.234","CRITICAL","SYSTEM_ERROR","Database","Database connection failed","ECONNREFUSED: Connection refused","null","0","SYSTEM"
```

---

## 7. Admin Panel Features

### 7.1 Log Configuration Page
```
┌─────────────────────────────────────────────────────────┐
│  Event Logging Configuration                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Global Log Level:  [ERROR ▼]      Status: ● Enabled    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ App ID    │ Current Level │ Status   │ Actions    │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ SYSTEM    │ ERROR         │ Enabled  │ [Edit]     │ │
│  │ API       │ ERROR         │ Enabled  │ [Edit]     │ │
│  │ DATABASE  │ ERROR         │ Enabled  │ [Edit]     │ │
│  │ AUTH      │ WARNING       │ Enabled  │ [Edit]     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  File Retention: [10] days                              │
│  Max File Size: [100] MB                                │
│                                                          │
│  [Save Configuration]                                   │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Log Viewer Page
```
┌─────────────────────────────────────────────────────────┐
│  Event Log Viewer                                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Date: [2025-10-14 ▼]    Level: [All ▼]                │
│  Event Type: [All ▼]     Search: [____________] [🔍]    │
│                                                          │
│  [Download CSV] [Clear Filters] [Refresh]               │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Time       │ Level    │ Type     │ Message         │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ 10:15:32   │ INFO     │ API_CALL │ POST /api/...   │ │
│  │ 10:15:33   │ INFO     │ DB_QUERY │ SELECT from ... │ │
│  │ 10:16:45   │ ERROR    │ API_ERR  │ Failed to ...   │ │
│  │ 10:20:15   │ CRITICAL │ SYS_ERR  │ DB connection...│ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [← Previous]  Page 1 of 45  [Next →]                  │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Environment-Specific Configurations

### Development Environment
```env
EVENT_LOG_ENABLED=true
EVENT_LOG_LEVEL=INFO
EVENT_LOG_PATH=/logs/events
EVENT_LOG_RETENTION_DAYS=3
EVENT_LOG_MAX_SIZE_MB=50
```

### Testing Environment
```env
EVENT_LOG_ENABLED=true
EVENT_LOG_LEVEL=ERROR
EVENT_LOG_PATH=/logs/events
EVENT_LOG_RETENTION_DAYS=7
EVENT_LOG_MAX_SIZE_MB=100
```

### Production Environment
```env
EVENT_LOG_ENABLED=true
EVENT_LOG_LEVEL=NONE
EVENT_LOG_PATH=/var/log/asset-lifecycle/events
EVENT_LOG_RETENTION_DAYS=10
EVENT_LOG_MAX_SIZE_MB=200
```

---

## 9. Security Considerations

### Data Masking Rules
```javascript
const SENSITIVE_FIELDS = [
    'password',
    'token',
    'api_key',
    'secret',
    'authorization',
    'credit_card',
    'ssn',
    'national_id'
];

// Mask sensitive data before logging
function maskSensitiveData(data) {
    // Replace sensitive values with ***MASKED***
}
```

### File Permissions
```bash
# Log directory should be readable only by application and admin
chmod 750 /logs/events
chown app-user:app-group /logs/events

# Individual log files
chmod 640 /logs/events/*.csv
```

---

## 10. Testing Strategy

### Unit Tests
- [ ] Test log level filtering
- [ ] Test file rotation logic
- [ ] Test data masking
- [ ] Test CSV formatting

### Integration Tests
- [ ] Test API middleware integration
- [ ] Test database query logging
- [ ] Test concurrent write operations
- [ ] Test file cleanup process

### Performance Tests
- [ ] Log 10,000 events/second
- [ ] Measure overhead on API response time
- [ ] Test with large log files (>100MB)
- [ ] Test disk space handling

### Load Tests
- [ ] Concurrent API calls with logging
- [ ] Multiple database queries
- [ ] File rotation under load

---

## 11. Migration Path

### Step 1: Add to Existing System
```javascript
// Minimal impact - add logging without changing existing code
const eventLogger = require('./services/eventLogger');

// Existing code continues to work
app.use(apiLogger.middleware); // Add logging middleware
```

### Step 2: Gradual Rollout
1. Enable logging in **development** first
2. Set log level to **ERROR** in **testing**
3. Deploy to **staging** with **WARNING** level
4. Production deployment with **NONE** initially
5. Gradually enable production logging after monitoring

---

## 12. Monitoring & Alerts

### Metrics to Track
- Log file size growth rate
- Disk space usage
- Number of CRITICAL events per day
- Number of ERROR events per hour
- Logging system performance overhead

### Alert Triggers
- CRITICAL event logged → Immediate alert
- 100+ ERROR events in 1 hour → Warning alert
- Log file size > 150MB → Disk space alert
- Disk space < 1GB → Critical alert
- Logging system failure → System alert

---

## 13. API Endpoints (Admin Only)

### Get Log Configuration
```
GET /api/event-logs/config
```

### Update Log Configuration
```
PUT /api/event-logs/config
{
    "app_id": "API",
    "log_level": "WARNING",
    "log_level_code": 1,
    "enabled": true
}
```

### Get Available Log Files
```
GET /api/event-logs/files
Response: [
    "events_2025-10-14.csv",
    "events_2025-10-13.csv",
    ...
]
```

### Download Log File
```
GET /api/event-logs/download/:filename
```

### View Log Entries (Parsed)
```
GET /api/event-logs/view?date=2025-10-14&level=ERROR&limit=100
```

### Get Log Statistics
```
GET /api/event-logs/stats?date=2025-10-14
Response: {
    "total_events": 12450,
    "by_level": {
        "INFO": 10200,
        "WARNING": 1800,
        "ERROR": 420,
        "CRITICAL": 30
    },
    "by_type": {
        "API_CALL": 8500,
        "DB_QUERY": 3200,
        "AUTH": 500,
        "SYSTEM": 250
    }
}
```

---

## 14. Benefits & ROI

### For Development Team
✅ Faster debugging with detailed request/response logs  
✅ Performance monitoring (slow queries, API endpoints)  
✅ Error pattern identification  
✅ Integration testing verification

### For Operations Team
✅ System health monitoring  
✅ Early warning for issues  
✅ Capacity planning data  
✅ Security incident investigation

### For Management
✅ System reliability metrics  
✅ Compliance with internal policies  
✅ Reduced downtime through proactive monitoring  
✅ Better resource allocation

---

## 15. Future Enhancements

### Phase 2 Features
- [ ] Log aggregation (combine multiple app logs)
- [ ] Real-time log streaming (WebSocket)
- [ ] Advanced analytics dashboard
- [ ] Machine learning for anomaly detection
- [ ] Integration with external monitoring (Datadog, New Relic)
- [ ] Automatic error categorization
- [ ] Performance regression detection

### Phase 3 Features
- [ ] Distributed logging (microservices)
- [ ] Log compression and archiving
- [ ] Export to external systems (S3, ELK stack)
- [ ] Custom alert rules
- [ ] Automated incident creation
- [ ] Log-based autoscaling triggers

---

## 16. Success Metrics

### Week 1 (Post-Implementation)
- [ ] Zero impact on API response times (<5ms overhead)
- [ ] All critical events captured
- [ ] Log files created and rotated correctly

### Month 1
- [ ] 5+ issues identified and fixed using event logs
- [ ] Admin team trained on log viewer
- [ ] Log level optimized for production

### Quarter 1
- [ ] 20% reduction in mean time to resolution (MTTR)
- [ ] Proactive identification of 10+ potential issues
- [ ] Complete coverage of all system components

---

## 17. Appendix

### A. CSV Column Definitions

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Timestamp | DateTime | ISO 8601 format | 2025-10-14 10:15:32.145 |
| Log Level | String | INFO, WARNING, ERROR, CRITICAL | ERROR |
| Event Type | String | API_CALL, DB_QUERY, AUTH, SYSTEM | API_CALL |
| Module | String | Controller/Service/Model name | AuthController |
| Message | String | Brief description | POST /api/auth/login |
| Request Data | JSON String | Request body/params | {"username":"admin"} |
| Response Data | JSON String | Response body | {"success":true} |
| Duration (ms) | Integer | Execution time | 125 |
| User ID | String | User identifier or SYSTEM | USR001 |

### B. Log Level Decision Tree

```
Is this event expected normal behavior?
  ├─ YES → INFO
  │
  └─ NO → Could this cause problems later?
          ├─ NO, but noteworthy → WARNING
          │
          └─ YES → Can the system continue?
                  ├─ YES → ERROR
                  │
                  └─ NO → CRITICAL
```

### C. Disk Space Calculation

```
Average log entry: ~500 bytes
10,000 events/day: ~5MB/day
With 10-day retention: ~50MB total
With buffer (2x): Allocate 100MB minimum
Recommended: 500MB for logs directory
```

---

## 18. References

- [Winston Logger Documentation](https://github.com/winstonjs/winston)
- [Bunyan Logger](https://github.com/trentm/node-bunyan)
- [Log4js for Node](https://log4js-node.github.io/log4js-node/)
- [Best Practices for Logging](https://www.loggly.com/ultimate-guide/node-logging-basics/)

---

**Document Version:** 1.0  
**Last Updated:** October 14, 2025  
**Next Review Date:** November 14, 2025

