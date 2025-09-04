# Asset Group Documents API Documentation

This document describes the APIs for managing documents related to Grouped Assets. When documents are uploaded for one group, they are displayed for all assets in that particular group.

## Base URL
```
/api/asset-group-docs
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Upload Document for Asset Group

Upload a document for a specific asset group. The file is stored in MinIO and the file path is saved in `tblAssetGroupDocs`.

**Endpoint:** `POST /api/asset-group-docs/upload` or `POST /api/asset-group-docs/:asset_group_id/upload`

**Request:**
- **Content-Type:** `multipart/form-data`
- **Body:**
  - `file` (required): The file to upload
  - `asset_group_id` (required): The asset group ID
  - `doc_type` (optional): Document type identifier
  - `doc_type_name` (optional): Human-readable document type name
  - `org_id` (required): Organization ID (automatically extracted from JWT token)

**Response:**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "agd_id": "AGD1703123456789001",
    "asset_group_id": "AGH001",
    "doc_type": "invoice",
    "doc_type_name": "Purchase Invoice",
    "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields or file
- `404 Not Found`: Asset group not found
- `500 Internal Server Error`: Upload failed

---

### 2. List Documents for Asset Group

Retrieve all documents associated with a specific asset group.

**Endpoint:** `GET /api/asset-group-docs/:asset_group_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Response:**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "agd_id": "AGD1703123456789001",
      "asset_group_id": "AGH001",
      "doc_type": "invoice",
      "doc_type_name": "Purchase Invoice",
      "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

**Error Responses:**
- `404 Not Found`: Asset group not found
- `500 Internal Server Error`: Failed to retrieve documents

---

### 3. Get Document by ID

Retrieve details of a specific document by its ID.

**Endpoint:** `GET /api/asset-group-docs/document/:agd_id`

**Response:**
```json
{
  "message": "Document retrieved successfully",
  "document": {
    "agd_id": "AGD1703123456789001",
    "asset_group_id": "AGH001",
    "doc_type": "invoice",
    "doc_type_name": "Purchase Invoice",
    "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

**Error Responses:**
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Failed to retrieve document

---

### 4. Get Download/View URL

Generate a presigned URL for downloading or viewing a document.

**Endpoint:** `GET /api/asset-group-docs/:agd_id/download`

**Query Parameters:**
- `mode` (optional): `download` or `view` (default: `view`)
  - `download`: Forces file download with attachment disposition
  - `view`: Opens file in browser with inline disposition

**Response:**
```json
{
  "message": "URL generated successfully",
  "url": "https://minio.example.com/bucket/path/to/file?X-Amz-Algorithm=...",
  "document": {
    "agd_id": "AGD1703123456789001",
    "asset_group_id": "AGH001",
    "doc_type": "invoice",
    "doc_type_name": "Purchase Invoice",
    "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

**Error Responses:**
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Failed to generate URL

---

### 5. Archive Document

Mark a document as archived and optionally move it to an archived path.

**Endpoint:** `PUT /api/asset-group-docs/:agd_id/archive`

**Request Body:**
```json
{
  "archived_path": "archived/path/to/document.pdf"
}
```

**Response:**
```json
{
  "message": "Document archived successfully",
  "document": {
    "agd_id": "AGD1703123456789001",
    "asset_group_id": "AGH001",
    "doc_type": "invoice",
    "doc_type_name": "Purchase Invoice",
    "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
    "is_archived": true,
    "archived_path": "archived/path/to/document.pdf",
    "org_id": "ORG001"
  }
}
```

**Error Responses:**
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Failed to archive document

---

### 6. Delete Document

Permanently delete a document from the system.

**Endpoint:** `DELETE /api/asset-group-docs/:agd_id`

**Response:**
```json
{
  "message": "Document deleted successfully",
  "document": {
    "agd_id": "AGD1703123456789001",
    "asset_group_id": "AGH001",
    "doc_type": "invoice",
    "doc_type_name": "Purchase Invoice",
    "doc_path": "asset-docs/ORG001/asset-groups/AGH001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

**Error Responses:**
- `404 Not Found`: Document not found
- `500 Internal Server Error`: Failed to delete document

---

## Database Schema

The documents are stored in the `tblAssetGroupDocs` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `agd_id` | VARCHAR | Unique document identifier (Primary Key) |
| `asset_group_id` | VARCHAR | Reference to asset group (Foreign Key to tblAssetGroup_H) |
| `doc_type` | VARCHAR | Document type identifier |
| `doc_type_name` | VARCHAR | Human-readable document type name |
| `doc_path` | VARCHAR | Path to the file in MinIO storage |
| `is_archived` | BOOLEAN | Whether the document is archived |
| `archived_path` | VARCHAR | Path to archived file (if archived) |
| `org_id` | VARCHAR | Organization ID |

## File Storage

- Files are stored in MinIO with the path structure: `{org_id}/asset-groups/{asset_group_id}/{timestamp}_{hash}.{extension}`
- The `doc_path` field stores the full path including bucket name
- Presigned URLs are generated for secure access to files
- URLs expire after 1 hour (3600 seconds)

## Usage Examples

### Upload a Document
```bash
curl -X POST "http://localhost:5000/api/asset-group-docs/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@invoice.pdf" \
  -F "asset_group_id=AGH001" \
  -F "doc_type=invoice" \
  -F "doc_type_name=Purchase Invoice"
```

### List Documents
```bash
curl -X GET "http://localhost:5000/api/asset-group-docs/AGH001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Get Download URL
```bash
curl -X GET "http://localhost:5000/api/asset-group-docs/AGD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### View Document
```bash
curl -X GET "http://localhost:5000/api/asset-group-docs/AGD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Notes

1. **Group Association**: When documents are uploaded for one group, they are automatically available for all assets in that group through the asset group relationship.

2. **File Types**: The API accepts any file type. The system preserves the original file extension and MIME type.

3. **Security**: All file access is controlled through presigned URLs with expiration times.

4. **Archiving**: Archived documents are not returned in the default list queries but can still be accessed by ID.

5. **Organization Isolation**: Documents are isolated by organization ID to ensure data security.

6. **Error Handling**: All endpoints return consistent error responses with appropriate HTTP status codes.
