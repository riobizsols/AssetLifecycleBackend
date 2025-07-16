# Asset Type API Documentation

## Overview
The Asset Type API provides CRUD operations for managing asset types in the Asset Lifecycle Management system.

## Base URL
```
http://localhost:5001/api/asset-types
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. POST /api/asset-types
**Add a new asset type**

**Request Body:**
```json
{
    "ext_id": "string (required, must be valid UUID)",
    "org_id": "string (required)",
    "asset_type_id": "string (optional, auto-generated if not provided)",
    "int_status": "number (optional, default: 1)",
    "maintenance_schedule": "string (optional)",
    "assignment_type": "string (optional)",
    "inspection_required": "boolean (optional, default: false)",
    "group_required": "boolean (optional, default: false)",
    "text": "string (required)"
}
```

**Response (201 Created):**
```json
{
    "message": "Asset type added successfully",
    "asset_type": {
        "ext_id": "TEST001",
        "org_id": "ORG001",
        "asset_type_id": "AST001",
        "int_status": 1,
        "maintenance_schedule": "Monthly",
        "assignment_type": "Individual",
        "inspection_required": true,
        "group_required": false,
        "created_by": "user_id",
        "created_on": "2024-01-01T00:00:00.000Z",
        "changed_by": null,
        "changed_on": null,
        "text": "Test Asset Type"
    }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid UUID format for ext_id
- `409 Conflict`: Asset type with same ext_id and org_id already exists, or asset_type_id already exists
- `500 Internal Server Error`: Server error

### 2. GET /api/asset-types
**Get all asset types**

**Response (200 OK):**
```json
[
    {
        "ext_id": "TEST001",
        "org_id": "ORG001",
        "asset_type_id": "AST001",
        "int_status": 1,
        "maintenance_schedule": "Monthly",
        "assignment_type": "Individual",
        "inspection_required": true,
        "group_required": false,
        "created_by": "user_id",
        "created_on": "2024-01-01T00:00:00.000Z",
        "changed_by": null,
        "changed_on": null,
        "text": "Test Asset Type"
    }
]
```

### 3. GET /api/asset-types/:id
**Get asset type by ID**

**Response (200 OK):**
```json
{
    "ext_id": "TEST001",
    "org_id": "ORG001",
    "asset_type_id": "AST001",
    "int_status": 1,
    "maintenance_schedule": "Monthly",
    "assignment_type": "Individual",
    "inspection_required": true,
    "group_required": false,
    "created_by": "user_id",
    "created_on": "2024-01-01T00:00:00.000Z",
    "changed_by": null,
    "changed_on": null,
    "text": "Test Asset Type"
}
```

**Error Responses:**
- `404 Not Found`: Asset type not found

### 4. PUT /api/asset-types/:id
**Update asset type**

**Request Body:**
```json
{
    "ext_id": "string (optional)",
    "org_id": "string (optional)",
    "int_status": "number (optional)",
    "maintenance_schedule": "string (optional)",
    "assignment_type": "string (optional)",
    "inspection_required": "boolean (optional)",
    "group_required": "boolean (optional)",
    "text": "string (optional)"
}
```

**Response (200 OK):**
```json
{
    "message": "Asset type updated successfully",
    "asset_type": {
        "ext_id": "TEST001",
        "org_id": "ORG001",
        "asset_type_id": "AST001",
        "int_status": 1,
        "maintenance_schedule": "Weekly",
        "assignment_type": "Individual",
        "inspection_required": true,
        "group_required": false,
        "created_by": "user_id",
        "created_on": "2024-01-01T00:00:00.000Z",
        "changed_by": "user_id",
        "changed_on": "2024-01-01T01:00:00.000Z",
        "text": "Updated Test Asset Type"
    }
}
```

**Error Responses:**
- `404 Not Found`: Asset type not found
- `409 Conflict`: Asset type with same ext_id and org_id already exists

### 5. DELETE /api/asset-types/:id
**Delete asset type**

**Response (200 OK):**
```json
{
    "message": "Asset type deleted successfully"
}
```

**Error Responses:**
- `404 Not Found`: Asset type not found

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ext_id | string (UUID) | Yes | External identifier for the asset type (must be valid UUID format) |
| org_id | string | Yes | Organization identifier |
| asset_type_id | string | Optional | Unique asset type identifier (auto-generated if not provided) |
| int_status | number | No | Internal status (default: 1) |
| maintenance_schedule | string | No | Maintenance schedule description |
| assignment_type | string | No | Type of assignment (e.g., "Individual", "Group") |
| inspection_required | boolean | No | Whether inspection is required (default: false) |
| group_required | boolean | No | Whether group assignment is required (default: false) |
| created_by | string | Auto-generated | User ID who created the record |
| created_on | timestamp | Auto-generated | Creation timestamp |
| changed_by | string | Auto-generated | User ID who last modified the record |
| changed_on | timestamp | Auto-generated | Last modification timestamp |
| text | string | Yes | Display name/description of the asset type |

## Example Usage

### cURL Examples

**Add new asset type (auto-generated ID):**
```bash
curl -X POST http://localhost:5001/api/asset-types \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ext_id": "123e4567-e89b-12d3-a456-426614174000",
    "org_id": "ORG001",
    "maintenance_schedule": "Quarterly",
    "assignment_type": "Individual",
    "inspection_required": true,
    "group_required": false,
    "text": "Laptop Computer"
  }'
```

**Add new asset type (manual ID):**
```bash
curl -X POST http://localhost:5001/api/asset-types \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ext_id": "987fcdeb-51a2-43d1-9f12-345678901234",
    "org_id": "ORG001",
    "asset_type_id": "AST999",
    "maintenance_schedule": "Quarterly",
    "assignment_type": "Individual",
    "inspection_required": true,
    "group_required": false,
    "text": "Laptop Computer"
  }'
```

**Get all asset types:**
```bash
curl -X GET http://localhost:5001/api/asset-types \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Update asset type:**
```bash
curl -X PUT http://localhost:5001/api/asset-types/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenance_schedule": "Monthly",
    "text": "Updated Laptop Computer"
  }'
```

**Delete asset type:**
```bash
curl -X DELETE http://localhost:5001/api/asset-types/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

The asset types are stored in the `tblAssetTypes` table with the following structure:

```sql
CREATE TABLE "tblAssetTypes" (
    ext_id VARCHAR NOT NULL,
    org_id VARCHAR NOT NULL,
    asset_type_id VARCHAR PRIMARY KEY,
    int_status INTEGER DEFAULT 1,
    maintenance_schedule VARCHAR,
    assignment_type VARCHAR,
    inspection_required BOOLEAN DEFAULT false,
    group_required BOOLEAN DEFAULT false,
    created_by VARCHAR NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR,
    changed_on TIMESTAMP,
    text VARCHAR NOT NULL
);
```

## ID Generation

Asset type IDs are automatically generated using the pattern `AST###` where `###` is a sequential number (e.g., AST001, AST002, etc.). The ID generation is handled by the `generateCustomId` utility with the key `"asset_type"`.

## Error Handling

The API includes comprehensive error handling for:
- Missing required fields
- Duplicate asset types (same ext_id and org_id)
- Invalid asset type IDs
- Database connection issues
- Authentication failures

All errors return appropriate HTTP status codes and descriptive error messages. 