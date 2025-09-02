# Asset Type Documents API Documentation

This document describes the APIs for managing documents related to Asset Types. When documents are uploaded for an Asset Type, they are stored in MinIO and the file path is saved in `tblATDocs`.

## Base URL
```
/api/asset-type-docs
```

## Authentication
All endpoints require authentication using JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Upload Document
Upload a document for a specific asset type. The file is stored in MinIO and the file path is saved in `tblATDocs`.

**Endpoint:** `POST /api/asset-type-docs/upload` or `POST /api/asset-type-docs/:asset_type_id/upload`

**Request Body (multipart/form-data):**
- `file` (required): The file to upload
- `asset_type_id` (required): ID of the asset type
- `doc_type` (optional): Type of document (e.g., "manual", "warranty", "invoice")
- `doc_type_name` (optional): Human-readable name for document type

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/asset-type-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@document.pdf" \
  -F "asset_type_id=AT001" \
  -F "doc_type=manual" \
  -F "doc_type_name=User Manual"
```

**Response (201 Created):**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "atd_id": "ATD1703123456789001",
    "asset_type_id": "AT001",
    "doc_type": "manual",
    "doc_type_name": "User Manual",
    "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 2. List Documents
Retrieve all documents for a specific asset type, optionally filtered by document type.

**Endpoint:** `GET /api/asset-type-docs/:asset_type_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Example Requests:**
```bash
# Get all documents for asset type
curl -X GET "http://localhost:5000/api/asset-type-docs/AT001" \
  -H "Authorization: Bearer <jwt_token>"

# Get documents filtered by type
curl -X GET "http://localhost:5000/api/asset-type-docs/AT001?doc_type=manual" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "atd_id": "ATD1703123456789001",
      "asset_type_id": "AT001",
      "doc_type": "manual",
      "doc_type_name": "User Manual",
      "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

### 3. Get Document Details
Retrieve detailed information about a specific document by its ID.

**Endpoint:** `GET /api/asset-type-docs/document/:atd_id`

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/asset-type-docs/document/ATD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document retrieved successfully",
  "document": {
    "atd_id": "ATD1703123456789001",
    "asset_type_id": "AT001",
    "doc_type": "manual",
    "doc_type_name": "User Manual",
    "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 4. Download/View Document
Generate a presigned URL for downloading or viewing a document. The URL is valid for 1 hour.

**Endpoint:** `GET /api/asset-type-docs/:atd_id/download`

**Query Parameters:**
- `mode` (optional): 
  - `download`: Forces file download
  - `view`: Opens file in browser (default)

**Example Requests:**
```bash
# Download file
curl -X GET "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"

# View file in browser
curl -X GET "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "URL generated successfully",
  "url": "https://minio.example.com/asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "document": {
    "atd_id": "ATD1703123456789001",
    "asset_type_id": "AT001",
    "doc_type": "manual",
    "doc_type_name": "User Manual",
    "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 5. Archive Document
Mark a document as archived and optionally move it to an archived path.

**Endpoint:** `PUT /api/asset-type-docs/:atd_id/archive`

**Request Body:**
```json
{
  "archived_path": "archived/asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf"}'
```

**Response (200 OK):**
```json
{
  "message": "Document archived successfully",
  "document": {
    "atd_id": "ATD1703123456789001",
    "asset_type_id": "AT001",
    "doc_type": "manual",
    "doc_type_name": "User Manual",
    "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "is_archived": true,
    "archived_path": "archived/asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "org_id": "ORG001"
  }
}
```

### 6. Delete Document
Permanently delete a document from the system.

**Endpoint:** `DELETE /api/asset-type-docs/:atd_id`

**Example Request:**
```bash
curl -X DELETE "http://localhost:5000/api/asset-type-docs/ATD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document deleted successfully",
  "document": {
    "atd_id": "ATD1703123456789001",
    "asset_type_id": "AT001",
    "doc_type": "manual",
    "doc_type_name": "User Manual",
    "doc_path": "asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

## Database Schema

The documents are stored in the `tblATDocs` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `atd_id` | VARCHAR | Unique document identifier (format: ATD + timestamp + random) |
| `asset_type_id` | VARCHAR | Reference to the asset type |
| `doc_type` | VARCHAR | Type of document (e.g., "manual", "warranty") |
| `doc_type_name` | VARCHAR | Human-readable name for document type |
| `doc_path` | VARCHAR | Full path to the document in MinIO |
| `is_archived` | BOOLEAN | Whether the document is archived |
| `archived_path` | VARCHAR | Path where archived document is stored |
| `org_id` | VARCHAR | Organization identifier |

## File Storage

Documents are stored in MinIO with the following path structure:
```
{MINIO_BUCKET}/{org_id}/asset-types/{asset_type_id}/{timestamp}_{hash}.{extension}
```

Example:
```
asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Missing required fields or invalid input
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User doesn't have required permissions
- `404 Not Found`: Asset type or document not found
- `500 Internal Server Error`: Server-side error

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Authorization**: Only users with role `JR001` can access these endpoints
3. **File Validation**: Files are validated before upload
4. **Secure URLs**: Download/view URLs are presigned and expire after 1 hour
5. **Organization Isolation**: Users can only access documents from their organization

## Usage Examples

### Complete Workflow Example

1. **Upload a document:**
```bash
curl -X POST "http://localhost:5000/api/asset-type-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@user_manual.pdf" \
  -F "asset_type_id=AT001" \
  -F "doc_type=manual" \
  -F "doc_type_name=User Manual"
```

2. **List all documents for the asset type:**
```bash
curl -X GET "http://localhost:5000/api/asset-type-docs/AT001" \
  -H "Authorization: Bearer <jwt_token>"
```

3. **Get download URL:**
```bash
curl -X GET "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"
```

4. **View document in browser:**
```bash
curl -X GET "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

5. **Archive document:**
```bash
curl -X PUT "http://localhost:5000/api/asset-type-docs/ATD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/asset-types/AT001/1703123456789_abc12345.pdf"}'
```

6. **Delete document:**
```bash
curl -X DELETE "http://localhost:5000/api/asset-type-docs/ATD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

## Notes

- All file operations are handled through MinIO for scalable and reliable storage
- Document IDs are generated automatically with a unique format
- Files are organized by organization and asset type for easy management
- The API supports both direct upload and URL-based upload methods
- Archived documents are marked but not physically moved (MinIO path remains the same)
- All timestamps are in UTC format
