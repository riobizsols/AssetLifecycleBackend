# Workflow Escalation Event Logging Implementation

## Overview
Comprehensive event logging implementation for the Workflow Escalation module, which is part of the maintenance approval system. Uses the `MAINTENANCEAPPROVAL` app_id for context-aware logging.

## Implementation Details

### 1. Event Logger Created
**File**: `AssetLifecycleBackend/eventLoggers/workflowEscalationEventLogger.js`

**Features**:
- 40+ comprehensive logging functions
- Hierarchical log levels: INFO, WARNING, ERROR, CRITICAL
- Detailed step-by-step logging for all operations
- Non-blocking logging with error handling
- Context-aware logging using `MAINTENANCEAPPROVAL` app_id

**Key Logging Functions**:
- **Overdue Workflows**: API calls, querying, retrieval, empty results, errors
- **Escalation Process**: Manual/system triggers, processing, completion, errors
- **Next Approver**: Parameter validation, querying, found/not found scenarios
- **Manual Escalation**: Parameter validation, processing, database operations, success/errors
- **Database Operations**: Transaction management, rollbacks, connection failures
- **Email Notifications**: Sending notifications, failures
- **System Operations**: Automated vs manual escalation triggers

### 2. Backend Controller Enhanced

#### Workflow Escalation Controller (`workflowEscalationController.js`)
**Enhanced Functions**:
- `getOverdueWorkflowsController()` - Get overdue workflows with detailed logging
- `triggerEscalationProcessController()` - Manual escalation trigger with comprehensive logging
- `getNextApproverController()` - Get next approver with validation and error logging
- `manualEscalateWorkflowController()` - Manual workflow escalation with step-by-step logging

**Logging Features**:
- Start time tracking for performance monitoring
- User ID extraction from request
- Non-blocking logging with error handling
- Detailed step-by-step operation logging
- Error logging with context preservation
- Parameter validation logging
- Database operation tracking

### 3. Log File Structure

**CSV File**: `logs/events/events_MAINTENANCEAPPROVAL_YYYY-MM-DD.csv`

**Log Levels**:
- **INFO**: Normal operations, API calls, data retrieval, successful operations
- **WARNING**: Missing parameters, validation issues, not found scenarios
- **ERROR**: API errors, validation failures, processing errors
- **CRITICAL**: Database connection failures, system errors

**Sample Log Entries**:
```csv
2025-10-23T12:00:00.000Z,INFO,GET_OVERDUE_WORKFLOWS_API_CALLED,WorkflowEscalationController,"INFO: Get overdue workflows API called","{\"orgId\":\"ORG001\",\"operation\":\"get_overdue_workflows\"}",,USR001,150
2025-10-23T12:00:01.000Z,INFO,QUERYING_OVERDUE_WORKFLOWS,WorkflowEscalationController,"INFO: Querying overdue workflows from database","{\"orgId\":\"ORG001\",\"operation\":\"fetch_overdue_workflows\"}",,USR001,50
2025-10-23T12:00:02.000Z,INFO,OVERDUE_WORKFLOWS_RETRIEVED,WorkflowEscalationController,"INFO: Retrieved 5 overdue workflows","{\"orgId\":\"ORG001\",\"count\":5}",,USR001,25
```

### 4. API Endpoints Logged

All workflow escalation APIs now have detailed logging:
- ✅ `GET /api/workflow-escalation/overdue` - Get overdue workflows
- ✅ `POST /api/workflow-escalation/process` - Trigger escalation process
- ✅ `GET /api/workflow-escalation/next-approver/:wfamshId` - Get next approver
- ✅ `POST /api/workflow-escalation/escalate` - Manual workflow escalation

### 5. Detailed Logging Examples

#### Overdue Workflows Flow:
```javascript
// 1. API Call
logGetOverdueWorkflowsApiCalled() // INFO: Get overdue workflows API called

// 2. Querying
logQueryingOverdueWorkflows() // INFO: Querying overdue workflows from database

// 3. Results
logOverdueWorkflowsRetrieved() // INFO: Retrieved 5 overdue workflows
// OR
logNoOverdueWorkflowsFound() // INFO: No overdue workflows found
```

#### Escalation Process Flow:
```javascript
// 1. API Call
logTriggerEscalationProcessApiCalled() // INFO: Trigger escalation process API called

// 2. Trigger Type
logManualEscalationTriggered() // INFO: Manual escalation process triggered

// 3. Processing
logProcessingEscalationWorkflows() // INFO: Processing workflow escalations

// 4. Completion
logEscalationProcessCompleted() // INFO: Escalation process completed successfully
```

#### Next Approver Flow:
```javascript
// 1. API Call
logGetNextApproverApiCalled() // INFO: Get next approver API called

// 2. Validation
logValidatingNextApproverParams() // INFO: Validating next approver parameters
logMissingWfamshId() // WARNING: WFAMSH ID is required
logMissingCurrentSequence() // WARNING: Current sequence is required

// 3. Querying
logQueryingNextApprover() // INFO: Querying next approver from database

// 4. Results
logNextApproverFound() // INFO: Next approver found
// OR
logNoNextApproverFound() // WARNING: No next approver found for this workflow
```

#### Manual Escalation Flow:
```javascript
// 1. API Call
logManualEscalateWorkflowApiCalled() // INFO: Manual escalate workflow API called

// 2. Validation
logValidatingEscalationParams() // INFO: Validating escalation parameters
logMissingEscalationParams() // WARNING: Required escalation parameters are missing

// 3. Processing
logProcessingWorkflowEscalation() // INFO: Processing workflow escalation
logEscalatingToNextApprover() // INFO: Escalating workflow to next approver

// 4. Success
logWorkflowEscalated() // INFO: Workflow escalated successfully
```

### 6. Error Scenarios Logged

#### Validation Errors:
```javascript
logMissingWfamshId() // WARNING: WFAMSH ID is required
logMissingCurrentSequence() // WARNING: Current sequence is required
logMissingEscalationParams() // WARNING: Required escalation parameters are missing
```

#### Processing Errors:
```javascript
logOverdueWorkflowsRetrievalError() // ERROR: Failed to retrieve overdue workflows
logEscalationProcessError() // ERROR: Escalation process failed
logNextApproverRetrievalError() // ERROR: Failed to retrieve next approver
logWorkflowEscalationError() // ERROR: Failed to escalate workflow
```

#### System Errors:
```javascript
logDatabaseConnectionFailure() // CRITICAL: Database connection failure
logDatabaseConstraintViolation() // ERROR: Database constraint violation
logDataRetrievalError() // ERROR: Data retrieval error
```

### 7. Database Operations Logged

#### Transaction Management:
```javascript
logDatabaseTransactionStarted() // INFO: Database transaction started
logDatabaseTransactionCompleted() // INFO: Database transaction completed
logDatabaseTransactionRollback() // ERROR: Database transaction rolled back
```

#### Email Notifications:
```javascript
logEmailNotificationSent() // INFO: Email notification sent
logEmailNotificationError() // ERROR: Failed to send email notification
```

### 8. Performance Optimizations

**Non-Blocking Logging**:
```javascript
// All logging calls are non-blocking
workflowEscalationLogger.logFunction({...}).catch(err => console.error('Logging error:', err));
```

**Error Handling**:
- Logging errors don't affect main application flow
- Comprehensive error logging for debugging
- Graceful degradation when logging fails

### 9. Integration Points

**Dependencies**:
- `eventLogger.js` - Core logging service
- `technicalLogConfigModel.js` - Log configuration management
- `workflowEscalationModel.js` - Workflow escalation business logic

**Configuration**:
- Log levels configured in `tblTechnicalLogConfig`
- App ID: `MAINTENANCEAPPROVAL`
- Log directory: `logs/events/`
- CSV format with headers

### 10. Testing and Verification

**Test Scenarios**:
1. **Get Overdue Workflows**: Call API and verify logging
2. **Trigger Escalation**: Manual escalation trigger and verify logging
3. **Get Next Approver**: Valid and invalid parameters, verify logging
4. **Manual Escalation**: Valid and invalid parameters, verify logging
5. **Error Scenarios**: Test validation errors and system errors

**Verification Steps**:
1. Check CSV file creation: `logs/events/events_MAINTENANCEAPPROVAL_YYYY-MM-DD.csv`
2. Verify log entries for each operation
3. Confirm detailed step-by-step logging works
4. Test error scenarios and error logging

### 11. Benefits

**Operational Benefits**:
- Complete audit trail for all workflow escalation operations
- Performance monitoring with duration tracking
- Error tracking and debugging capabilities
- User activity monitoring
- Escalation process visibility

**Technical Benefits**:
- Non-blocking logging for performance
- Context-aware routing to maintenance approval CSV
- Comprehensive error handling
- Detailed step-by-step operation tracking
- Easy debugging and troubleshooting

### 12. Maintenance Approval Integration

Since workflow escalation is part of the maintenance approval system:
- Uses `MAINTENANCEAPPROVAL` app_id for consistent logging
- Logs are written to the same CSV file as other maintenance approval operations
- Provides complete visibility into the maintenance approval workflow process
- Enables tracking of escalation triggers and outcomes

## Conclusion

The Workflow Escalation event logging implementation provides comprehensive logging for all operations within the workflow escalation module. The implementation includes detailed step-by-step logging, hierarchical log levels, non-blocking performance, and complete coverage of all user interactions and system operations.

All workflow escalation operations are now fully logged with detailed information for monitoring, debugging, and audit purposes, providing complete visibility into the maintenance approval escalation process.
