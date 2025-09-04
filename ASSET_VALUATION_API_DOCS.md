# Asset Valuation API Documentation

## Overview

The Asset Valuation API provides a comprehensive way to fetch and analyze organizational assets, including both in-use and scrap assets. The API returns detailed asset information with current values (after depreciation) and provides totals for different asset categories.

## Base URL
```
/api/asset-valuation
```

## Authentication
Most endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Get Asset Valuation Data
**GET** `/api/asset-valuation`

Retrieves comprehensive asset valuation data with filtering, pagination, and sorting capabilities.

#### Query Parameters

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `assetStatus` | string | Filter by asset status: "In-Use", "Scrap", or "All" | "In-Use" | `?assetStatus=In-Use` |
| `includeScrapAssets` | boolean | Include scrap assets in results | false | `?includeScrapAssets=true` |
| `currentValueMin` | number | Minimum current value filter | null | `?currentValueMin=10000` |
| `currentValueMax` | number | Maximum current value filter | null | `?currentValueMax=100000` |
| `category` | array | Filter by asset categories | null | `?category[]=IT Equipment&category[]=Vehicles` |
| `location` | array | Filter by locations | null | `?location[]=Coimbatore • HO&location[]=Bengaluru • WH-1` |
| `department` | array | Filter by departments | null | `?department[]=Production&department[]=Finance` |
| `acquisitionDateFrom` | date | Acquisition date from (YYYY-MM-DD) | null | `?acquisitionDateFrom=2023-01-01` |
| `acquisitionDateTo` | date | Acquisition date to (YYYY-MM-DD) | null | `?acquisitionDateTo=2023-12-31` |
| `page` | number | Page number for pagination | 1 | `?page=2` |
| `limit` | number | Number of records per page | 100 | `?limit=50` |
| `sortBy` | string | Sort field | "asset_id" | `?sortBy=Current Value` |
| `sortOrder` | string | Sort order: "ASC" or "DESC" | "ASC" | `?sortOrder=DESC` |

#### Response Format

```json
{
  "success": true,
  "message": "Asset valuation data retrieved successfully",
  "data": [
    {
      "Asset Code": "AST-1001",
      "Name": "Laptop Dell",
      "Category": "IT Equipment",
      "Location": "Coimbatore • HO",
      "Department": "IT",
      "Asset Status": "In-Use",
      "Acquisition Date": "2023-01-15",
      "Current Value": 45000.00,
      "Original Cost": 60000.00,
      "Accumulated Depreciation": 15000.00,
      "Net Book Value": 45000.00,
      "Depreciation Method": "SLM",
      "Useful Life": 5,
      "serial_number": "DL001",
      "description": "Dell Laptop for IT Department",
      "Vendor": "Dell Technologies",
      "purchased_by": "John Doe",
      "warranty_period": 3,
      "expiry_date": "2026-01-15"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 150,
    "totalPages": 2
  },
  "totals": {
    "inUse": {
      "count": 120,
      "totalCurrentValue": 5400000.00,
      "totalOriginalCost": 7200000.00,
      "totalAccumulatedDepreciation": 1800000.00,
      "totalNetBookValue": 5400000.00
    },
    "scrap": {
      "count": 30,
      "totalCurrentValue": 450000.00,
      "totalOriginalCost": 900000.00,
      "totalAccumulatedDepreciation": 450000.00,
      "totalNetBookValue": 450000.00
    },
    "overall": {
      "count": 150,
      "totalCurrentValue": 5850000.00,
      "totalOriginalCost": 8100000.00,
      "totalAccumulatedDepreciation": 2250000.00,
      "totalNetBookValue": 5850000.00
    }
  },
  "filters": {
    "assetStatus": "In-Use",
    "includeScrapAssets": false,
    "currentValueMin": null,
    "currentValueMax": null,
    "category": null,
    "location": null,
    "department": null,
    "acquisitionDateFrom": null,
    "acquisitionDateTo": null,
    "page": 1,
    "limit": 100,
    "sortBy": "asset_id",
    "sortOrder": "ASC"
  }
}
```

### 2. Get Asset Valuation Summary
**GET** `/api/asset-valuation/summary`

Retrieves a summary of asset valuation data for dashboard display.

#### Response Format

```json
{
  "success": true,
  "message": "Asset valuation summary retrieved successfully",
  "data": {
    "inUse": {
      "count": 120,
      "totalCurrentValue": 5400000.00,
      "totalOriginalCost": 7200000.00,
      "totalAccumulatedDepreciation": 1800000.00
    },
    "scrap": {
      "count": 30,
      "totalCurrentValue": 450000.00,
      "totalOriginalCost": 900000.00,
      "totalAccumulatedDepreciation": 450000.00
    },
    "overall": {
      "count": 150,
      "totalCurrentValue": 5850000.00,
      "totalOriginalCost": 8100000.00,
      "totalAccumulatedDepreciation": 2250000.00
    }
  }
}
```

### 3. Get Filter Options
**GET** `/api/asset-valuation/filter-options`

Retrieves available filter options for the frontend.

#### Response Format

```json
{
  "success": true,
  "message": "Filter options retrieved successfully",
  "data": {
    "categories": [
      "IT Equipment",
      "Plant & Machinery",
      "Vehicles",
      "Furniture",
      "Tools"
    ],
    "locations": [
      "Coimbatore • HO",
      "Bengaluru • WH-1",
      "Chennai • Plant-1"
    ],
    "departments": [
      "Production",
      "Finance",
      "IT",
      "Maintenance",
      "Admin"
    ],
    "vendors": [
      "Dell Technologies",
      "Acme Engg",
      "Prism Tech",
      "SparesKart"
    ]
  }
}
```

## Export Endpoints

### 4. Export to Excel
**GET** `/api/asset-valuation/export/excel`

Exports asset valuation data to Excel format with the same filtering options as the main endpoint.

#### Query Parameters
Same as the main endpoint, excluding pagination parameters.

#### Response
Returns an Excel file (.xlsx) with two sheets:
- **Asset Data**: Detailed asset information
- **Summary**: Totals and summary information

### 5. Export to CSV
**GET** `/api/asset-valuation/export/csv`

Exports asset valuation data to CSV format.

#### Query Parameters
Same as the main endpoint, excluding pagination parameters.

#### Response
Returns a CSV file with asset data.

### 6. Export to JSON
**GET** `/api/asset-valuation/export/json`

Exports asset valuation data to JSON format with additional metadata.

#### Query Parameters
Same as the main endpoint, excluding pagination parameters.

#### Response Format

```json
{
  "exportInfo": {
    "generatedAt": "2024-01-15T10:30:00.000Z",
    "filters": {
      "assetStatus": "In-Use",
      "includeScrapAssets": false
    },
    "totalRecords": 150
  },
  "summary": {
    "inUse": {
      "count": 120,
      "totalCurrentValue": 5400000.00,
      "totalOriginalCost": 7200000.00,
      "totalAccumulatedDepreciation": 1800000.00,
      "totalNetBookValue": 5400000.00
    },
    "scrap": {
      "count": 30,
      "totalCurrentValue": 450000.00,
      "totalOriginalCost": 900000.00,
      "totalAccumulatedDepreciation": 450000.00,
      "totalNetBookValue": 450000.00
    },
    "overall": {
      "count": 150,
      "totalCurrentValue": 5850000.00,
      "totalOriginalCost": 8100000.00,
      "totalAccumulatedDepreciation": 2250000.00,
      "totalNetBookValue": 5850000.00
    }
  },
  "assets": [
    {
      "assetCode": "AST-1001",
      "name": "Laptop Dell",
      "category": "IT Equipment",
      "location": "Coimbatore • HO",
      "department": "IT",
      "assetStatus": "In-Use",
      "acquisitionDate": "2023-01-15",
      "currentValue": 45000.00,
      "originalCost": 60000.00,
      "accumulatedDepreciation": 15000.00,
      "netBookValue": 45000.00,
      "depreciationMethod": "SLM",
      "usefulLife": 5,
      "serialNumber": "DL001",
      "description": "Dell Laptop for IT Department",
      "vendor": "Dell Technologies",
      "purchasedBy": "John Doe",
      "warrantyPeriod": 3,
      "expiryDate": "2026-01-15"
    }
  ]
}
```

## Database Tables Used

The API queries the following database tables:

- **tblAssets**: Main asset table with depreciation information
- **tblAssetTypes**: Asset type information with depreciation methods
- **tblBranches**: Location/branch information
- **tblVendors**: Vendor information
- **tblProdServs**: Department information
- **tblAssetScrapDet**: Scrap asset details (for scrap assets)

## Key Features

### 1. Comprehensive Filtering
- Asset status filtering (In-Use, Scrap, All)
- Value range filtering
- Category, location, and department filtering
- Date range filtering for acquisition dates

### 2. Flexible Sorting and Pagination
- Sort by any column
- Configurable page size
- Total count and page information

### 3. Multiple Export Formats
- Excel with multiple sheets
- CSV for data analysis
- JSON with metadata for integration

### 4. Real-time Totals
- Separate totals for in-use and scrap assets
- Overall totals across all assets
- Current value, original cost, and depreciation totals

### 5. Depreciation Integration
- Current book value calculation
- Accumulated depreciation tracking
- Depreciation method information
- Useful life tracking

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- **200**: Success
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (missing or invalid token)
- **500**: Internal Server Error

Error response format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Usage Examples

### Get all in-use assets
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/asset-valuation?assetStatus=In-Use"
```

### Get assets with value > 50000
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/asset-valuation?currentValueMin=50000"
```

### Export IT equipment to Excel
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/asset-valuation/export/excel?category[]=IT Equipment" \
  -o "it_equipment_valuation.xlsx"
```

### Get assets by date range
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/asset-valuation?acquisitionDateFrom=2023-01-01&acquisitionDateTo=2023-12-31"
```

## Integration Notes

1. **Frontend Integration**: The API is designed to work seamlessly with the existing report framework
2. **Authentication**: Uses the same JWT-based authentication as other APIs
3. **Organization Context**: Automatically filters by user's organization
4. **Performance**: Optimized queries with proper indexing on frequently filtered columns
5. **Data Consistency**: Uses database transactions for data integrity

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data updates
2. **Advanced Analytics**: Additional statistical calculations and trends
3. **Custom Reports**: User-defined report templates
4. **Scheduled Exports**: Automated report generation and delivery
5. **Data Visualization**: Chart and graph data endpoints
