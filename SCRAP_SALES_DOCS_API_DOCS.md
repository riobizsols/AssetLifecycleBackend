# Scrap Sales Documents API Documentation

This document describes the APIs for managing documents related to Scrap Sales. When documents are uploaded for a Scrap Sale, they are stored in MinIO and the file path is saved in `tblScrapSalesDocs`.

## Base URL
```
/api/scrap-sales-docs
```

## Authentication
All endpoints require authentication using JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Upload Document
Upload a document for a scrap sale (e.g., invoice, receipt, contract, certificate). The file is stored in MinIO and the file path is saved in `tblScrapSalesDocs`.

**Endpoint:** `POST /api/scrap-sales-docs/upload` or `POST /api/scrap-sales-docs/:ssh_id/upload`

**Request Body (multipart/form-data):**
- `file` (required): The file to upload
- `ssh_id` (required): ID of the scrap sale
- `doc_type` (optional): Type of document (e.g., "invoice", "receipt", "contract", "certificate")
- `doc_type_name` (optional): Human-readable name for document type

**Example Request:**
```bash
curl -X POST "http://localhost:5000/api/scrap-sales-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@invoice.pdf" \
  -F "ssh_id=SSH0001" \
  -F "doc_type=invoice" \
  -F "doc_type_name=Sales Invoice"
```

**Response (201 Created):**
```json
{
  "message": "Document uploaded successfully",
  "document": {
    "ssdoc_id": "SSDOC1703123456789001",
    "ssh_id": "SSH0001",
    "doc_type": "invoice",
    "doc_type_name": "Sales Invoice",
    "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 2. List Documents by Scrap Sale ID
Retrieve all documents for a specific scrap sale, optionally filtered by document type.

**Endpoint:** `GET /api/scrap-sales-docs/:ssh_id`

**Query Parameters:**
- `doc_type` (optional): Filter documents by type

**Example Requests:**
```bash
# Get all documents for scrap sale
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSH0001" \
  -H "Authorization: Bearer <jwt_token>"

# Get documents filtered by type
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSH0001?doc_type=invoice" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Documents retrieved successfully",
  "documents": [
    {
      "ssdoc_id": "SSDOC1703123456789001",
      "ssh_id": "SSH0001",
      "doc_type": "invoice",
      "doc_type_name": "Sales Invoice",
      "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    },
    {
      "ssdoc_id": "SSDOC1703123456790002",
      "ssh_id": "SSH0001",
      "doc_type": "receipt",
      "doc_type_name": "Payment Receipt",
      "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456790_def67890.pdf",
      "is_archived": false,
      "archived_path": null,
      "org_id": "ORG001"
    }
  ]
}
```

### 3. Get Document Details
Retrieve detailed information about a specific document by its ID.

**Endpoint:** `GET /api/scrap-sales-docs/document/:ssdoc_id`

**Example Request:**
```bash
curl -X GET "http://localhost:5000/api/scrap-sales-docs/document/SSDOC1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document retrieved successfully",
  "document": {
    "ssdoc_id": "SSDOC1703123456789001",
    "ssh_id": "SSH0001",
    "doc_type": "invoice",
    "doc_type_name": "Sales Invoice",
    "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 4. Download/View Document
Generate a presigned URL for downloading or viewing a document. The URL is valid for 1 hour.

**Endpoint:** `GET /api/scrap-sales-docs/:ssdoc_id/download`

**Query Parameters:**
- `mode` (optional): 
  - `download`: Forces file download
  - `view`: Opens file in browser (default)

**Example Requests:**
```bash
# Download file
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"

# View file in browser
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "URL generated successfully",
  "url": "https://minio.example.com/asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&...",
  "document": {
    "ssdoc_id": "SSDOC1703123456789001",
    "ssh_id": "SSH0001",
    "doc_type": "invoice",
    "doc_type_name": "Sales Invoice",
    "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

### 5. Archive Document
Mark a document as archived and optionally move it to an archived path.

**Endpoint:** `PUT /api/scrap-sales-docs/:ssdoc_id/archive`

**Request Body:**
```json
{
  "archived_path": "archived/asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf"}'
```

**Response (200 OK):**
```json
{
  "message": "Document archived successfully",
  "document": {
    "ssdoc_id": "SSDOC1703123456789001",
    "ssh_id": "SSH0001",
    "doc_type": "invoice",
    "doc_type_name": "Sales Invoice",
    "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "is_archived": true,
    "archived_path": "archived/asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "org_id": "ORG001"
  }
}
```

### 6. Delete Document
Permanently delete a document from the system.

**Endpoint:** `DELETE /api/scrap-sales-docs/:ssdoc_id`

**Example Request:**
```bash
curl -X DELETE "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

**Response (200 OK):**
```json
{
  "message": "Document deleted successfully",
  "document": {
    "ssdoc_id": "SSDOC1703123456789001",
    "ssh_id": "SSH0001",
    "doc_type": "invoice",
    "doc_type_name": "Sales Invoice",
    "doc_path": "asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf",
    "is_archived": false,
    "archived_path": null,
    "org_id": "ORG001"
  }
}
```

## Database Schema

The documents are stored in the `tblScrapSalesDocs` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `ssdoc_id` | VARCHAR | Unique document identifier (format: SSDOC + timestamp + random) |
| `ssh_id` | VARCHAR | Reference to the scrap sale |
| `doc_type` | VARCHAR | Type of document (e.g., "invoice", "receipt", "contract", "certificate") |
| `doc_type_name` | VARCHAR | Human-readable name for document type |
| `doc_path` | VARCHAR | Full path to the document in MinIO |
| `is_archived` | BOOLEAN | Whether the document is archived |
| `archived_path` | VARCHAR | Path where archived document is stored |
| `org_id` | VARCHAR | Organization identifier |

## File Storage

Documents are stored in MinIO with the following path structure:
```
{MINIO_BUCKET}/{org_id}/scrap-sales/{ssh_id}/{timestamp}_{hash}.{extension}
```

Example:
```
asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf
```

## Document Types

The API supports various document types for scrap sales:

- **invoice**: Sales invoices and billing documents
- **receipt**: Payment receipts and proof of payment
- **contract**: Sales contracts and agreements
- **certificate**: Certificates of disposal or environmental compliance
- **quotation**: Price quotations and estimates
- **delivery_note**: Delivery notes and shipping documents
- **warranty**: Warranty documents and terms
- **compliance**: Compliance certificates and regulatory documents
- **other**: Other scrap sales-related documents

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- `400 Bad Request`: Missing required fields or invalid input
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User doesn't have required permissions
- `404 Not Found`: Scrap sale or document not found
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

1. **Upload an invoice:**
```bash
curl -X POST "http://localhost:5000/api/scrap-sales-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@invoice.pdf" \
  -F "ssh_id=SSH0001" \
  -F "doc_type=invoice" \
  -F "doc_type_name=Sales Invoice"
```

2. **Upload a receipt:**
```bash
curl -X POST "http://localhost:5000/api/scrap-sales-docs/upload" \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@receipt.pdf" \
  -F "ssh_id=SSH0001" \
  -F "doc_type=receipt" \
  -F "doc_type_name=Payment Receipt"
```

3. **List all documents for a scrap sale:**
```bash
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSH0001" \
  -H "Authorization: Bearer <jwt_token>"
```

4. **List only invoices for a scrap sale:**
```bash
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSH0001?doc_type=invoice" \
  -H "Authorization: Bearer <jwt_token>"
```

5. **Download a document:**
```bash
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/download?mode=download" \
  -H "Authorization: Bearer <jwt_token>"
```

6. **View document in browser:**
```bash
curl -X GET "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/download?mode=view" \
  -H "Authorization: Bearer <jwt_token>"
```

7. **Archive a document:**
```bash
curl -X PUT "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001/archive" \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{"archived_path": "archived/asset-docs/ORG001/scrap-sales/SSH0001/1703123456789_abc12345.pdf"}'
```

8. **Delete a document:**
```bash
curl -X DELETE "http://localhost:5000/api/scrap-sales-docs/SSDOC1703123456789001" \
  -H "Authorization: Bearer <jwt_token>"
```

## Frontend Integration

### JavaScript Example
```javascript
// Upload scrap sales document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('ssh_id', 'SSH0001');
formData.append('doc_type', 'invoice');
formData.append('doc_type_name', 'Sales Invoice');

const response = await fetch('/api/scrap-sales-docs/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

// List documents by scrap sale
const scrapSaleDocuments = await fetch(`/api/scrap-sales-docs/SSH0001`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Download document
const downloadUrl = await fetch(`/api/scrap-sales-docs/${docId}/download?mode=download`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// View document
const viewUrl = await fetch(`/api/scrap-sales-docs/${docId}/download?mode=view`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Integration with Scrap Sales Workflow

### Scrap Sales Process
1. **Scrap Sale Created**: Scrap sale header created in `tblScrapSales_H`
2. **Document Upload**: Upload invoices, receipts, contracts, etc.
3. **Document Association**: Documents linked to scrap sale via `tblScrapSalesDocs`
4. **Document Review**: Review and validate uploaded documents
5. **Document Management**: Archive or delete documents as needed

### Scrap Sales Integration
- Documents are linked to scrap sales via `ssh_id`
- Supports the complete scrap sales lifecycle
- Enables document tracking throughout the sales process
- Maintains audit trail for all scrap sales-related documents

## Notes

- All file operations are handled through MinIO for scalable and reliable storage
- Document IDs are generated automatically with a unique format (SSDOC + timestamp + random)
- Files are organized by organization and scrap sale for easy management
- The API supports both direct upload and URL-based upload methods
- Archived documents are marked but not physically moved (MinIO path remains the same)
- All timestamps are in UTC format
- Documents are linked to scrap sales for comprehensive tracking
- Supports the complete scrap sales document management workflow
- Maintains audit trail for all scrap sales-related documents
- Users can view and download existing documents and upload new ones for line items
