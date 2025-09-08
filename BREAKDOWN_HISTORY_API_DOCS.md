# Breakdown History API Documentation

## Overview
The Breakdown History API provides programmatic access to all breakdown events for assets. This API allows users to retrieve comprehensive breakdown information including asset details, breakdown dates, descriptions, reported by information, vendor details, and related work order information.

## Base URL
```
http://localhost:4000/api/breakdown-history
```

## Authentication
All endpoints require JWT authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Breakdown History (with Filtering)
**Endpoint:** `POST /api/breakdown-history/`

**Description:** Retrieves breakdown history with comprehensive filtering capabilities.

**Request Body:**
```json
{
  "asset_id": "ASS001",
  "vendor_id": "VEN001",
  "work_order_id": "AMS001",
  "reported_by": "john",
  "breakdown_date_from": "2024-01-01",
  "breakdown_date_to": "2024-12-31",
  "breakdown_status": "CR",
  "decision_code": "BF01",
  "description": "hardware failure",
  "department_id": "DEPT001",
  "asset_type_id": "AT001",
  "branch_id": "BR001",
  "group_id": "GRP001"
}
```

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Number of records per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "breakdown_id": "ABR001",
      "asset_id": "ASS001",
      "breakdown_reason_code_id": "ATBRRC001",
      "reported_by": "USR001",
      "is_create_maintenance": false,
      "decision_code": "BF01",
      "breakdown_status": "CR",
      "breakdown_description": "Hardware failure - screen not working",
      "breakdown_date": "2024-08-24T10:00:00Z",
      "breakdown_updated_on": "2024-08-24T12:00:00Z",
      "breakdown_updated_by": "USR001",
      "serial_number": "LAP00001",
      "asset_description": "MacBook Pro",
      "asset_status": "Active",
      "purchased_on": "2023-01-15",
      "purchased_cost": 1500.00,
      "service_vendor_id": "VEN001",
      "group_id": "GRP001",
      "branch_id": "BR001",
      "asset_type_id": "AT001",
      "asset_type_name": "Laptop",
      "maintenance_lead_type": "7",
      "breakdown_reason": "Hardware Failure",
      "reason_code_status": "A",
      "reported_by_name": "John Doe",
      "reported_by_email": "john@company.com",
      "reported_by_phone": "123-456-7890",
      "department_id": "DEPT001",
      "department_name": "IT Department",
      "vendor_id": "VEN001",
      "vendor_name": "Tech Solutions Inc",
      "vendor_contact_person": "Jane Smith",
      "vendor_email": "jane@techsolutions.com",
      "vendor_phone": "987-654-3210",
      "vendor_address": "123 Tech St, City, State 12345",
      "work_order_id": "AMS001",
      "maintenance_start_date": "2024-08-25",
      "maintenance_end_date": "2024-08-26",
      "maintenance_status": "CO",
      "maintenance_notes": "Screen replaced successfully",
      "maintained_by": "Vendor",
      "po_number": "PO123",
      "invoice": "INV456",
      "technician_name": "Mike Johnson",
      "technician_email": "mike@techsolutions.com",
      "technician_phone": "555-123-4567",
      "maintenance_type_name": "Repair",
      "branch_name": "Main Branch",
      "group_name": "IT Equipment"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 3,
    "total_records": 25,
    "records_per_page": 10,
    "has_next_page": true,
    "has_previous_page": false
  },
  "filters_applied": {
    "asset_id": "ASS001",
    "breakdown_status": "CR"
  }
}
```

### 2. Get Breakdown History by Asset ID
**Endpoint:** `GET /api/breakdown-history/asset/{assetId}`

**Description:** Retrieves all breakdown history for a specific asset.

**Path Parameters:**
- `assetId`: The asset ID to retrieve breakdown history for

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "breakdown_id": "ABR001",
      "asset_id": "ASS001",
      "breakdown_status": "CR",
      "breakdown_description": "Hardware failure - screen not working",
      "breakdown_date": "2024-08-24T10:00:00Z",
      "serial_number": "LAP00001",
      "asset_description": "MacBook Pro",
      "vendor_name": "Tech Solutions Inc",
      "reported_by_name": "John Doe",
      "department_name": "IT Department",
      "breakdown_reason": "Hardware Failure",
      "decision_code": "BF01",
      "work_order_id": "AMS001",
      "maintenance_status": "CO"
    }
  ],
  "asset_id": "ASS001",
  "total_records": 1
}
```

### 3. Get Breakdown History Summary
**Endpoint:** `GET /api/breakdown-history/summary`

**Description:** Retrieves summary statistics for breakdown history.

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_breakdown_records": 150,
    "created_breakdowns": 120,
    "in_progress_breakdowns": 15,
    "completed_breakdowns": 10,
    "breakdowns_with_maintenance": 100,
    "breakdowns_without_maintenance": 30,
    "breakdowns_cancelled": 5,
    "breakdowns_last_30_days": 25,
    "breakdowns_last_90_days": 75,
    "unique_assets_with_breakdowns": 45,
    "unique_reporters": 12,
    "unique_vendors_involved": 8
  }
}
```

### 4. Get Breakdown Filter Options
**Endpoint:** `GET /api/breakdown-history/filter-options`

**Description:** Retrieves available filter options for dropdowns and search fields.

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "filter_options": {
    "asset_options": [
      {
        "asset_id": "ASS001",
        "serial_number": "LAP00001",
        "description": "MacBook Pro"
      }
    ],
    "vendor_options": [
      {
        "vendor_id": "VEN001",
        "vendor_name": "Tech Solutions Inc"
      }
    ],
    "work_order_options": [
      {
        "work_order_id": "AMS001"
      }
    ],
    "reported_by_options": [
      {
        "user_id": "USR001",
        "full_name": "John Doe",
        "email": "john@company.com"
      }
    ],
    "breakdown_status_options": [
      {
        "breakdown_status": "CR"
      },
      {
        "breakdown_status": "IN"
      },
      {
        "breakdown_status": "CO"
      }
    ],
    "decision_code_options": [
      {
        "decision_code": "BF01"
      },
      {
        "decision_code": "BF02"
      },
      {
        "decision_code": "BF03"
      }
    ],
    "breakdown_reason_options": [
      {
        "atbrrc_id": "ATBRRC001",
        "breakdown_reason": "Hardware Failure"
      }
    ],
    "department_options": [
      {
        "dept_id": "DEPT001",
        "department_name": "IT Department"
      }
    ],
    "asset_type_options": [
      {
        "asset_type_id": "AT001",
        "asset_type_name": "Laptop"
      }
    ]
  }
}
```

### 5. Export Breakdown History
**Endpoint:** `POST /api/breakdown-history/export`

**Description:** Exports breakdown history data in PDF or CSV format.

**Query Parameters:**
- `type` (optional): Export format - 'pdf' or 'csv' (default: 'csv')
- `orgId` (optional): Organization ID (default: ORG001)

**Request Body:** Same filtering options as the main history endpoint

**Response:**
- **CSV Export:** Returns CSV file with `Content-Type: text/csv`
- **PDF Export:** Returns PDF file with `Content-Type: application/pdf`

**Headers for File Download:**
```
Content-Type: application/pdf (for PDF) or text/csv (for CSV)
Content-Disposition: attachment; filename="breakdown-history-2024-08-24T10-00-00-000Z.pdf"
```

## Filter Parameters

### Available Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `asset_id` | string | Filter by specific asset ID | "ASS001" |
| `vendor_id` | string | Filter by vendor ID | "VEN001" |
| `work_order_id` | string | Filter by work order ID | "AMS001" |
| `reported_by` | string | Search by reporter name or email | "john" |
| `breakdown_date_from` | date | Filter from breakdown date | "2024-01-01" |
| `breakdown_date_to` | date | Filter to breakdown date | "2024-12-31" |
| `breakdown_status` | string | Filter by breakdown status | "CR", "IN", "CO" |
| `decision_code` | string | Filter by decision code | "BF01", "BF02", "BF03" |
| `description` | string | Text search in breakdown description | "hardware failure" |
| `department_id` | string | Filter by department ID | "DEPT001" |
| `asset_type_id` | string | Filter by asset type ID | "AT001" |
| `branch_id` | string | Filter by branch ID | "BR001" |
| `group_id` | string | Filter by group ID | "GRP001" |

### Breakdown Status Values
- `CR`: Created
- `IN`: In Progress
- `CO`: Completed

### Decision Code Values
- `BF01`: Breakdown with maintenance created
- `BF02`: Breakdown without maintenance
- `BF03`: Breakdown cancelled

## Pagination

The main history endpoint supports pagination with the following parameters:
- `page`: Page number (default: 1)
- `limit`: Records per page (default: 10)

## Error Responses

### 401 Unauthorized
```json
{
  "message": "Session expired. Please login again."
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to fetch breakdown history",
  "error": "Detailed error message"
}
```

## Usage Examples

### Example 1: Get all breakdown history for an asset
```bash
curl -X GET "http://localhost:4000/api/breakdown-history/asset/ASS001" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Example 2: Filter breakdown history by date range
```bash
curl -X POST "http://localhost:4000/api/breakdown-history/" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "breakdown_date_from": "2024-01-01",
    "breakdown_date_to": "2024-12-31",
    "breakdown_status": "CR"
  }'
```

### Example 3: Export breakdown history as PDF
```bash
curl -X POST "http://localhost:4000/api/breakdown-history/export?type=pdf" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "ASS001",
    "breakdown_status": "CR"
  }' \
  --output breakdown_history.pdf
```

### Example 4: Get breakdown history with pagination
```bash
curl -X POST "http://localhost:4000/api/breakdown-history/?page=2&limit=20" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "VEN001"
  }'
```

## Postman Testing Guide

### Setting up Postman for Breakdown History API

1. **Create a new Collection** named "Breakdown History API"

2. **Set up Environment Variables:**
   - `base_url`: `http://localhost:4000`
   - `jwt_token`: Your JWT token

3. **Create the following requests:**

#### Request 1: Get Breakdown History
- **Method:** POST
- **URL:** `{{base_url}}/api/breakdown-history/`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "breakdown_status": "CR"
}
```

#### Request 2: Get Breakdown History by Asset
- **Method:** GET
- **URL:** `{{base_url}}/api/breakdown-history/asset/ASS001`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 3: Get Summary
- **Method:** GET
- **URL:** `{{base_url}}/api/breakdown-history/summary`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 4: Get Filter Options
- **Method:** GET
- **URL:** `{{base_url}}/api/breakdown-history/filter-options`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 5: Export as CSV
- **Method:** POST
- **URL:** `{{base_url}}/api/breakdown-history/export?type=csv`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "breakdown_status": "CR"
}
```

#### Request 6: Export as PDF
- **Method:** POST
- **URL:** `{{base_url}}/api/breakdown-history/export?type=pdf`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "breakdown_status": "CR"
}
```

### Testing File Downloads in Postman

For export endpoints (CSV/PDF):

1. **Send the request** as configured above
2. **Check the response:**
   - Status should be `200 OK`
   - Content-Type should be `application/pdf` or `text/csv`
   - Content-Disposition header should contain filename
3. **Save the response:**
   - Click "Save Response" → "Save to a file"
   - Choose location and filename
   - The file will be downloaded with the correct format

### Expected Behavior

- **CSV Export:** Downloads a CSV file that can be opened in Excel
- **PDF Export:** Downloads a PDF file with vertical field layout
- **File Names:** Timestamped filenames (e.g., `breakdown-history-2024-08-24T10-00-00-000Z.pdf`)

## Data Structure

### Breakdown Tables Used
- `tblAssetBRDet`: Breakdown details information
- `tblATBRReasonCodes`: Breakdown reason codes
- `tblAssets`: Asset information
- `tblAssetTypes`: Asset type information
- `tblVendors`: Vendor information
- `tblUsers`: User information
- `tblDepartments`: Department information
- `tblAssetMaintSch`: Maintenance schedule information
- `tblMaintTypes`: Maintenance type information
- `tblBranches`: Branch information
- `tblAssetGroup_H`: Asset group information

### Key Relationships
- Breakdown → Asset (via asset_id)
- Breakdown → User (via reported_by)
- Breakdown → Reason Code (via atbrrc_id)
- Asset → Vendor (via service_vendor_id)
- Asset → Asset Type (via asset_type_id)
- User → Department (via dept_id)
- Asset → Maintenance Schedule (via asset_id and date)

## Notes

1. **Authentication Required:** All endpoints require valid JWT authentication
2. **Organization Context:** All queries are scoped to the organization (orgId)
3. **Pagination:** Main history endpoint supports pagination for large datasets
4. **Filtering:** Comprehensive filtering options available for targeted queries
5. **Export Support:** Both PDF and CSV export formats supported
6. **Vertical PDF Layout:** PDF exports display fields vertically as requested
7. **Work Order Integration:** Breakdown records linked to maintenance work orders when applicable
8. **Real-time Data:** All data reflects current state of breakdown tables

## Support

For technical support or questions about this API, please refer to the system documentation or contact the development team.
