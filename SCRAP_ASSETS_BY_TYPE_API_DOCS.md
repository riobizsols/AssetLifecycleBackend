# Scrap Assets By Type API Documentation

This API provides endpoints to retrieve scrap assets filtered by asset type, excluding those that are already in the scrap sales table (`tblScrapSales_D`).

## Base URL
```
/api/scrap-assets-by-type
```

## Endpoints

### 1. Get Scrap Assets by Asset Type

**Endpoint:** `GET /api/scrap-assets-by-type/:asset_type_id`

**Description:** Retrieves all scrap assets for a specific asset type, excluding those already in scrap sales.

**Parameters:**
- `asset_type_id` (path parameter, required): The ID of the asset type

**Response:**
```json
{
  "success": true,
  "message": "Found 5 scrap assets for asset type: Laptop",
  "asset_type": {
    "asset_type_id": "LAP001",
    "asset_type_name": "Laptop"
  },
  "count": 5,
  "scrap_assets": [
    {
      "asd_id": "ASD0001",
      "asset_id": "A001",
      "scrapped_date": "2024-01-15",
      "scrapped_by": "user123",
      "location": "Warehouse A",
      "notes": "End of life",
      "org_id": "ORG001",
      "asset_name": "Dell XPS 13",
      "serial_number": "DLXPS001",
      "asset_description": "13-inch laptop",
      "asset_type_name": "Laptop",
      "asset_type_id": "LAP001"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Missing asset_type_id parameter
- `404 Not Found`: Asset type not found
- `500 Internal Server Error`: Server error

### 2. Get Asset Types with Scrap Assets

**Endpoint:** `GET /api/scrap-assets-by-type/asset-types/list`

**Description:** Retrieves all asset types that have scrap assets available (excluding those already in scrap sales).

**Response:**
```json
{
  "success": true,
  "message": "Found 3 asset types with scrap assets",
  "count": 3,
  "asset_types": [
    {
      "asset_type_id": "LAP001",
      "asset_type_name": "Laptop",
      "scrap_count": 5
    },
    {
      "asset_type_id": "DESK001",
      "asset_type_name": "Desktop",
      "scrap_count": 3
    },
    {
      "asset_type_id": "MON001",
      "asset_type_name": "Monitor",
      "scrap_count": 2
    }
  ]
}
```

**Error Responses:**
- `500 Internal Server Error`: Server error

## Database Tables Used

- `tblAssetScrapDet`: Contains scrap asset details
- `tblAssets`: Contains asset information
- `tblAssetTypes`: Contains asset type information
- `tblScrapSales_D`: Contains scrap sales records (used for exclusion)

## Business Logic

1. **Exclusion Logic**: The API excludes scrap assets that are already present in the `tblScrapSales_D` table to prevent duplicate processing.

2. **Joins**: The queries join multiple tables to provide comprehensive asset information including asset names, serial numbers, and asset type details.

3. **Ordering**: Results are ordered by scrap date in descending order (most recent first).

## Usage Examples

### Get scrap assets for laptops:
```bash
curl -X GET "http://localhost:3000/api/scrap-assets-by-type/LAP001"
```

### Get all asset types with scrap assets:
```bash
curl -X GET "http://localhost:3000/api/scrap-assets-by-type/asset-types/list"
```

## Notes

- Both endpoints are currently public for testing purposes
- The API assumes that `tblScrapSales_D` has an `asd_id` field that references scrap assets
- If the table structure is different, the exclusion logic in the model may need to be adjusted
