# Vendor Documents API Documentation

This document describes the APIs for managing documents related to Vendors. When documents are uploaded for a Vendor, they are stored in MinIO and the file path is saved in `tblVendorDocs`.

## Base URL
```
/api/vendor-docs
```

## Authentication
All endpoints require authentication using JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Upload Document
Upload a document for a specific vendor. The file is stored in MinIO and the file path is saved in `tblVendorDocs`.

**Endpoint:** `POST /api/vendor-docs/upload` or `POST /api/vendor-docs/:vendor_id/upload`

**Request Body (multipart/form-data):**
- `file` (required): The file to upload
- `vendor_id` (required): ID of the vendor
- `doc_type` (optional): Type of document (e.g., "agreement", "certification", "license", "compliance", "invoice")
- `doc_type_name` (optional): Human-readable name for document type

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/vendor-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@vendor_agreement.pdf" \
  -F "vendor_id=VND001" \
  -F "doc_type=agreement" \
  -F "doc_type_name=Vendor Agreement"
```

**Response (201 Created):**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "vd_id": "VD1703123456789001",
    "vendor_id": "VND001",
    "doc_type": "agreement",
    "doc_type_name": "Vendor Agreement",
    "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 2. List Documents
Retrieve all documents for a specific vendor, optionally filtered by document type.

**Endpoint:** `GET /api/vendor-docs/:vendor_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Example Requests:**
```bash
# Get all documents for vendor
curl -X GET "http://localhost:5000/api/vendor-docs/VND001" \
  -H "Authorization: Bearer <jwt_token>"

# Get documents filtered by type
curl -X GET "http://localhost:5000/api/vendor-docs/VND001?doc_type=invoice" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "vd_id": "VD1703123456789001",
      "vendor_id": "VND001",
      "doc_type": "agreement",
      "doc_type_name": "Vendor Agreement",
      "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    },
    {
      "vd_id": "VD1703123456790002",
      "vendor_id": "VND001",
      "doc_type": "invoice",
      "doc_type_name": "Invoice #INV-2024-001",
      "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456790_def67890.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

### 3. Get Document Details
Retrieve detailed information about a specific document by its ID.

**Endpoint:** `GET /api/vendor-docs/document/:vd_id`

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/vendor-docs/document/VD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document retrieved successfully",
  "document": {
    "vd_id": "VD1703123456789001",
    "vendor_id": "VND001",
    "doc_type": "agreement",
    "doc_type_name": "Vendor Agreement",
    "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 4. Download/View Document
Generate a presigned URL for downloading or viewing a document. The URL is valid for 1 hour.

**Endpoint:** `GET /api/vendor-docs/:vd_id/download`

**Query Parameters:**
- `mode` (optional): 
  - `download`: Forces file download
  - `view`: Opens file in browser (default)

**Example Requests:**
```bash
# Download file
curl -X GET "http://localhost:5000/api/vendor-docs/VD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"

# View file in browser
curl -X GET "http://localhost:5000/api/vendor-docs/VD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "URL generated successfully",
  "url": "https://minio.example.com/asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "document": {
    "vd_id": "VD1703123456789001",
    "vendor_id": "VND001",
    "doc_type": "agreement",
    "doc_type_name": "Vendor Agreement",
    "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 5. Archive Document
Mark a document as archived and optionally move it to an archived path.

**Endpoint:** `PUT /api/vendor-docs/:vd_id/archive`

**Request Body:**
```json
{
  "archived_path": "archived/asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:5000/api/vendor-docs/VD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf"}'
```

**Response (200 OK):**
```json
{
  "message": "Document archived successfully",
  "document": {
    "vd_id": "VD1703123456789001",
    "vendor_id": "VND001",
    "doc_type": "agreement",
    "doc_type_name": "Vendor Agreement",
    "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "is_archived": true,
    "archived_path": "archived/asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "org_id": "ORG001"
  }
}
```

### 6. Delete Document
Permanently delete a document from the system.

**Endpoint:** `DELETE /api/vendor-docs/:vd_id`

**Example Request:**
```bash
curl -X DELETE "http://localhost:5000/api/vendor-docs/VD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document deleted successfully",
  "document": {
    "vd_id": "VD1703123456789001",
    "vendor_id": "VND001",
    "doc_type": "agreement",
    "doc_type_name": "Vendor Agreement",
    "doc_path": "asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

## Database Schema

The documents are stored in the `tblVendorDocs` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `vd_id` | VARCHAR | Unique document identifier (format: VD + timestamp + random) |
| `vendor_id` | VARCHAR | Reference to the vendor |
| `doc_type` | VARCHAR | Type of document (e.g., "agreement", "certification", "license", "compliance", "invoice") |
| `doc_type_name` | VARCHAR | Human-readable name for document type |
| `doc_path` | VARCHAR | Full path to the document in MinIO |
| `is_archived` | BOOLEAN | Whether the document is archived |
| `archived_path` | VARCHAR | Path where archived document is stored |
| `org_id` | VARCHAR | Organization identifier |

## File Storage

Documents are stored in MinIO with the following path structure:
```
{MINIO_BUCKET}/{org_id}/vendors/{vendor_id}/{timestamp}_{hash}.{extension}
```

Example:
```
asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf
```

## Document Types

The API supports various document types for vendors:

- **agreement**: Vendor agreements and contracts
- **certification**: Vendor certifications and qualifications
- **license**: Business licenses and permits
- **compliance**: Compliance documents and certificates
- **invoice**: Vendor invoices and billing documents
- **warranty**: Warranty documents and terms
- **manual**: Product manuals and documentation
- **other**: Other vendor-related documents

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Missing required fields or invalid input
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User doesn't have required permissions
- `404 Not Found`: Vendor or document not found
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

1. **Upload a vendor agreement:**
```bash
curl -X POST "http://localhost:5000/api/vendor-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@vendor_agreement.pdf" \
  -F "vendor_id=VND001" \
  -F "doc_type=agreement" \
  -F "doc_type_name=Vendor Agreement"
```

2. **Upload an invoice:**
```bash
curl -X POST "http://localhost:5000/api/vendor-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@invoice_2024_001.pdf" \
  -F "vendor_id=VND001" \
  -F "doc_type=invoice" \
  -F "doc_type_name=Invoice #INV-2024-001"
```

3. **List all documents for the vendor:**
```bash
curl -X GET "http://localhost:5000/api/vendor-docs/VND001" \
  -H "Authorization: Bearer <jwt_token>"
```

4. **List only invoices:**
```bash
curl -X GET "http://localhost:5000/api/vendor-docs/VND001?doc_type=invoice" \
  -H "Authorization: Bearer <jwt_token>"
```

5. **Download a document:**
```bash
curl -X GET "http://localhost:5000/api/vendor-docs/VD1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"
```

6. **View document in browser:**
```bash
curl -X GET "http://localhost:5000/api/vendor-docs/VD1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

7. **Archive a document:**
```bash
curl -X PUT "http://localhost:5000/api/vendor-docs/VD1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/vendors/VND001/1703123456789_abc12345.pdf"}'
```

8. **Delete a document:**
```bash
curl -X DELETE "http://localhost:5000/api/vendor-docs/VD1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

## Frontend Integration

### JavaScript Example
```javascript
// Upload document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('vendor_id', 'VND001');
formData.append('doc_type', 'invoice');
formData.append('doc_type_name', 'Invoice #INV-2024-001');

const response = await fetch('/api/vendor-docs/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

// List documents
const documents = await fetch(`/api/vendor-docs/VND001`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Download document
const downloadUrl = await fetch(`/api/vendor-docs/${docId}/download?mode=download`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// View document
const viewUrl = await fetch(`/api/vendor-docs/${docId}/download?mode=view`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Notes

- All file operations are handled through MinIO for scalable and reliable storage
- Document IDs are generated automatically with a unique format (VD + timestamp + random)
- Files are organized by organization and vendor for easy management
- The API supports both direct upload and URL-based upload methods
- Archived documents are marked but not physically moved (MinIO path remains the same)
- All timestamps are in UTC format
- For existing vendors, the API will display all previously uploaded documents including invoices
- The system maintains backward compatibility with existing vendor document structures
