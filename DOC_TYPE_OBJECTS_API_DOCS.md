# Document Type Objects API Documentation

## Overview
This API provides endpoints to retrieve data from the `tblDocTypeObjects` table, which contains mappings between object types and document types.

## Table Structure
The `tblDocTypeObjects` table contains the following fields:
- `dto_id` - Primary key identifier
- `object_type` - Type of object (e.g., asset, vendor, employee)
- `doc_type` - Type of document (e.g., invoice, contract, manual)
- `doc_type_text` - Human-readable description of the document type
- `org_id` - Organization identifier

## API Endpoints

### 1. Get All Document Type Objects
**GET** `/api/doc-type-objects`

Retrieves all document type objects, optionally filtered by organization.

**Query Parameters:**
- None

**Response:**
```json
{
  "success": true,
  "message": "Document type objects retrieved successfully",
  "data": [
    {
      "dto_id": 1,
      "object_type": "asset",
      "doc_type": "invoice",
      "doc_type_text": "Purchase Invoice",
      "org_id": "ORG001"
    }
  ],
  "count": 1
}
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 2. Get Document Type Object by ID
**GET** `/api/doc-type-objects/:id`

Retrieves a specific document type object by its ID.

**Path Parameters:**
- `id` - The dto_id of the document type object

**Response:**
```json
{
  "success": true,
  "message": "Document type object retrieved successfully",
  "data": {
    "dto_id": 1,
    "object_type": "asset",
    "doc_type": "invoice",
    "doc_type_text": "Purchase Invoice",
    "org_id": "ORG001"
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing ID)
- `404` - Document type object not found
- `500` - Internal server error

---

### 3. Get Common Document Type Objects
**GET** `/api/doc-type-objects/common`

Retrieves all common document type objects where `object_type = '*'`. These are universal document types that apply to all object types.

**Response:**
```json
{
  "success": true,
  "message": "Common document type objects retrieved successfully",
  "data": [
    {
      "dto_id": 2,
      "object_type": "*",
      "doc_type": "DTO001",
      "doc_type_text": "Common Document Type",
      "org_id": "ORG001"
    }
  ],
  "count": 1,
  "note": "These are universal document types that apply to all object types"
}
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 4. Get Document Type Objects by Object Type
**GET** `/api/doc-type-objects/object-type/:object_type`

Retrieves all document type objects for a specific object type, **PLUS** all common document types (where `object_type = '*'`).

**Key Feature:** This endpoint automatically includes universal document types that apply to all object types, making it easy to get both specific and common document types in a single request.

**Path Parameters:**
- `object_type` - The type of object (e.g., asset, vendor, employee)

**Response:**
```json
{
  "success": true,
  "message": "Document type objects retrieved successfully",
  "data": [
    {
      "dto_id": 1,
      "object_type": "asset",
      "doc_type": "invoice",
      "doc_type_text": "Purchase Invoice",
      "org_id": "ORG001"
    },
    {
      "dto_id": 2,
      "object_type": "*",
      "doc_type": "DTO001",
      "doc_type_text": "Common Document Type",
      "org_id": "ORG001"
    }
  ],
  "count": 2,
  "object_type": "asset",
  "includes_common": true,
  "note": "Results include both specific object type and common (*) document types"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing object_type)
- `500` - Internal server error

---

### 5. Get Document Type Objects by Document Type
**GET** `/api/doc-type-objects/doc-type/:doc_type`

Retrieves all document type objects for a specific document type.

**Path Parameters:**
- `doc_type` - The type of document (e.g., invoice, contract, manual)

**Response:**
```json
{
  "success": true,
  "message": "Document type objects retrieved successfully",
  "data": [
    {
      "dto_id": 1,
      "object_type": "asset",
      "doc_type": "invoice",
      "doc_type_text": "Purchase Invoice",
      "org_id": "ORG001"
    }
  ],
  "count": 1,
  "doc_type": "invoice"
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request (missing doc_type)
- `500` - Internal server error

---

## Authentication
All endpoints require authentication with a valid JWT token. Include the token in the Authorization header:

```bash
Authorization: Bearer <your-jwt-token>
```

If a user is authenticated, the API will filter results by the user's organization (`org_id`). This ensures data isolation between organizations.

## Error Handling
All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "User-friendly error message"
}
```

## Usage Examples

### Frontend Integration
```javascript
// Get all document type objects
const response = await fetch('/api/doc-type-objects');
const data = await response.json();

// Get common document types (universal)
const commonDocs = await fetch('/api/doc-type-objects/common');
const commonData = await commonDocs.json();

// Get document types for assets (includes both specific + common)
const assetDocs = await fetch('/api/doc-type-objects/object-type/asset');
const assetData = await assetDocs.json();

// Get specific document type object
const docType = await fetch('/api/doc-type-objects/1');
const docData = await docType.json();
```

### Understanding the Wildcard Functionality
When you call `/api/doc-type-objects/object-type/asset`, you get:
1. **Specific types**: All records where `object_type = 'asset'`
2. **Common types**: All records where `object_type = '*'` (universal)

This means you automatically get both asset-specific document types AND universal document types that apply to all objects, including your "DTO001" common document type.

### cURL Examples
```bash
# Get all document type objects
curl -X GET http://localhost:4000/api/doc-type-objects

# Get common document types (universal)
curl -X GET http://localhost:4000/api/doc-type-objects/common

# Get document types for assets (includes both specific + common)
curl -X GET http://localhost:4000/api/doc-type-objects/object-type/asset

# Get document types for invoices
curl -X GET http://localhost:4000/api/doc-type-objects/doc-type/invoice

# Get specific document type object
curl -X GET http://localhost:4000/api/doc-type-objects/1
```

## Testing
A test file `test_doc_type_objects_api.js` is provided to verify the API functionality:

```bash
node test_doc_type_objects_api.js
```

## Wildcard Functionality
The API includes a special feature for handling common document types:

- **Object Type Wildcard**: When you query `/api/doc-type-objects/object-type/asset`, you get:
  - All records where `object_type = 'asset'` (specific to assets)
  - **PLUS** all records where `object_type = '*'` (common/universal types)
  
- **Common Types**: Records with `object_type = '*'` are universal document types that apply to all object types
- **DTO001**: Your common document type "DTO001" will automatically appear in results for any object type query
- **Smart Ordering**: Results are ordered with specific types first, then common types

## Notes
- The API automatically handles organization filtering when users are authenticated
- All endpoints return data in a consistent format with success/error indicators
- The API supports flexible querying by object type, document type, or individual ID
- Results are ordered by `dto_id` for consistent output
- The wildcard functionality ensures you never miss common document types
