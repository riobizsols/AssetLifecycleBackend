# Asset POST API Documentation

## Overview
The Asset POST API allows you to add new assets to the Asset Lifecycle Management system with comprehensive validation and automatic ID generation.

## Base URL
```
http://localhost:5001/api/assets
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoint

### POST /api/assets
**Add a new asset**

**Request Body:**
```json
{
    "asset_type_id": "string (optional)",
    "ext_id": "string (required, must be valid UUID)",
    "asset_id": "string (required)",
    "text": "string (required)",
    "serial_number": "string (optional)",
    "description": "string (optional)",
    "branch_id": "string (optional)",
    "vendor_id": "string (optional)",
    "prod_serve_id": "string (optional)",
    "maintsch_id": "string (optional)",
    "purchased_cost": "number (optional)",
    "purchased_on": "date (optional)",
    "purchased_by": "string (optional)",
    "expiry_date": "date (optional)",
    "current_status": "string (optional, default: 'Active')",
    "warranty_period": "string (optional)",
    "parent_id": "string (optional)",
    "group_id": "string (optional)",
    "org_id": "string (required)"
}
```

**Response (201 Created):**
```json
{
    "message": "Asset added successfully",
    "asset": {
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
        "changed_by": "EMP001",
        "changed_on": "2024-01-15T00:00:00.000Z"
    }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields or invalid UUID format for ext_id
- `409 Conflict`: Asset with same ext_id and org_id already exists, or asset_id already exists
- `500 Internal Server Error`: Server error

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| asset_type_id | string | No | Asset type identifier |
| ext_id | string (UUID) | Yes | External identifier for the asset (must be valid UUID format) |
| asset_id | string | Yes | Unique asset identifier (must be provided manually) |
| text | string | Yes | Asset name/description |
| serial_number | string | No | Asset serial number |
| description | string | No | Detailed asset description |
| branch_id | string | No | Branch identifier |
| vendor_id | string | No | Vendor identifier |
| prod_serve_id | string | No | Product/Service identifier |
| maintsch_id | string | No | Maintenance schedule identifier |
| purchased_cost | number | No | Purchase cost of the asset |
| purchased_on | date | No | Purchase date (YYYY-MM-DD format) |
| purchased_by | string | No | User who purchased the asset |
| expiry_date | date | No | Asset expiry date (YYYY-MM-DD format) |
| current_status | string | No | Current status of the asset (default: "Active") |
| warranty_period | string | No | Warranty period description |
| parent_id | string | No | Parent asset identifier (for hierarchical assets) |
| group_id | string | No | Group identifier |
| org_id | string | Yes | Organization identifier |

## Example Usage

### cURL Examples

**Add new asset (manual ID):**
```bash
curl -X POST http://localhost:5001/api/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
    "org_id": "ORG001"
  }'
```

**Add new asset (manual ID):**
```bash
curl -X POST http://localhost:5001/api/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_type_id": "AST001",
    "ext_id": "987fcdeb-51a2-43d1-9f12-345678901234",
    "asset_id": "AST999",
    "text": "Desktop Computer",
    "serial_number": "DESK789012",
    "description": "HP EliteDesk 800",
    "branch_id": "BR002",
    "vendor_id": "VEN002",
    "purchased_cost": 800.00,
    "purchased_on": "2024-02-01",
    "current_status": "Active",
    "warranty_period": "2 years",
    "org_id": "ORG001"
  }'
```

**Minimal asset (only required fields):**
```bash
curl -X POST http://localhost:5001/api/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ext_id": "456e7890-abcd-12ef-3456-789012345678",
    "asset_id": "AST002",
    "text": "Mobile Phone",
    "org_id": "ORG001"
  }'
```

## ID Generation

Asset IDs are automatically generated using the pattern `AST###` where `###` is a sequential number (e.g., AST001, AST002, etc.). The ID generation is handled by the `generateCustomId` utility with the key `"asset"`.

If you provide a manual `asset_id`, the API will validate that it doesn't already exist.

## Validation Rules

### Required Fields
- `ext_id`: Must be provided and must be a valid UUID format
- `asset_id`: Must be provided (unique asset identifier)
- `text`: Must be provided (asset name/description)
- `org_id`: Must be provided (organization identifier)

### UUID Validation
The `ext_id` field must be a valid UUID format:
- Example: `123e4567-e89b-12d3-a456-426614174000`
- Pattern: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Only hexadecimal characters (0-9, a-f, A-F)

### Duplicate Prevention
- The API checks for duplicate `ext_id` + `org_id` combinations
- If you provide a manual `asset_id`, it checks for duplicate `asset_id`

## Error Examples

**Missing Required Fields (400 Bad Request):**
```json
{
    "error": "ext_id, text, org_id, and asset_id are required fields"
}
```

**Invalid UUID Format (400 Bad Request):**
```json
{
    "error": "ext_id must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)"
}
```

**Duplicate Asset (409 Conflict):**
```json
{
    "error": "Asset with this ext_id and org_id already exists"
}
```

**Duplicate Asset ID (409 Conflict):**
```json
{
    "error": "Asset with this asset_id already exists"
}
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
    current_status VARCHAR DEFAULT 'Active',
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

## Testing in Postman

### Headers
| Key | Value |
|-----|-------|
| `Authorization` | `Bearer YOUR_JWT_TOKEN` |
| `Content-Type` | `application/json` |

### Request Body Examples

**Full Asset:**
```json
{
    "asset_type_id": "AST001",
    "ext_id": "123e4567-e89b-12d3-a456-426614174000",
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
    "org_id": "ORG001"
}
```

**Minimal Asset:**
```json
{
    "ext_id": "456e7890-abcd-12ef-3456-789012345678",
    "asset_id": "AST002",
    "text": "Mobile Phone",
    "org_id": "ORG001"
}
```

## Integration Notes

- The API automatically sets `created_by` to the authenticated user's ID
- `created_on` and `changed_on` are automatically set to the current timestamp
- `changed_by` is set to the same user as `created_by` for new assets
- All optional fields can be null if not provided
- The API maintains referential integrity with related tables (asset types, branches, vendors, etc.) 