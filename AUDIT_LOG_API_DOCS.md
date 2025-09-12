# Audit Log API Documentation

## Overview

The Audit Log API provides functionality to record user actions in the application, but only for events that are enabled for specific apps. This API ensures that only authorized actions are logged and maintains a complete history of user activities.

## Key Features

✅ **Event Validation**: Only records actions for events that are enabled for the specific app  
✅ **User Tracking**: Records user_id and timestamp for all actions  
✅ **Complete History**: Maintains a comprehensive audit trail  
✅ **Flexible Querying**: Supports filtering by user, app, event, and date ranges  
✅ **Statistics**: Provides audit log statistics and analytics  

## Base URL

```
http://localhost:4000/api/audit-logs
```

## Authentication

All endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Record User Action

**Endpoint:** `POST /api/audit-logs/record`

**Description:** Records a user action only if the event is enabled for the specified app.

**Request Body:**
```json
{
  "app_id": "App005",
  "event_id": "Eve005",
  "text": "User created a new asset"
}
```

**Response (Success - Event Enabled):**
```json
{
  "success": true,
  "message": "User action recorded successfully",
  "data": {
    "audit_log": {
      "al_id": "AL84833054TTIO",
      "user_id": "USR001",
      "app_id": "App005",
      "event_id": "Eve005",
      "text": "User created a new asset",
      "created_on": "2025-09-11T04:30:33.089Z",
      "org_id": "ORG001"
    },
    "event_config": {
      "alc_id": "ALC001",
      "app_id": "App005",
      "event_id": "Eve005",
      "enabled": true,
      "reporting_required": true,
      "description": ""
    }
  }
}
```

**Response (Event Not Enabled):**
```json
{
  "success": false,
  "message": "Event 'Eve011' is not enabled for app 'App005'",
  "data": null,
  "recorded": false
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:4000/api/audit-logs/record" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "App005",
    "event_id": "Eve005",
    "text": "User created a new asset"
  }'
```

### 2. Get User Audit Logs

**Endpoint:** `GET /api/audit-logs/user`

**Description:** Retrieves audit logs for the current authenticated user.

**Query Parameters:**
- `limit` (number, optional): Number of records to return (1-1000, default: 50)
- `offset` (number, optional): Number of records to skip (default: 0)
- `app_id` (string, optional): Filter by app ID
- `event_id` (string, optional): Filter by event ID

**Response:**
```json
{
  "success": true,
  "message": "Found 6 audit log entries for user",
  "data": {
    "user_id": "USR001",
    "audit_logs": [
      {
        "al_id": "AL84833054TTIO",
        "user_id": "USR001",
        "app_id": "App005",
        "event_id": "Eve005",
        "text": "User created a new asset",
        "created_on": "2025-09-11T04:30:33.089Z",
        "org_id": "ORG001",
        "app_name": "Assets",
        "event_name": "Create"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "count": 6
    }
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/audit-logs/user?limit=20&app_id=App005" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 3. Get App Audit Logs

**Endpoint:** `GET /api/audit-logs/app/:appId`

**Description:** Retrieves audit logs for a specific app.

**Path Parameters:**
- `appId` (string, required): The app ID

**Query Parameters:**
- `limit` (number, optional): Number of records to return (1-1000, default: 50)
- `offset` (number, optional): Number of records to skip (default: 0)
- `user_id` (string, optional): Filter by user ID
- `event_id` (string, optional): Filter by event ID

**Response:**
```json
{
  "success": true,
  "message": "Found 6 audit log entries for app 'App005'",
  "data": {
    "app_id": "App005",
    "audit_logs": [
      {
        "al_id": "AL84833054TTIO",
        "user_id": "USR001",
        "app_id": "App005",
        "event_id": "Eve005",
        "text": "User created a new asset",
        "created_on": "2025-09-11T04:30:33.089Z",
        "org_id": "ORG001",
        "app_name": "Assets",
        "event_name": "Create"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "count": 6
    }
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/audit-logs/app/App005?limit=10&user_id=USR001" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 4. Get Audit Log Statistics

**Endpoint:** `GET /api/audit-logs/stats`

**Description:** Retrieves audit log statistics with optional filtering.

**Query Parameters:**
- `app_id` (string, optional): Filter by app ID
- `user_id` (string, optional): Filter by user ID
- `event_id` (string, optional): Filter by event ID
- `date_from` (string, optional): Start date (YYYY-MM-DD)
- `date_to` (string, optional): End date (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "message": "Audit log statistics retrieved successfully",
  "data": {
    "statistics": {
      "total_actions": "6",
      "unique_users": "1",
      "unique_apps": "1",
      "unique_events": "3"
    },
    "filters": {
      "app_id": "App005",
      "date_from": "2025-01-01",
      "date_to": "2025-01-31"
    }
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/audit-logs/stats?app_id=App005&date_from=2025-01-01&date_to=2025-01-31" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 5. Check Event Status

**Endpoint:** `GET /api/audit-logs/check/:appId/:eventId`

**Description:** Checks if an event is enabled for a specific app.

**Path Parameters:**
- `appId` (string, required): The app ID
- `eventId` (string, required): The event ID

**Response (Event Enabled):**
```json
{
  "success": true,
  "message": "Event 'Eve005' is enabled for app 'App005'",
  "data": {
    "enabled": true,
    "event_config": {
      "alc_id": "ALC001",
      "app_id": "App005",
      "event_id": "Eve005",
      "enabled": true,
      "reporting_required": true,
      "description": ""
    }
  }
}
```

**Response (Event Disabled):**
```json
{
  "success": false,
  "message": "Event 'Eve011' is not enabled for app 'App005'",
  "data": {
    "enabled": false,
    "event_config": null
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/audit-logs/check/App005/Eve005" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields: app_id, event_id, and text are required",
  "data": null
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthorized: No token provided"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error while recording user action",
  "data": null,
  "error": "Detailed error message (only in development)"
}
```

## Database Schema

The API works with the following database tables:

### tblAuditLogs
- `al_id` (VARCHAR(20), PRIMARY KEY): Unique identifier for the audit log entry
- `user_id` (VARCHAR(20)): User who performed the action
- `app_id` (VARCHAR(20)): App where the action occurred
- `event_id` (VARCHAR(20)): Event that was triggered
- `text` (VARCHAR(100)): Description of the action
- `created_on` (TIMESTAMP): When the action was recorded
- `org_id` (VARCHAR(20)): Organization ID

### tblAuditLogConfig
- `alc_id` (VARCHAR(20), PRIMARY KEY): Configuration ID
- `app_id` (VARCHAR(20)): App ID
- `event_id` (VARCHAR(20)): Event ID
- `enabled` (BOOLEAN): Whether the event is enabled for this app
- `reporting_required` (BOOLEAN): Whether reporting is required
- `reporting_email` (VARCHAR(50)): Email for reporting notifications
- `description` (VARCHAR(50)): Additional description
- `org_id` (VARCHAR(20)): Organization ID

## Usage Examples

### Frontend Integration

```javascript
// Record a user action
async function recordUserAction(appId, eventId, actionText) {
  try {
    const response = await fetch('/api/audit-logs/record', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        event_id: eventId,
        text: actionText
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Action recorded:', data.data.audit_log);
    } else {
      console.log('Action not recorded:', data.message);
    }
    
    return data;
  } catch (error) {
    console.error('Error recording action:', error);
    return null;
  }
}

// Usage in a React component
function AssetManagement() {
  const handleCreateAsset = async () => {
    // Perform the actual asset creation
    const result = await createAsset(assetData);
    
    // Record the action (only if event is enabled)
    await recordUserAction('App005', 'Eve005', 'User created a new asset');
    
    return result;
  };
  
  const handleUpdateAsset = async () => {
    // Perform the actual asset update
    const result = await updateAsset(assetId, assetData);
    
    // Record the action (only if event is enabled)
    await recordUserAction('App005', 'Eve008', 'User updated an asset');
    
    return result;
  };
  
  return (
    <div>
      <button onClick={handleCreateAsset}>Create Asset</button>
      <button onClick={handleUpdateAsset}>Update Asset</button>
    </div>
  );
}
```

### Backend Integration

```javascript
// Middleware to automatically record actions
const auditMiddleware = (appId, eventId, actionText) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to record action after successful response
    res.json = function(data) {
      // Only record if the response was successful
      if (data.success !== false && res.statusCode < 400) {
        // Record the action asynchronously (don't wait for it)
        AuditLogModel.recordUserAction({
          user_id: req.user.user_id,
          app_id: appId,
          event_id: eventId,
          text: actionText,
          org_id: req.user.org_id
        }).catch(error => {
          console.error('Failed to record audit log:', error);
        });
      }
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Usage in routes
router.post('/assets', 
  authMiddleware,
  auditMiddleware('App005', 'Eve005', 'User created a new asset'),
  createAsset
);
```

## Implementation Notes

1. **Event Validation**: The API automatically checks if an event is enabled before recording
2. **Automatic Timestamps**: All audit logs include automatic timestamps
3. **User Context**: User information is automatically extracted from JWT token
4. **Text Truncation**: Long action descriptions are automatically truncated to 100 characters
5. **ID Generation**: Short, unique IDs are generated for audit log entries
6. **Pagination**: All list endpoints support pagination for large datasets
7. **Filtering**: Comprehensive filtering options for all query endpoints

## Security Considerations

1. **JWT Authentication**: All requests must include a valid JWT token
2. **Event Authorization**: Only enabled events are recorded
3. **User Context**: User information is extracted from authenticated token
4. **Input Validation**: All inputs are validated before processing
5. **SQL Injection Prevention**: Parameterized queries prevent SQL injection
6. **Error Handling**: Sensitive information is not exposed in error messages

## Performance Considerations

1. **Asynchronous Recording**: Audit logging doesn't block main application flow
2. **Efficient Queries**: Optimized database queries with proper indexing
3. **Pagination**: Large result sets are paginated to prevent memory issues
4. **Connection Pooling**: Database connections are pooled for efficiency

## Future Enhancements

1. **Real-time Notifications**: WebSocket support for real-time audit log updates
2. **Advanced Analytics**: More detailed statistics and reporting
3. **Export Functionality**: Export audit logs to various formats
4. **Retention Policies**: Automatic cleanup of old audit logs
5. **Audit Log Archiving**: Archive old logs to separate storage
6. **Advanced Filtering**: More sophisticated filtering and search options
