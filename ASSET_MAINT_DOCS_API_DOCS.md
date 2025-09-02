# Asset Maintenance Documents API Documentation

This document describes the APIs for managing documents uploaded during the Maintenance Supervisor approval/completion process. When documents are uploaded for Asset Maintenance, they are stored in MinIO and the file path is saved in `tblAssetMaintDocs`.

## Base URL
```
/api/asset-maint-docs
```

## Authentication
All endpoints require authentication using JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Upload Document
Upload a document for asset maintenance (e.g., QA report, images, PDFs). The file is stored in MinIO and the file path is saved in `tblAssetMaintDocs`.

**Endpoint:** `POST /api/asset-maint-docs/upload` or `POST /api/asset-maint-docs/:asset_id/upload`

**Request Body (multipart/form-data):**
- `file` (required): The file to upload
- `asset_id` (required): ID of the asset
- `doc_type` (optional): Type of document (e.g., "qa_report", "images", "pdf", "completion_report")
- `doc_type_name` (optional): Human-readable name for document type

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/asset-maint-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@qa_report.pdf" \
  -F "asset_id=ASSET001" \
  -F "doc_type=qa_report" \
  -F "doc_type_name=Quality Assurance Report"
```

**Response (201 Created):**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "amd_id": "AMD1703123456789001",
    "asset_id": "ASSET001",
    "doc_type": "qa_report",
    "doc_type_name": "Quality Assurance Report",
    "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 2. List Documents by Asset ID
Retrieve all documents for a specific asset, optionally filtered by document type.

**Endpoint:** `GET /api/asset-maint-docs/asset/:asset_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Example Requests:**
```bash
# Get all documents for asset
curl -X GET "http://localhost:5000/api/asset-maint-docs/asset/ASSET001" \
  -H "Authorization: Bearer <jwt_token>"

# Get documents filtered by type
curl -X GET "http://localhost:5000/api/asset-maint-docs/asset/ASSET001?doc_type=qa_report" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "amd_id": "AMD1703123456789001",
      "asset_id": "ASSET001",
      "doc_type": "qa_report",
      "doc_type_name": "Quality Assurance Report",
      "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    },
    {
      "amd_id": "AMD1703123456790002",
      "asset_id": "ASSET001",
      "doc_type": "images",
      "doc_type_name": "Maintenance Images",
      "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456790_def67890.jpg",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

### 3. List Documents by Work Order ID
Retrieve all documents for a specific work order (ams_id), optionally filtered by document type.

**Endpoint:** `GET /api/asset-maint-docs/work-order/:ams_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Example Requests:**
```bash
# Get all documents for work order
curl -X GET "http://localhost:5000/api/asset-maint-docs/work-order/ams001" \
  -H "Authorization: Bearer <jwt_token>"

# Get documents filtered by type
curl -X GET "http://localhost:5000/api/asset-maint-docs/work-order/ams001?doc_type=qa_report" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "amd_id": "AMD1703123456789001",
      "asset_id": "ASSET001",
      "doc_type": "qa_report",
      "doc_type_name": "Quality Assurance Report",
      "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

### 4. Get Document Details
Retrieve detailed information about a specific document by its ID.

**Endpoint:** `GET /api/asset-maint-docs/document/:amd_id`

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/document/AMD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document retrieved successfully",
  "document": {
    "amd_id": "AMD1703123456789001",
    "asset_id": "ASSET001",
    "doc_type": "qa_report",
    "doc_type_name": "Quality Assurance Report",
    "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 5. Download/View Document
Generate a presigned URL for downloading or viewing a document. The URL is valid for 1 hour.

**Endpoint:** `GET /api/asset-maint-docs/:amd_id/download`

**Query Parameters:**
- `mode` (optional): 
  - `download`: Forces file download
  - `view`: Opens file in browser (default)

**Example Requests:**
```bash
# Download file
curl -X GET "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"

# View file in browser
curl -X GET "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "URL generated successfully",
  "url": "https://minio.example.com/asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "document": {
    "amd_id": "AMD1703123456789001",
    "asset_id": "ASSET001",
    "doc_type": "qa_report",
    "doc_type_name": "Quality Assurance Report",
    "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 6. Archive Document
Mark a document as archived and optionally move it to an archived path.

**Endpoint:** `PUT /api/asset-maint-docs/:amd_id/archive`

**Request Body:**
```json
{
  "archived_path": "archived/asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf"}'
```

**Response (200 OK):**
```json
{
  "message": "Document archived successfully",
  "document": {
    "amd_id": "AMD1703123456789001",
    "asset_id": "ASSET001",
    "doc_type": "qa_report",
    "doc_type_name": "Quality Assurance Report",
    "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "is_archived": true,
    "archived_path": "archived/asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "org_id": "ORG001"
  }
}
```

### 7. Delete Document
Permanently delete a document from the system.

**Endpoint:** `DELETE /api/asset-maint-docs/:amd_id`

**Example Request:**
```bash
curl -X DELETE "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document deleted successfully",
  "document": {
    "amd_id": "AMD1703123456789001",
    "asset_id": "ASSET001",
    "doc_type": "qa_report",
    "doc_type_name": "Quality Assurance Report",
    "doc_path": "asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

## Database Schema

The documents are stored in the `tblAssetMaintDocs` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `amd_id` | VARCHAR | Unique document identifier (format: AMD + timestamp + random) |
| `asset_id` | VARCHAR | Reference to the asset |
| `doc_type` | VARCHAR | Type of document (e.g., "qa_report", "images", "pdf", "completion_report") |
| `doc_type_name` | VARCHAR | Human-readable name for document type |
| `doc_path` | VARCHAR | Full path to the document in MinIO |
| `is_archived` | BOOLEAN | Whether the document is archived |
| `archived_path` | VARCHAR | Path where archived document is stored |
| `org_id` | VARCHAR | Organization identifier |

## File Storage

Documents are stored in MinIO with the following path structure:
```
{MINIO_BUCKET}/{org_id}/asset-maintenance/{asset_id}/{timestamp}_{hash}.{extension}
```

Example:
```
asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf
```

## Document Types

The API supports various document types for asset maintenance:

- **qa_report**: Quality Assurance reports and certificates
- **images**: Maintenance images and photos
- **pdf**: PDF documents and reports
- **completion_report**: Maintenance completion reports
- **inspection_report**: Inspection reports and findings
- **work_order**: Work order documents
- **invoice**: Maintenance invoices and billing
- **warranty**: Warranty documents and terms
- **manual**: Maintenance manuals and procedures
- **other**: Other maintenance-related documents

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Missing required fields or invalid input
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User doesn't have required permissions
- `404 Not Found`: Asset, work order, or document not found
- `500 Internal Server Error`: Server-side error

## Security Features

1. **Authentication Required**: All endpoints require valid JWT token
2. **Authorization**: Only users with role `JR001` can access these endpoints
3. **File Validation**: Files are validated before upload
4. **Secure URLs**: Download/view URLs are presigned and expire after 1 hour
5. **Organization Isolation**: Users can only access documents from their organization
6. **Input Validation**: All inputs are validated and sanitized

## Usage Examples

### Complete Workflow Example

1. **Upload a QA report:**
```bash
curl -X POST "http://localhost:5000/api/asset-maint-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@qa_report.pdf" \
  -F "asset_id=ASSET001" \
  -F "doc_type=qa_report" \
  -F "doc_type_name=Quality Assurance Report"
```

2. **Upload maintenance images:**
```bash
curl -X POST "http://localhost:5000/api/asset-maint-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@maintenance_images.zip" \
  -F "asset_id=ASSET001" \
  -F "doc_type=images" \
  -F "doc_type_name=Maintenance Images"
```

3. **List all documents for an asset:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/asset/ASSET001" \
  -H "Authorization: Bearer <jwt_token>"
```

4. **List documents for a work order:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/work-order/ams001" \
  -H "Authorization: Bearer <jwt_token>"
```

5. **List only QA reports for an asset:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/asset/ASSET001?doc_type=qa_report" \
  -H "Authorization: Bearer <jwt_token>"
```

6. **Download a document:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"
```

7. **View document in browser:**
```bash
curl -X GET "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

8. **Archive a document:**
```bash
curl -X PUT "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/asset-maintenance/ASSET001/1703123456789_abc12345.pdf"}'
```

9. **Delete a document:**
```bash
curl -X DELETE "http://localhost:5000/api/asset-maint-docs/AMD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

## Frontend Integration

### JavaScript Example
```javascript
// Upload maintenance document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('asset_id', 'ASSET001');
formData.append('doc_type', 'qa_report');
formData.append('doc_type_name', 'Quality Assurance Report');

const response = await fetch('/api/asset-maint-docs/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

// List documents by asset
const assetDocuments = await fetch(`/api/asset-maint-docs/asset/ASSET001`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// List documents by work order
const workOrderDocuments = await fetch(`/api/asset-maint-docs/work-order/ams001`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Download document
const downloadUrl = await fetch(`/api/asset-maint-docs/${docId}/download?mode=download`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// View document
const viewUrl = await fetch(`/api/asset-maint-docs/${docId}/download?mode=view`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Integration with Maintenance Workflow

### Maintenance Supervisor Process
1. **Maintenance Initiated**: Work order created in `tblAssetMaintSch`
2. **Document Upload**: Supervisor uploads QA reports, images, etc.
3. **Document Association**: Documents linked to asset via `tblAssetMaintDocs`
4. **Approval Process**: Documents reviewed during approval workflow
5. **Completion**: All documents archived or maintained for audit trail

### Work Order Integration
- Documents can be retrieved by both asset ID and work order ID
- Work order ID (`ams_id`) links to asset through `tblAssetMaintSch`
- Supports maintenance supervisor approval process
- Enables document tracking throughout maintenance lifecycle

## Notes

- All file operations are handled through MinIO for scalable and reliable storage
- Document IDs are generated automatically with a unique format (AMD + timestamp + random)
- Files are organized by organization and asset for easy management
- The API supports both direct upload and URL-based upload methods
- Archived documents are marked but not physically moved (MinIO path remains the same)
- All timestamps are in UTC format
- Documents are linked to both assets and work orders for comprehensive tracking
- Supports the maintenance supervisor approval/completion process workflow
- Maintains audit trail for all maintenance-related documents
