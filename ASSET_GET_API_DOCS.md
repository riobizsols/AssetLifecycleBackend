# Asset GET API Documentation

## Overview
The Asset GET API provides comprehensive retrieval operations for assets in the Asset Lifecycle Management system with various filtering and search capabilities.

## Base URL
```
http://localhost:5001/api/assets
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. GET /api/assets
**Get all assets (with optional query filters)**

**Query Parameters (all optional):**
- `asset_type_id`: Filter by asset type ID
- `branch_id`: Filter by branch ID
- `vendor_id`: Filter by vendor ID
- `status`: Filter by current status
- `org_id`: Filter by organization ID
- `search`: Search in text, serial_number, description, or asset_id

**Examples:**
```
GET /api/assets
GET /api/assets?asset_type_id=AST001
GET /api/assets?branch_id=BR001
GET /api/assets?status=Active
GET /api/assets?search=laptop
GET /api/assets?asset_type_id=AST001&status=Active
```

**Response (200 OK):**
```json
[
    {
        "asset_type_id": "AST001",
        "ext_id": "123e4567-e89b-12d3-a456-426614174000",
        "asset_id": "AST001",
        "text": "Laptop Computer",
        "serial_number": "LAP123456",
        "description": "Dell Latitude 5520",
        "branch_id": "BR001",
        "vendor_id": "VEN001",
        "prod_serve_id": "PS001",
        "maintsch_id": "MT001",
        "purchased_cost": 1200.00,
        "purchased_on": "2024-01-15",
        "purchased_by": "EMP001",
        "expiry_date": "2027-01-15",
        "current_status": "Active",
        "warranty_period": "3 years",
        "parent_id": null,
        "group_id": null,
        "org_id": "ORG001",
        "created_by": "EMP001",
        "created_on": "2024-01-15T00:00:00.000Z",
        "changed_by": null,
        "changed_on": null
    }
]
```

### 2. GET /api/assets/:id
**Get asset by ID**

**Response (200 OK):**
```json
{
    "asset_type_id": "AST001",
    "ext_id": "123e4567-e89b-12d3-a456-426614174000",
    "asset_id": "AST001",
    "text": "Laptop Computer",
    "serial_number": "LAP123456",
    "description": "Dell Latitude 5520",
    "branch_id": "BR001",
    "vendor_id": "VEN001",
    "prod_serve_id": "PS001",
    "maintsch_id": "MT001",
    "purchased_cost": 1200.00,
    "purchased_on": "2024-01-15",
    "purchased_by": "EMP001",
    "expiry_date": "2027-01-15",
    "current_status": "Active",
    "warranty_period": "3 years",
    "parent_id": null,
    "group_id": null,
    "org_id": "ORG001",
    "created_by": "EMP001",
    "created_on": "2024-01-15T00:00:00.000Z",
    "changed_by": null,
    "changed_on": null
}
```

**Error Responses:**
- `404 Not Found`: Asset not found

### 3. GET /api/assets/details/:id
**Get asset with detailed information (including related data)**

**Response (200 OK):**
```json
{
    "asset_type_id": "AST001",
    "ext_id": "123e4567-e89b-12d3-a456-426614174000",
    "asset_id": "AST001",
    "text": "Laptop Computer",
    "serial_number": "LAP123456",
    "description": "Dell Latitude 5520",
    "branch_id": "BR001",
    "vendor_id": "VEN001",
    "prod_serve_id": "PS001",
    "maintsch_id": "MT001",
    "purchased_cost": 1200.00,
    "purchased_on": "2024-01-15",
    "purchased_by": "EMP001",
    "expiry_date": "2027-01-15",
    "current_status": "Active",
    "warranty_period": "3 years",
    "parent_id": null,
    "group_id": null,
    "org_id": "ORG001",
    "created_by": "EMP001",
    "created_on": "2024-01-15T00:00:00.000Z",
    "changed_by": null,
    "changed_on": null,
    "asset_type_name": "Laptop",
    "branch_name": "Main Office",
    "vendor_name": "Dell Inc.",
    "prod_serv_name": "Dell Latitude 5520"
}
```

### 4. GET /api/assets/type/:asset_type_id
**Get assets by asset type**

**Response (200 OK):**
```json
[
    {
        "asset_type_id": "AST001",
        "ext_id": "123e4567-e89b-12d3-a456-426614174000",
        "asset_id": "AST001",
        "text": "Laptop Computer",
        "serial_number": "LAP123456",
        "description": "Dell Latitude 5520",
        "branch_id": "BR001",
        "vendor_id": "VEN001",
        "prod_serve_id": "PS001",
        "maintsch_id": "MT001",
        "purchased_cost": 1200.00,
        "purchased_on": "2024-01-15",
        "purchased_by": "EMP001",
        "expiry_date": "2027-01-15",
        "current_status": "Active",
        "warranty_period": "3 years",
        "parent_id": null,
        "group_id": null,
        "org_id": "ORG001",
        "created_by": "EMP001",
        "created_on": "2024-01-15T00:00:00.000Z",
        "changed_by": null,
        "changed_on": null
    }
]
```

### 5. GET /api/assets/branch/:branch_id
**Get assets by branch**

### 6. GET /api/assets/vendor/:vendor_id
**Get assets by vendor**

### 7. GET /api/assets/status/:status
**Get assets by status**

### 8. GET /api/assets/org/:org_id
**Get assets by organization**

### 9. GET /api/assets/search?q=searchTerm
**Search assets**

**Query Parameters:**
- `q`: Search term (required)

**Examples:**
```
GET /api/assets/search?q=laptop
GET /api/assets/search?q=LAP123456
GET /api/assets/search?q=Dell
```

## Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| asset_type_id | string | Asset type identifier |
| ext_id | string (UUID) | External identifier for the asset |
| asset_id | string | Unique asset identifier |
| text | string | Asset name/description |
| serial_number | string | Asset serial number |
| description | string | Detailed asset description |
| branch_id | string | Branch identifier |
| vendor_id | string | Vendor identifier |
| prod_serve_id | string | Product/Service identifier |
| maintsch_id | string | Maintenance schedule identifier |
| purchased_cost | number | Purchase cost of the asset |
| purchased_on | date | Purchase date |
| purchased_by | string | User who purchased the asset |
| expiry_date | date | Asset expiry date |
| current_status | string | Current status of the asset |
| warranty_period | string | Warranty period description |
| parent_id | string | Parent asset identifier (for hierarchical assets) |
| group_id | string | Group identifier |
| org_id | string | Organization identifier |
| created_by | string | User who created the record |
| created_on | timestamp | Creation timestamp |
| changed_by | string | User who last modified the record |
| changed_on | timestamp | Last modification timestamp |

## Example Usage

### cURL Examples

**Get all assets:**
```bash
curl -X GET http://localhost:5001/api/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get asset by ID:**
```bash
curl -X GET http://localhost:5001/api/assets/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get asset with details:**
```bash
curl -X GET http://localhost:5001/api/assets/details/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get assets by type:**
```bash
curl -X GET http://localhost:5001/api/assets/type/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Get assets by branch:**
```bash
curl -X GET http://localhost:5001/api/assets/branch/BR001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Search assets:**
```bash
curl -X GET "http://localhost:5001/api/assets/search?q=laptop" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Filter assets:**
```bash
curl -X GET "http://localhost:5001/api/assets?asset_type_id=AST001&status=Active" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

The assets are stored in the `tblAssets` table with the following structure:

```sql
CREATE TABLE "tblAssets" (
    asset_type_id VARCHAR,
    ext_id VARCHAR NOT NULL,
    asset_id VARCHAR PRIMARY KEY,
    text VARCHAR NOT NULL,
    serial_number VARCHAR,
    description TEXT,
    branch_id VARCHAR,
    vendor_id VARCHAR,
    prod_serve_id VARCHAR,
    maintsch_id VARCHAR,
    purchased_cost DECIMAL(10,2),
    purchased_on DATE,
    purchased_by VARCHAR,
    expiry_date DATE,
    current_status VARCHAR,
    warranty_period VARCHAR,
    parent_id VARCHAR,
    group_id VARCHAR,
    org_id VARCHAR NOT NULL,
    created_by VARCHAR NOT NULL,
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR,
    changed_on TIMESTAMP
);
```

## Error Handling

The API includes comprehensive error handling for:
- Invalid asset IDs
- Database connection issues
- Authentication failures
- Missing search parameters

All errors return appropriate HTTP status codes and descriptive error messages.

## Performance Considerations

- All queries include proper indexing recommendations
- Search functionality uses ILIKE for case-insensitive matching
- Detailed queries include LEFT JOINs to avoid missing data
- Results are ordered by creation date (newest first) 