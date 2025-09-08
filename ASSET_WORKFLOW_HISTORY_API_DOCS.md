# Asset Workflow History API Documentation

## Overview
The Asset Workflow History API provides programmatic access to workflow and maintenance history for assets. This API allows users to retrieve comprehensive workflow information including workflow steps, maintenance dates, notes, vendor information, asset details, and work order references.

## Base URL
```
http://localhost:4000/api/asset-workflow-history
```

## Authentication
All endpoints require JWT authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Asset Workflow History (with Filtering)
**Endpoint:** `POST /api/asset-workflow-history/`

**Description:** Retrieves asset workflow history with comprehensive filtering capabilities.

**Request Body:**
```json
{
  "asset_id": "ASS001",
  "vendor_id": "VEN001",
  "work_order_id": "WFAMSH001",
  "notes": "maintenance",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31",
  "maintenance_end_date_from": "2024-01-01",
  "maintenance_end_date_to": "2024-12-31",
  "workflow_status": "CO",
  "step_status": "UA",
  "user_id": "USR001",
  "department_id": "DEPT001"
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
      "workflow_id": "WFAMSH001",
      "asset_maintenance_frequency_id": "AMF001",
      "maintenance_type_id": "MT001",
      "asset_id": "ASS001",
      "group_id": "GRP001",
      "vendor_id": "VEN001",
      "planned_schedule_date": "2024-08-24",
      "actual_schedule_date": "2024-08-24",
      "workflow_status": "CO",
      "workflow_created_by": "system",
      "workflow_created_on": "2024-08-24T10:00:00Z",
      "workflow_changed_by": "system",
      "workflow_changed_on": "2024-08-24T12:00:00Z",
      "step_id": "WFAMSD001",
      "user_id": "USR001",
      "job_role_id": "JR001",
      "department_id": "DEPT001",
      "sequence": 1,
      "step_status": "UA",
      "step_notes": "Approved maintenance",
      "step_changed_by": "USR001",
      "step_changed_on": "2024-08-24T11:00:00Z",
      "serial_number": "LAP00001",
      "asset_description": "MacBook Pro",
      "asset_status": "Active",
      "purchased_on": "2023-01-15",
      "purchased_cost": 1500.00,
      "service_vendor_id": "VEN001",
      "asset_type_id": "AT001",
      "asset_type_name": "Laptop",
      "maintenance_lead_type": "7",
      "maintenance_type_name": "Regular Maintenance",
      "vendor_name": "Tech Solutions Inc",
      "vendor_contact_person": "John Doe",
      "vendor_email": "john@techsolutions.com",
      "vendor_phone": "123-456-7890",
      "vendor_address": "123 Tech St, City, State 12345",
      "user_name": "Jane Smith",
      "user_email": "jane@company.com",
      "department_name": "IT Department",
      "job_role_name": "IT Manager",
      "history_count": 3,
      "latest_action": "UA",
      "latest_action_date": "2024-08-24T11:00:00Z",
      "latest_action_by": "Jane Smith"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 50,
    "records_per_page": 10,
    "has_next_page": true,
    "has_previous_page": false
  },
  "filters_applied": {
    "asset_id": "ASS001",
    "workflow_status": "CO"
  }
}
```

### 2. Get Asset Workflow History by Asset ID
**Endpoint:** `GET /api/asset-workflow-history/asset/{assetId}`

**Description:** Retrieves all workflow history for a specific asset.

**Path Parameters:**
- `assetId`: The asset ID to retrieve workflow history for

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "workflow_id": "WFAMSH001",
      "asset_id": "ASS001",
      "workflow_status": "CO",
      "planned_schedule_date": "2024-08-24",
      "actual_schedule_date": "2024-08-24",
      "serial_number": "LAP00001",
      "asset_description": "MacBook Pro",
      "vendor_name": "Tech Solutions Inc",
      "maintenance_type_name": "Regular Maintenance",
      "user_name": "Jane Smith",
      "department_name": "IT Department",
      "step_status": "UA",
      "sequence": 1,
      "step_notes": "Approved maintenance",
      "history_count": 3,
      "latest_action": "UA",
      "latest_action_date": "2024-08-24T11:00:00Z",
      "latest_action_by": "Jane Smith"
    }
  ],
  "asset_id": "ASS001",
  "total_records": 1
}
```

### 3. Get Workflow History Details
**Endpoint:** `GET /api/asset-workflow-history/workflow/{workflowId}`

**Description:** Retrieves detailed history of actions for a specific workflow.

**Path Parameters:**
- `workflowId`: The workflow ID to retrieve history details for

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "history_id": "WFAMHIS001",
      "workflow_id": "WFAMSH001",
      "step_id": "WFAMSD001",
      "action_by": "USR001",
      "action_on": "2024-08-24T10:00:00Z",
      "action": "AP",
      "history_notes": "Workflow initiated",
      "action_by_name": "Jane Smith",
      "action_by_email": "jane@company.com",
      "sequence": 1,
      "step_status": "AP",
      "step_user_id": "USR001",
      "job_role_id": "JR001",
      "department_id": "DEPT001",
      "step_user_name": "Jane Smith",
      "step_user_email": "jane@company.com",
      "department_name": "IT Department",
      "job_role_name": "IT Manager"
    }
  ],
  "workflow_id": "WFAMSH001",
  "total_records": 3
}
```

### 4. Get Asset Workflow History Summary
**Endpoint:** `GET /api/asset-workflow-history/summary`

**Description:** Retrieves summary statistics for asset workflow history.

**Query Parameters:**
- `orgId` (optional): Organization ID (default: ORG001)

**Response:**
```json
{
  "success": true,
  "summary": {
    "total_workflow_records": 150,
    "completed_workflows": 120,
    "in_progress_workflows": 15,
    "in_process_workflows": 10,
    "cancelled_workflows": 5,
    "workflows_last_30_days": 25,
    "workflows_last_90_days": 75,
    "unique_assets_in_workflow": 45,
    "unique_vendors_in_workflow": 12,
    "unique_users_in_workflow": 8
  }
}
```

### 5. Get Workflow Filter Options
**Endpoint:** `GET /api/asset-workflow-history/filter-options`

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
        "work_order_id": "WFAMSH001"
      }
    ],
    "maintenance_type_options": [
      {
        "maint_type_id": "MT001",
        "maintenance_type_name": "Regular Maintenance"
      }
    ],
    "workflow_status_options": [
      {
        "workflow_status": "CO"
      },
      {
        "workflow_status": "IN"
      },
      {
        "workflow_status": "IP"
      },
      {
        "workflow_status": "CA"
      }
    ],
    "step_status_options": [
      {
        "step_status": "AP"
      },
      {
        "step_status": "UA"
      },
      {
        "step_status": "UR"
      }
    ],
    "user_options": [
      {
        "user_id": "USR001",
        "full_name": "Jane Smith"
      }
    ],
    "department_options": [
      {
        "dept_id": "DEPT001",
        "department_name": "IT Department"
      }
    ]
  }
}
```

### 6. Export Asset Workflow History
**Endpoint:** `POST /api/asset-workflow-history/export`

**Description:** Exports asset workflow history data in PDF or CSV format.

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
Content-Disposition: attachment; filename="asset-workflow-history-2024-08-24T10-00-00-000Z.pdf"
```

## Filter Parameters

### Available Filters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `asset_id` | string | Filter by specific asset ID | "ASS001" |
| `vendor_id` | string | Filter by vendor ID | "VEN001" |
| `work_order_id` | string | Filter by workflow ID | "WFAMSH001" |
| `notes` | string | Text search in notes | "maintenance" |
| `maintenance_start_date_from` | date | Filter from maintenance start date | "2024-01-01" |
| `maintenance_start_date_to` | date | Filter to maintenance start date | "2024-12-31" |
| `maintenance_end_date_from` | date | Filter from maintenance end date | "2024-01-01" |
| `maintenance_end_date_to` | date | Filter to maintenance end date | "2024-12-31" |
| `workflow_status` | string | Filter by workflow status | "CO", "IN", "IP", "CA" |
| `step_status` | string | Filter by step status | "AP", "UA", "UR" |
| `user_id` | string | Filter by user ID | "USR001" |
| `department_id` | string | Filter by department ID | "DEPT001" |

### Workflow Status Values
- `CO`: Completed
- `IN`: In Progress
- `IP`: In Process
- `CA`: Cancelled

### Step Status Values
- `AP`: Approval Pending
- `UA`: User Approved
- `UR`: User Rejected

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
  "message": "Failed to fetch asset workflow history",
  "error": "Detailed error message"
}
```

## Usage Examples

### Example 1: Get all workflow history for an asset
```bash
curl -X GET "http://localhost:4000/api/asset-workflow-history/asset/ASS001" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Example 2: Filter workflow history by date range
```bash
curl -X POST "http://localhost:4000/api/asset-workflow-history/" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenance_start_date_from": "2024-01-01",
    "maintenance_start_date_to": "2024-12-31",
    "workflow_status": "CO"
  }'
```

### Example 3: Export workflow history as PDF
```bash
curl -X POST "http://localhost:4000/api/asset-workflow-history/export?type=pdf" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_id": "ASS001",
    "workflow_status": "CO"
  }' \
  --output workflow_history.pdf
```

### Example 4: Get workflow history with pagination
```bash
curl -X POST "http://localhost:4000/api/asset-workflow-history/?page=2&limit=20" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "VEN001"
  }'
```

## Postman Testing Guide

### Setting up Postman for Asset Workflow History API

1. **Create a new Collection** named "Asset Workflow History API"

2. **Set up Environment Variables:**
   - `base_url`: `http://localhost:4000`
   - `jwt_token`: Your JWT token

3. **Create the following requests:**

#### Request 1: Get Asset Workflow History
- **Method:** POST
- **URL:** `{{base_url}}/api/asset-workflow-history/`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "workflow_status": "CO"
}
```

#### Request 2: Get Asset Workflow History by Asset
- **Method:** GET
- **URL:** `{{base_url}}/api/asset-workflow-history/asset/ASS001`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 3: Get Workflow History Details
- **Method:** GET
- **URL:** `{{base_url}}/api/asset-workflow-history/workflow/WFAMSH001`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 4: Get Summary
- **Method:** GET
- **URL:** `{{base_url}}/api/asset-workflow-history/summary`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 5: Get Filter Options
- **Method:** GET
- **URL:** `{{base_url}}/api/asset-workflow-history/filter-options`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`

#### Request 6: Export as CSV
- **Method:** POST
- **URL:** `{{base_url}}/api/asset-workflow-history/export?type=csv`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "workflow_status": "CO"
}
```

#### Request 7: Export as PDF
- **Method:** POST
- **URL:** `{{base_url}}/api/asset-workflow-history/export?type=pdf`
- **Headers:**
  - `Authorization`: `Bearer {{jwt_token}}`
  - `Content-Type`: `application/json`
- **Body (raw JSON):**
```json
{
  "asset_id": "ASS001",
  "workflow_status": "CO"
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
- **File Names:** Timestamped filenames (e.g., `asset-workflow-history-2024-08-24T10-00-00-000Z.pdf`)

## Data Structure

### Workflow Tables Used
- `tblWFAssetMaintSch_H`: Workflow header information
- `tblWFAssetMaintSch_D`: Workflow step details
- `tblWFAssetMaintHist`: Workflow history/audit trail
- `tblAssets`: Asset information
- `tblAssetTypes`: Asset type information
- `tblVendors`: Vendor information
- `tblUsers`: User information
- `tblDepartments`: Department information
- `tblJobRoles`: Job role information
- `tblMaintTypes`: Maintenance type information

### Key Relationships
- Workflow Header → Asset (via asset_id)
- Workflow Header → Vendor (via vendor_id)
- Workflow Detail → User (via user_id)
- Workflow Detail → Department (via dept_id)
- Workflow Detail → Job Role (via job_role_id)
- Workflow History → Workflow Detail (via wfamsd_id)

## Notes

1. **Authentication Required:** All endpoints require valid JWT authentication
2. **Organization Context:** All queries are scoped to the organization (orgId)
3. **Pagination:** Main history endpoint supports pagination for large datasets
4. **Filtering:** Comprehensive filtering options available for targeted queries
5. **Export Support:** Both PDF and CSV export formats supported
6. **Vertical PDF Layout:** PDF exports display fields vertically as requested
7. **Audit Trail:** Complete workflow history and audit trail available
8. **Real-time Data:** All data reflects current state of workflow tables

## Support

For technical support or questions about this API, please refer to the system documentation or contact the development team.
