# Maintenance History API Documentation

## Overview
The Maintenance History API provides comprehensive access to maintenance records from the `tblAssetMaintSch` table with advanced filtering capabilities. This API allows users to retrieve, filter, and analyze maintenance history data for assets, work orders, and vendors.

## Base URL
```
/api/maintenance-history
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Maintenance History with Filtering
**GET** `/api/maintenance-history/`

Retrieves maintenance history records with comprehensive filtering options.

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |
| `asset_id` | string | Filter by specific asset ID | `AST001` |
| `vendor_id` | string | Filter by specific vendor ID | `VND001` |
| `wo_id` | string | Filter by specific work order ID | `WO001` |
| `notes` | string | Text search within notes field | `repair` |
| `maintenance_start_date_from` | date | Filter maintenance start date from (YYYY-MM-DD) | `2024-01-01` |
| `maintenance_start_date_to` | date | Filter maintenance start date to (YYYY-MM-DD) | `2024-12-31` |
| `maintenance_end_date_from` | date | Filter maintenance end date from (YYYY-MM-DD) | `2024-01-01` |
| `maintenance_end_date_to` | date | Filter maintenance end date to (YYYY-MM-DD) | `2024-12-31` |
| `status` | string | Filter by maintenance status | `CO` (Completed), `IN` (In Progress), `CA` (Cancelled) |
| `maintenance_type_id` | string | Filter by maintenance type ID | `MT001` |
| `page` | number | Page number for pagination (default: 1) | `1` |
| `limit` | number | Records per page (default: 50) | `25` |

#### Example Request
```bash
GET /api/maintenance-history/?asset_id=AST001&maintenance_start_date_from=2024-01-01&maintenance_start_date_to=2024-12-31&page=1&limit=25
```

#### Response
```json
{
  "success": true,
  "message": "Maintenance history retrieved successfully",
  "data": [
    {
      "ams_id": "ams001",
      "wo_id": "WO001",
      "asset_id": "AST001",
      "maint_type_id": "MT001",
      "vendor_id": "VND001",
      "act_maint_st_date": "2024-01-15",
      "act_main_end_date": "2024-01-16",
      "notes": "Regular maintenance completed",
      "status": "CO",
      "maintained_by": "John Doe",
      "po_number": "PO001",
      "invoice": "INV001",
      "technician_name": "Jane Smith",
      "technician_email": "jane@example.com",
      "technician_phno": "+1234567890",
      "created_by": "system",
      "created_on": "2024-01-10T10:00:00Z",
      "changed_by": "admin",
      "changed_on": "2024-01-16T15:30:00Z",
      "org_id": "ORG001",
      "serial_number": "SN001",
      "asset_description": "Laptop Computer",
      "asset_status": "Active",
      "purchased_on": "2023-01-01",
      "purchased_cost": 1500.00,
      "asset_type_id": "AT001",
      "asset_type_name": "Computer Equipment",
      "maintenance_type_name": "Preventive Maintenance",
      "vendor_name": "Tech Solutions Inc",
      "vendor_contact_person": "Mike Johnson",
      "vendor_email": "mike@techsolutions.com",
      "vendor_phone": "+1987654321",
      "vendor_address": "123 Tech Street, City, State"
    }
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 5,
    "total_records": 125,
    "records_per_page": 25,
    "has_next_page": true,
    "has_previous_page": false
  },
  "filters_applied": {
    "asset_id": "AST001",
    "maintenance_start_date_from": "2024-01-01",
    "maintenance_start_date_to": "2024-12-31",
    "limit": 25,
    "offset": 0
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 2. Get Maintenance History by Asset ID
**GET** `/api/maintenance-history/asset/:assetId`

Retrieves all maintenance history records for a specific asset.

#### Path Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `assetId` | string | Asset ID to retrieve maintenance history for | `AST001` |

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |

#### Example Request
```bash
GET /api/maintenance-history/asset/AST001?orgId=ORG001
```

#### Response
```json
{
  "success": true,
  "message": "Maintenance history for asset retrieved successfully",
  "data": [
    {
      "ams_id": "ams001",
      "wo_id": "WO001",
      "asset_id": "AST001",
      "maint_type_id": "MT001",
      "vendor_id": "VND001",
      "act_maint_st_date": "2024-01-15",
      "act_main_end_date": "2024-01-16",
      "notes": "Regular maintenance completed",
      "status": "CO",
      "maintained_by": "John Doe",
      "po_number": "PO001",
      "invoice": "INV001",
      "technician_name": "Jane Smith",
      "technician_email": "jane@example.com",
      "technician_phno": "+1234567890",
      "created_by": "system",
      "created_on": "2024-01-10T10:00:00Z",
      "changed_by": "admin",
      "changed_on": "2024-01-16T15:30:00Z",
      "org_id": "ORG001",
      "serial_number": "SN001",
      "asset_description": "Laptop Computer",
      "asset_status": "Active",
      "purchased_on": "2023-01-01",
      "purchased_cost": 1500.00,
      "asset_type_id": "AT001",
      "asset_type_name": "Computer Equipment",
      "maintenance_type_name": "Preventive Maintenance",
      "vendor_name": "Tech Solutions Inc",
      "vendor_contact_person": "Mike Johnson",
      "vendor_email": "mike@techsolutions.com",
      "vendor_phone": "+1987654321",
      "vendor_address": "123 Tech Street, City, State"
    }
  ],
  "count": 1,
  "asset_id": "AST001",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 3. Get Maintenance History by Work Order ID
**GET** `/api/maintenance-history/work-order/:woId`

Retrieves maintenance history records for a specific work order.

#### Path Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `woId` | string | Work Order ID to retrieve maintenance history for | `WO001` |

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |

#### Example Request
```bash
GET /api/maintenance-history/work-order/WO001?orgId=ORG001
```

#### Response
```json
{
  "success": true,
  "message": "Maintenance history for work order retrieved successfully",
  "data": [
    {
      "ams_id": "ams001",
      "wo_id": "WO001",
      "asset_id": "AST001",
      "maint_type_id": "MT001",
      "vendor_id": "VND001",
      "act_maint_st_date": "2024-01-15",
      "act_main_end_date": "2024-01-16",
      "notes": "Regular maintenance completed",
      "status": "CO",
      "maintained_by": "John Doe",
      "po_number": "PO001",
      "invoice": "INV001",
      "technician_name": "Jane Smith",
      "technician_email": "jane@example.com",
      "technician_phno": "+1234567890",
      "created_by": "system",
      "created_on": "2024-01-10T10:00:00Z",
      "changed_by": "admin",
      "changed_on": "2024-01-16T15:30:00Z",
      "org_id": "ORG001",
      "serial_number": "SN001",
      "asset_description": "Laptop Computer",
      "asset_status": "Active",
      "purchased_on": "2023-01-01",
      "purchased_cost": 1500.00,
      "asset_type_id": "AT001",
      "asset_type_name": "Computer Equipment",
      "maintenance_type_name": "Preventive Maintenance",
      "vendor_name": "Tech Solutions Inc",
      "vendor_contact_person": "Mike Johnson",
      "vendor_email": "mike@techsolutions.com",
      "vendor_phone": "+1987654321",
      "vendor_address": "123 Tech Street, City, State"
    }
  ],
  "count": 1,
  "wo_id": "WO001",
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 4. Get Maintenance History Summary
**GET** `/api/maintenance-history/summary`

Retrieves summary statistics for maintenance history.

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |

#### Example Request
```bash
GET /api/maintenance-history/summary?orgId=ORG001
```

#### Response
```json
{
  "success": true,
  "message": "Maintenance history summary retrieved successfully",
  "data": {
    "total_maintenance_records": 1250,
    "completed_maintenance": 1100,
    "in_progress_maintenance": 50,
    "cancelled_maintenance": 100,
    "maintenance_last_30_days": 45,
    "maintenance_last_90_days": 120,
    "unique_assets_maintained": 500,
    "unique_vendors_used": 25
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 5. Get Filter Options
**GET** `/api/maintenance-history/filter-options`

Retrieves available filter options for dropdown menus.

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |

#### Example Request
```bash
GET /api/maintenance-history/filter-options?orgId=ORG001
```

#### Response
```json
{
  "success": true,
  "message": "Filter options retrieved successfully",
  "data": {
    "asset_options": [
      {
        "asset_id": "AST001",
        "serial_number": "SN001",
        "description": "Laptop Computer"
      },
      {
        "asset_id": "AST002",
        "serial_number": "SN002",
        "description": "Desktop Computer"
      }
    ],
    "vendor_options": [
      {
        "vendor_id": "VND001",
        "vendor_name": "Tech Solutions Inc"
      },
      {
        "vendor_id": "VND002",
        "vendor_name": "Maintenance Pro"
      }
    ],
    "work_order_options": [
      {
        "wo_id": "WO001"
      },
      {
        "wo_id": "WO002"
      }
    ],
    "maintenance_type_options": [
      {
        "maint_type_id": "MT001",
        "maintenance_type_name": "Preventive Maintenance"
      },
      {
        "maint_type_id": "MT002",
        "maintenance_type_name": "Corrective Maintenance"
      }
    ],
    "status_options": [
      {
        "status": "CO"
      },
      {
        "status": "IN"
      },
      {
        "status": "CA"
      }
    ]
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

### 6. Export Maintenance History
**POST** `/api/maintenance-history/export`

Exports maintenance history data as PDF or CSV file for download.

#### Request Body
```json
{
  "asset_id": "AST001",
  "vendor_id": "VND001",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31",
  "status": "CO"
}
```

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `orgId` | string | Organization ID (optional, defaults to 'ORG001') | `ORG001` |
| `type` | string | Export type: 'pdf' or 'csv' (default: 'pdf') | `pdf` |

#### Example Requests

**Export as PDF:**
```bash
POST /api/maintenance-history/export?orgId=ORG001&type=pdf
Content-Type: application/json

{
  "asset_id": "AST001",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31"
}
```

**Export as CSV:**
```bash
POST /api/maintenance-history/export?orgId=ORG001&type=csv
Content-Type: application/json

{
  "asset_id": "AST001",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31"
}
```

#### Response

**For PDF Export:**
- **Content-Type:** `application/pdf`
- **Content-Disposition:** `attachment; filename="maintenance-history-2024-01-20T10-30-00-000Z.pdf"`
- **Body:** PDF file binary data

**For CSV Export:**
- **Content-Type:** `text/csv`
- **Content-Disposition:** `attachment; filename="maintenance-history-2024-01-20T10-30-00-000Z.csv"`
- **Body:** CSV file content

#### PDF Format Features
- **Vertical Field Layout:** Each field is displayed vertically with label and value
- **Multi-page Support:** Automatically handles multiple pages for large datasets
- **Filters Display:** Shows applied filters at the top of the document
- **Record Separation:** Each maintenance record is clearly separated
- **Page Numbers:** Footer with page numbers
- **Professional Layout:** Clean, readable format suitable for reports

#### CSV Format Features
- **Standard CSV Format:** Compatible with Excel and other spreadsheet applications
- **Proper Escaping:** Handles commas and quotes in data correctly
- **All Fields Included:** Contains all maintenance history fields
- **UTF-8 Encoding:** Supports international characters

#### Error Response (No Data Found)
```json
{
  "success": false,
  "message": "No maintenance history records found for export"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Asset ID is required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "No maintenance history found for this asset"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to retrieve maintenance history",
  "error": "Database connection error"
}
```

## Data Model

### Maintenance History Record
| Field | Type | Description |
|-------|------|-------------|
| `ams_id` | string | Asset Maintenance Schedule ID |
| `wo_id` | string | Work Order ID |
| `asset_id` | string | Asset ID |
| `maint_type_id` | string | Maintenance Type ID |
| `vendor_id` | string | Vendor ID |
| `act_maint_st_date` | date | Actual Maintenance Start Date |
| `act_main_end_date` | date | Actual Maintenance End Date |
| `notes` | string | Maintenance Notes |
| `status` | string | Maintenance Status (CO/IN/CA) |
| `maintained_by` | string | Person who performed maintenance |
| `po_number` | string | Purchase Order Number |
| `invoice` | string | Invoice Number |
| `technician_name` | string | Technician Name |
| `technician_email` | string | Technician Email |
| `technician_phno` | string | Technician Phone Number |
| `created_by` | string | Record Created By |
| `created_on` | datetime | Record Created On |
| `changed_by` | string | Record Changed By |
| `changed_on` | datetime | Record Changed On |
| `org_id` | string | Organization ID |

### Related Asset Information
| Field | Type | Description |
|-------|------|-------------|
| `serial_number` | string | Asset Serial Number |
| `asset_description` | string | Asset Description |
| `asset_status` | string | Current Asset Status |
| `purchased_on` | date | Asset Purchase Date |
| `purchased_cost` | decimal | Asset Purchase Cost |
| `asset_type_id` | string | Asset Type ID |
| `asset_type_name` | string | Asset Type Name |

### Related Maintenance Type Information
| Field | Type | Description |
|-------|------|-------------|
| `maintenance_type_name` | string | Maintenance Type Name |

### Related Vendor Information
| Field | Type | Description |
|-------|------|-------------|
| `vendor_name` | string | Vendor Name |
| `vendor_contact_person` | string | Vendor Contact Person |
| `vendor_email` | string | Vendor Email |
| `vendor_phone` | string | Vendor Phone |
| `vendor_address` | string | Vendor Address |

## Postman Testing Guide

### Testing File Export Endpoints

#### 1. **Export as PDF**
```
Method: POST
URL: http://localhost:4000/api/maintenance-history/export?type=pdf&orgId=ORG001
Headers:
  Authorization: Bearer <your-jwt-token>
  Content-Type: application/json
Body (raw JSON):
{
  "asset_id": "ASS001",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31"
}
```

#### 2. **Export as CSV**
```
Method: POST
URL: http://localhost:4000/api/maintenance-history/export?type=csv&orgId=ORG001
Headers:
  Authorization: Bearer <your-jwt-token>
  Content-Type: application/json
Body (raw JSON):
{
  "asset_id": "ASS001",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31"
}
```

#### 3. **Export All Records (No Filters)**
```
Method: POST
URL: http://localhost:4000/api/maintenance-history/export?type=pdf
Headers:
  Authorization: Bearer <your-jwt-token>
  Content-Type: application/json
Body (raw JSON):
{}
```

#### 4. **Export with Multiple Filters**
```
Method: POST
URL: http://localhost:4000/api/maintenance-history/export?type=csv
Headers:
  Authorization: Bearer <your-jwt-token>
  Content-Type: application/json
Body (raw JSON):
{
  "asset_id": "ASS001",
  "vendor_id": "VND001",
  "status": "CO",
  "maintenance_start_date_from": "2024-01-01",
  "maintenance_start_date_to": "2024-12-31",
  "notes": "maintenance"
}
```

### Expected Behavior in Postman

1. **Successful Export:**
   - Response will show binary data (for PDF) or CSV text (for CSV)
   - File will automatically download with timestamped filename
   - Content-Type header will be set appropriately

2. **No Data Found:**
   - JSON response with error message
   - Status code: 404

3. **Authentication Error:**
   - JSON response: `{"message": "Session expired. Please login again."}`
   - Status code: 401

### Postman Collection Setup

Create a collection with these requests:
1. **Login** - Get authentication token
2. **Export PDF** - Download PDF file
3. **Export CSV** - Download CSV file
4. **Export with Filters** - Test filtered export
5. **Export All** - Test export without filters

### Environment Variables
```
base_url: http://localhost:4000
token: {{your-jwt-token}}
org_id: ORG001
```

Then use: `{{base_url}}/api/maintenance-history/export?orgId={{org_id}}&type=pdf`

## Usage Examples

### Frontend Integration Example (JavaScript)
```javascript
// Get maintenance history with filters
const getMaintenanceHistory = async (filters = {}) => {
  try {
    const queryParams = new URLSearchParams(filters);
    const response = await fetch(`/api/maintenance-history/?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching maintenance history:', error);
    throw error;
  }
};

// Usage
const maintenanceHistory = await getMaintenanceHistory({
  asset_id: 'AST001',
  maintenance_start_date_from: '2024-01-01',
  maintenance_start_date_to: '2024-12-31',
  page: 1,
  limit: 25
});
```

### React Component Example
```jsx
import React, { useState, useEffect } from 'react';

const MaintenanceHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    asset_id: '',
    vendor_id: '',
    maintenance_start_date_from: '',
    maintenance_start_date_to: '',
    status: ''
  });

  const fetchMaintenanceHistory = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/maintenance-history/?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setHistory(data.data);
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceHistory();
  }, [filters]);

  return (
    <div>
      <h2>Maintenance History</h2>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {history.map(record => (
            <div key={record.ams_id}>
              <h3>{record.asset_description}</h3>
              <p>Status: {record.status}</p>
              <p>Start Date: {record.act_maint_st_date}</p>
              <p>Vendor: {record.vendor_name}</p>
              <p>Notes: {record.notes}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MaintenanceHistory;
```

## Notes

1. **Authentication**: All endpoints require valid JWT authentication.
2. **Pagination**: The main endpoint supports pagination with `page` and `limit` parameters.
3. **Date Format**: All dates should be in YYYY-MM-DD format.
4. **Text Search**: The `notes` parameter performs case-insensitive partial matching.
5. **Organization**: All queries are scoped to the organization specified in `orgId`.
6. **Performance**: For large datasets, consider using pagination and specific filters to improve response times.
7. **Export**: The export endpoint returns data formatted for Excel export with human-readable column names.

## Status Codes

- `CO`: Completed
- `IN`: In Progress  
- `CA`: Cancelled

## Related APIs

- Asset Management API: `/api/assets`
- Vendor Management API: `/api/vendors`
- Maintenance Types API: `/api/maint-types`
- Work Orders API: `/api/work-orders`
