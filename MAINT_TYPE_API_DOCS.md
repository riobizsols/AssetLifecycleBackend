# Maintenance Types API Documentation

This document describes the API endpoints for managing maintenance types in the Asset Lifecycle Management system.

## Base URL
```
http://localhost:5001/api/maint-types
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get All Maintenance Types
**GET** `/api/maint-types`

Retrieves all maintenance types from the database.

**Response:**
```json
[
  {
    "maint_type_id": 1,
    "text": "Preventive Maintenance",
    "int_status": 1,
    "created_by": "user123",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user123",
    "changed_on": "2024-01-15T10:30:00Z"
  },
  {
    "maint_type_id": 2,
    "text": "Corrective Maintenance",
    "int_status": 1,
    "created_by": "user456",
    "created_on": "2024-01-16T14:20:00Z",
    "changed_by": "user456",
    "changed_on": "2024-01-16T14:20:00Z"
  }
]
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 2. Get Maintenance Type by ID
**GET** `/api/maint-types/:id`

Retrieves a specific maintenance type by its ID.

**Parameters:**
- `id` (path parameter) - The maintenance type ID

**Response:**
```json
{
  "maint_type_id": 1,
  "text": "Preventive Maintenance",
  "int_status": 1,
  "created_by": "user123",
  "created_on": "2024-01-15T10:30:00Z",
  "changed_by": "user123",
  "changed_on": "2024-01-15T10:30:00Z"
}
```

**Status Codes:**
- `200` - Success
- `404` - Maintenance type not found
- `500` - Internal server error

---

### 3. Add New Maintenance Type
**POST** `/api/maint-types`

Creates a new maintenance type.

**Request Body:**
```json
{
  "text": "Emergency Maintenance",
  "int_status": 1
}
```

**Required Fields:**
- `text` (string) - The name/description of the maintenance type

**Optional Fields:**
- `int_status` (number) - Status (1 for active, 0 for inactive). Defaults to 1.

**Response:**
```json
{
  "message": "Maintenance type added successfully",
  "maint_type": {
    "maint_type_id": 3,
    "text": "Emergency Maintenance",
    "int_status": 1,
    "created_by": "user789",
    "created_on": "2024-01-17T09:15:00Z",
    "changed_by": "user789",
    "changed_on": "2024-01-17T09:15:00Z"
  }
}
```

**Status Codes:**
- `201` - Created successfully
- `400` - Bad request (missing required fields)
- `409` - Conflict (maintenance type with same name already exists)
- `500` - Internal server error

---

### 4. Update Maintenance Type
**PUT** `/api/maint-types/:id`

Updates an existing maintenance type.

**Parameters:**
- `id` (path parameter) - The maintenance type ID

**Request Body:**
```json
{
  "text": "Updated Preventive Maintenance",
  "int_status": 0
}
```

**Optional Fields:**
- `text` (string) - The updated name/description
- `int_status` (number) - Updated status (1 for active, 0 for inactive)

**Response:**
```json
{
  "message": "Maintenance type updated successfully",
  "maint_type": {
    "maint_type_id": 1,
    "text": "Updated Preventive Maintenance",
    "int_status": 0,
    "created_by": "user123",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user789",
    "changed_on": "2024-01-17T11:45:00Z"
  }
}
```

**Status Codes:**
- `200` - Updated successfully
- `400` - Bad request
- `404` - Maintenance type not found
- `409` - Conflict (maintenance type with same name already exists)
- `500` - Internal server error

---

### 5. Delete Maintenance Type
**DELETE** `/api/maint-types/:id`

Deletes a maintenance type.

**Parameters:**
- `id` (path parameter) - The maintenance type ID

**Response:**
```json
{
  "message": "Maintenance type deleted successfully",
  "deleted": {
    "maint_type_id": 3,
    "text": "Emergency Maintenance",
    "int_status": 1,
    "created_by": "user789",
    "created_on": "2024-01-17T09:15:00Z",
    "changed_by": "user789",
    "changed_on": "2024-01-17T09:15:00Z"
  }
}
```

**Status Codes:**
- `200` - Deleted successfully
- `404` - Maintenance type not found
- `500` - Internal server error

---

## Error Responses

### Bad Request (400)
```json
{
  "error": "Maintenance type name (text) is required"
}
```

### Not Found (404)
```json
{
  "error": "Maintenance type not found"
}
```

### Conflict (409)
```json
{
  "error": "Maintenance type with this name already exists"
}
```

### Internal Server Error (500)
```json
{
  "error": "Internal server error",
  "details": "Database connection failed"
}
```

---

## Database Schema

The maintenance types are stored in the `tblMaintTypes` table with the following structure:

```sql
CREATE TABLE "tblMaintTypes" (
    maint_type_id SERIAL PRIMARY KEY,
    text VARCHAR(255) NOT NULL,
    int_status INTEGER DEFAULT 1,
    created_by VARCHAR(255),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255),
    changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Usage Examples

### Using cURL

**Get all maintenance types:**
```bash
curl -X GET http://localhost:5001/api/maint-types \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Add new maintenance type:**
```bash
curl -X POST http://localhost:5001/api/maint-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "text": "Routine Maintenance",
    "int_status": 1
  }'
```

**Update maintenance type:**
```bash
curl -X PUT http://localhost:5001/api/maint-types/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{
    "text": "Updated Routine Maintenance",
    "int_status": 0
  }'
```

**Delete maintenance type:**
```bash
curl -X DELETE http://localhost:5001/api/maint-types/3 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Using JavaScript/Fetch

**Get all maintenance types:**
```javascript
const response = await fetch('http://localhost:5001/api/maint-types', {
  headers: {
    'Authorization': 'Bearer <your-jwt-token>'
  }
});
const maintTypes = await response.json();
```

**Add new maintenance type:**
```javascript
const response = await fetch('http://localhost:5001/api/maint-types', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-jwt-token>'
  },
  body: JSON.stringify({
    text: 'Routine Maintenance',
    int_status: 1
  })
});
const result = await response.json();
``` 