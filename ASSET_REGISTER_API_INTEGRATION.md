# Asset Register API Integration

## Overview

This document describes the complete integration of the Asset Register Report with real API endpoints, replacing the mock data with actual database queries.

## Files Created/Modified

### Backend Files

1. **`models/assetRegisterModel.js`** - Database model for asset register queries
2. **`controllers/assetRegisterController.js`** - API controller for asset register endpoints
3. **`routes/assetRegisterRoutes.js`** - API routes for asset register
4. **`migrations/add_asset_register_fields.sql`** - Database migration to add missing fields
5. **`models/assetRegisterModelUpdated.js`** - Updated model with new fields (for future use)
6. **`server.js`** - Updated to include asset register routes

### Frontend Files

1. **`services/assetRegisterService.js`** - API service for frontend
2. **`components/reportModels/useReportState.js`** - Updated to use real API
3. **`pages/reports/AssetLifecycleReport.jsx`** - Updated to handle loading/error states

## API Endpoints

### 1. Get Asset Register Data
```
GET /api/asset-register
```

**Query Parameters:**
- `assetId` - Filter by asset ID (partial match)
- `department` - Filter by department (array)
- `employee` - Filter by employee (array)
- `vendor` - Filter by vendor (array)
- `poNumber` - Filter by PO number (partial match)
- `invoiceNumber` - Filter by invoice number (partial match)
- `category` - Filter by asset category (array)
- `location` - Filter by location (array)
- `purchaseDateRange` - Filter by purchase date range (array of 2 dates)
- `commissionedDateRange` - Filter by commissioned date range (array of 2 dates)
- `currentStatus` - Filter by current status (array)
- `cost` - Filter by minimum cost (number)
- `status` - Filter by status (array)
- `limit` - Number of records to return (default: 1000)
- `offset` - Number of records to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "message": "Asset register data retrieved successfully",
  "data": [
    {
      "Asset ID": "AST001",
      "Asset Name": "Laptop Computer",
      "Department": "IT",
      "Assigned Employee": "John Doe",
      "Vendor": "Dell Inc",
      "PO Number": "PO-2024-001",
      "Invoice Number": "INV-2024-001",
      "Category": "IT Equipment",
      "Location": "Coimbatore • HO",
      "Purchase Date": "2024-01-15",
      "Commissioned Date": "2024-01-20",
      "Current Status": "Active",
      "Cost": 1200.00,
      "Status": "Active"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 1000,
    "offset": 0,
    "hasMore": false
  }
}
```

### 2. Get Filter Options
```
GET /api/asset-register/filter-options
```

**Response:**
```json
{
  "success": true,
  "message": "Filter options retrieved successfully",
  "data": {
    "categories": ["IT Equipment", "Plant & Machinery", "Furniture"],
    "locations": ["Coimbatore • HO", "Bengaluru • WH-1"],
    "departments": ["IT", "Production", "Finance"],
    "employees": ["John Doe", "Jane Smith"],
    "vendors": ["Dell Inc", "HP Inc"],
    "current_statuses": ["Active", "In Use", "Under Maintenance"],
    "statuses": ["Active", "In Use", "Under Maintenance", "Disposed"]
  }
}
```

### 3. Get Summary Statistics
```
GET /api/asset-register/summary
```

**Response:**
```json
{
  "success": true,
  "message": "Asset register summary retrieved successfully",
  "data": {
    "total_assets": 150,
    "active_assets": 120,
    "in_use_assets": 100,
    "maintenance_assets": 15,
    "disposed_assets": 5,
    "total_value": 1500000.00,
    "average_cost": 10000.00,
    "asset_types": 25,
    "locations": 5,
    "departments_with_assets": 8
  }
}
```

## Database Schema

### Current tblAssets Table Fields Used:
- `asset_id` - Primary key
- `text` - Asset name
- `serial_number` - Asset serial number
- `description` - Asset description
- `branch_id` - Location/branch reference
- `purchase_vendor_id` - Purchase vendor reference
- `service_vendor_id` - Service vendor reference
- `purchased_cost` - Asset cost
- `purchased_on` - Purchase date
- `purchased_by` - Purchased by employee
- `expiry_date` - Asset expiry date
- `current_status` - Current asset status
- `warranty_period` - Warranty period
- `created_on` - Creation date
- `changed_on` - Last modified date

### Missing Fields (Added via Migration):
- `po_number` - Purchase order number
- `invoice_number` - Invoice number
- `commissioned_date` - Date when asset was commissioned
- `status` - Asset status for reporting purposes

### Related Tables:
- `tblAssetTypes` - Asset categories/types
- `tblBranches` - Locations/branches
- `tblVendors` - Vendor information
- `tblDepartments` - Department information
- `tblEmployees` - Employee information
- `tblAssetAssignments` - Asset assignments to departments/employees

## Setup Instructions

### 1. Database Migration
Run the migration script to add missing fields:
```sql
-- Run the migration script
\i migrations/add_asset_register_fields.sql
```

### 2. Backend Setup
The backend files are already created and integrated. The API endpoints will be available at:
- `http://localhost:5001/api/asset-register`

### 3. Frontend Setup
The frontend service is configured to use the API. Make sure the environment variable is set:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

## Usage

### 1. Access the Report
Navigate to the Asset Lifecycle Report page in the frontend application.

### 2. Apply Filters
Use the quick filters and advanced filters to narrow down the results:
- **Quick Filters**: Asset ID, Department, Employee, Vendor, PO Number, Invoice Number
- **Advanced Filters**: Category, Location, Date ranges, Cost, Status

### 3. View Results
The report will display real data from the database with:
- Asset information
- Department and employee assignments
- Vendor information
- Purchase and commissioning dates
- Cost and status information

## Error Handling

### Backend Errors
- Database connection errors
- Invalid filter parameters
- Missing required fields

### Frontend Errors
- API connection failures
- Authentication errors
- Data parsing errors

The frontend includes fallback to mock data if the API fails, ensuring the report remains functional.

## Performance Considerations

### Database Optimization
- Indexes on frequently filtered columns
- Pagination for large datasets
- Efficient JOIN queries

### Frontend Optimization
- Lazy loading of data
- Debounced search inputs
- Cached filter options

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data updates
2. **Export Functionality**: PDF/Excel export of filtered results
3. **Advanced Analytics**: Charts and graphs for asset data
4. **Bulk Operations**: Mass updates and operations on selected assets
5. **Audit Trail**: Track changes to asset data over time

## Troubleshooting

### Common Issues

1. **API Not Responding**
   - Check if backend server is running
   - Verify API endpoint URLs
   - Check authentication token

2. **Empty Results**
   - Verify database has data
   - Check filter parameters
   - Review database connections

3. **Performance Issues**
   - Check database indexes
   - Review query execution plans
   - Consider pagination limits

### Debug Mode
Enable debug logging in the backend to see detailed query information and execution times.
