# Asset API Documentation

## Overview
This API provides endpoints for managing assets within the organization.

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Add New Asset
- **POST** `/api/assets`
- **Description**: Creates a new asset record
- **Body**:
  ```json
  {
    "asset_type_id": "string",
    "ext_id": "string",
    "asset_id": "string (optional)",
    "text": "string",
    "serial_number": "string",
    "description": "string",
    "branch_id": "string",
    "vendor_id": "string",
    "prod_serve_id": "string",
    "maintsch_id": "string",
    "purchased_cost": "number",
    "purchased_on": "date",
    "purchased_by": "string",
    "expiry_date": "date",
    "current_status": "string",
    "warranty_period": "number",
    "parent_asset_id": "string",
    "group_id": "string",
    "org_id": "string",
    "properties": {
      "property_id": "value"
    }
  }
  ```

### 2. Get All Assets
- **GET** `/api/assets/all-assets`
- **Description**: Retrieves all assets

### 3. Get Assets with Filters
- **GET** `/api/assets`
- **Description**: Retrieves assets with optional query parameters
- **Query Parameters**:
  - `asset_type_id`: Filter by asset type
  - `branch_id`: Filter by branch
  - `vendor_id`: Filter by vendor
  - `status`: Filter by status
  - `org_id`: Filter by organization
  - `search`: Search term for asset name, serial number, description, or asset ID

### 4. Get Asset by ID
- **GET** `/api/assets/:id`
- **Description**: Retrieves a specific asset by its ID

### 5. Get Asset with Details
- **GET** `/api/assets/details/:id`
- **Description**: Retrieves asset with detailed information including asset type, branch, vendor, and product/service names

### 6. Get Assets by Asset Type
- **GET** `/api/assets/type/:asset_type_id`
- **Description**: Retrieves all assets for a specific asset type

### 7. Get Inactive Assets by Asset Type
- **GET** `/api/assets/type/:asset_type_id/inactive`
- **Description**: Retrieves inactive assets for a specific asset type
- **Logic**: Assets are considered inactive if they don't have an active assignment in the AssetAssignment table
- **Active Assignment Criteria**: `action = "A"` AND `latest_assignment_flag = true`
- **Response**: Object containing message, count, asset type ID, and array of inactive assets
- **Example Response**:
  ```json
  {
    "message": "Inactive Assets : 3",
    "count": 3,
    "asset_type_id": "AT001",
    "data": [
      {
        "asset_id": "AST001",
        "asset_type_id": "AT001",
        "ext_id": "EXT001",
        "text": "Laptop Dell XPS",
        "serial_number": "SN123456",
        "description": "High-performance laptop",
        "branch_id": "BR001",
        "vendor_id": "V001",
        "prod_serve_id": "PS001",
        "maintsch_id": "M001",
        "purchased_cost": 1500.00,
        "purchased_on": "2024-01-15",
        "purchased_by": "USER001",
        "expiry_date": "2027-01-15",
        "current_status": "Active",
        "warranty_period": 36,
        "parent_asset_id": null,
        "group_id": "G001",
        "org_id": "ORG001",
        "created_by": "USER001",
        "created_on": "2024-01-15T10:30:00Z",
        "changed_by": "USER001",
        "changed_on": "2024-01-15T10:30:00Z"
      }
    ]
  }
  ```
- **Example Response (No Inactive Assets)**:
  ```json
  {
    "message": "No inactive assets found for this asset type",
    "count": 0,
    "asset_type_id": "AT001",
    "data": []
  }
  ```

### 8. Get Assets by Branch
- **GET** `/api/assets/branch/:branch_id`
- **Description**: Retrieves all assets for a specific branch

### 9. Get Assets by Vendor
- **GET** `/api/assets/vendor/:vendor_id`
- **Description**: Retrieves all assets for a specific vendor

### 10. Get Assets by Status
- **GET** `/api/assets/status/:status`
- **Description**: Retrieves all assets with a specific status

### 11. Get Assets by Serial Number
- **GET** `/api/assets/serial/:serial_number`
- **Description**: Retrieves assets by serial number

### 12. Delete Single Asset
- **DELETE** `/api/assets/:id`
- **Description**: Deletes a specific asset

### 13. Delete Multiple Assets
- **DELETE** `/api/assets`
- **Description**: Deletes multiple assets
- **Body**:
  ```json
  {
    "asset_ids": ["id1", "id2", "id3"]
  }
  ```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Required fields are missing"
}
```

### 401 Unauthorized
```json
{
  "error": "Not authorized, no token"
}
```

### 404 Not Found
```json
{
  "error": "Asset not found"
}
```

### 409 Conflict
```json
{
  "error": "Asset with this asset_id already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Data Models

### Asset
```json
{
  "asset_id": "string",
  "asset_type_id": "string",
  "ext_id": "string",
  "text": "string",
  "serial_number": "string",
  "description": "string",
  "branch_id": "string",
  "vendor_id": "string",
  "prod_serve_id": "string",
  "maintsch_id": "string",
  "purchased_cost": "number",
  "purchased_on": "date",
  "purchased_by": "string",
  "expiry_date": "date",
  "current_status": "string",
  "warranty_period": "number",
  "parent_asset_id": "string",
  "group_id": "string",
  "org_id": "string",
  "created_by": "string",
  "created_on": "timestamp",
  "changed_by": "string",
  "changed_on": "timestamp"
}
```

## Notes
- Asset IDs are auto-generated if not provided
- Asset status determines the current state of the asset
- Asset assignments are tracked separately in the AssetAssignment table
- Inactive assets are determined by checking the AssetAssignment table for active assignments
- All timestamps are in ISO 8601 format
- Asset type IDs should match existing asset type records in the system 