# App Events API Documentation

## Overview

The App Events API provides functionality to retrieve enabled events for specific applications. This API allows frontend applications to dynamically show only the events that are configured as enabled for each app/screen.

## Base URL

```
http://localhost:4000/api/app-events
```

## Authentication

All endpoints require JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Enabled Events for App

**Endpoint:** `GET /api/app-events/enabled/:appId`

**Description:** Retrieves only the events that are enabled for a specific app.

**Parameters:**
- `appId` (string, required): The app ID from the tblApps table

**Response:**
```json
{
  "success": true,
  "message": "Found 6 enabled events for app 'Assets'",
  "data": {
    "app": {
      "app_id": "App005",
      "app_name": "Assets",
      "org_id": "ORG001"
    },
    "enabled_events": [
      {
        "event_id": "Eve005",
        "text": "Create",
        "enabled": true,
        "reporting_required": true,
        "reporting_email": "nivethakaliyappan@gmail.com",
        "config_description": ""
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/app-events/enabled/App005" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 2. Get All Events for App

**Endpoint:** `GET /api/app-events/all/:appId`

**Description:** Retrieves all events for a specific app (both enabled and disabled).

**Parameters:**
- `appId` (string, required): The app ID from the tblApps table

**Response:**
```json
{
  "success": true,
  "message": "Found 8 total events for app 'Assets' (6 enabled, 2 disabled)",
  "data": {
    "app": {
      "app_id": "App005",
      "app_name": "Assets",
      "org_id": "ORG001"
    },
    "enabled_events": [
      {
        "event_id": "Eve005",
        "text": "Create",
        "enabled": true,
        "reporting_required": true,
        "reporting_email": "nivethakaliyappan@gmail.com",
        "config_description": ""
      }
    ],
    "disabled_events": [
      {
        "event_id": "Eve011",
        "text": "Cancel",
        "enabled": false,
        "reporting_required": false,
        "reporting_email": null,
        "config_description": ""
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/app-events/all/App005" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 3. Get All Apps

**Endpoint:** `GET /api/app-events/apps`

**Description:** Retrieves all available apps from the system.

**Response:**
```json
{
  "success": true,
  "message": "Found 11 available apps",
  "data": {
    "apps": [
      {
        "app_id": "App005",
        "app_name": "Assets",
        "org_id": "ORG001",
        "status": true
      },
      {
        "app_id": "App004",
        "app_name": "Dashboard",
        "org_id": "ORG001",
        "status": true
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/app-events/apps" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

### 4. Get All Events

**Endpoint:** `GET /api/app-events/events`

**Description:** Retrieves all available events from the system.

**Response:**
```json
{
  "success": true,
  "message": "Found 11 available events",
  "data": {
    "events": [
      {
        "event_id": "Eve005",
        "text": "Create"
      },
      {
        "event_id": "Eve006",
        "text": "Delete"
      }
    ]
  }
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:4000/api/app-events/events" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json"
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "App ID is required",
  "data": null
}
```

### 401 Unauthorized
```json
{
  "message": "Unauthorized: No token provided"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "App with ID 'NonExistentApp' not found",
  "data": null
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error while fetching enabled events",
  "data": null,
  "error": "Detailed error message (only in development)"
}
```

## Database Schema

The API works with the following database tables:

### tblApps
- `app_id` (VARCHAR, PRIMARY KEY): Unique identifier for the app
- `text` (VARCHAR): Display name of the app
- `int_status` (BOOLEAN): Whether the app is active
- `org_id` (VARCHAR): Organization ID

### tblEvents
- `event_id` (VARCHAR, PRIMARY KEY): Unique identifier for the event
- `text` (VARCHAR): Display name of the event

### tblAuditLogConfig
- `alc_id` (VARCHAR, PRIMARY KEY): Unique identifier for the configuration
- `app_id` (VARCHAR, FOREIGN KEY): References tblApps.app_id
- `event_id` (VARCHAR, FOREIGN KEY): References tblEvents.event_id
- `enabled` (BOOLEAN): Whether the event is enabled for this app
- `reporting_required` (BOOLEAN): Whether reporting is required for this event
- `reporting_email` (VARCHAR): Email for reporting notifications
- `description` (VARCHAR): Additional description
- `org_id` (VARCHAR): Organization ID

## Usage Examples

### Frontend Integration

```javascript
// Get enabled events for the current app
async function getEnabledEvents(appId) {
  try {
    const response = await fetch(`/api/app-events/enabled/${appId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.data.enabled_events;
    } else {
      console.error('Error:', data.message);
      return [];
    }
  } catch (error) {
    console.error('Network error:', error);
    return [];
  }
}

// Usage in a React component
function MyComponent() {
  const [enabledEvents, setEnabledEvents] = useState([]);
  
  useEffect(() => {
    getEnabledEvents('App005').then(setEnabledEvents);
  }, []);
  
  return (
    <div>
      {enabledEvents.map(event => (
        <button key={event.event_id}>
          {event.text}
        </button>
      ))}
    </div>
  );
}
```

### Testing with cURL

```bash
# Generate a test token (replace with your actual JWT secret)
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({
  org_id: 'ORG001',
  user_id: 'USR001',
  job_role_id: 'JR001',
  email: 'test@example.com',
  emp_int_id: 'EMP001'
}, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log(token);
"

# Test the API
curl -X GET "http://localhost:4000/api/app-events/enabled/App005" \
  -H "Authorization: Bearer <generated-token>" \
  -H "Content-Type: application/json"
```

## Implementation Notes

1. **Authentication**: All endpoints require valid JWT authentication
2. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
3. **Data Validation**: Input validation for required parameters
4. **Response Format**: Consistent JSON response format with success/error indicators
5. **Database Relations**: Proper JOIN queries to fetch related data from multiple tables
6. **Performance**: Optimized queries with proper indexing on foreign keys

## Security Considerations

1. **JWT Authentication**: All requests must include a valid JWT token
2. **Input Validation**: App IDs are validated against the database
3. **Error Messages**: Sensitive information is not exposed in error messages
4. **SQL Injection**: Parameterized queries prevent SQL injection attacks

## Future Enhancements

1. **Caching**: Implement Redis caching for frequently accessed data
2. **Pagination**: Add pagination support for large datasets
3. **Filtering**: Add filtering options for events and apps
4. **Audit Logging**: Log API access for security monitoring
5. **Rate Limiting**: Implement rate limiting to prevent abuse
