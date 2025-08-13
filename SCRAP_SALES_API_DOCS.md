# Scrap Sales API Documentation

This API provides endpoints to manage scrap sales, allowing users to create sales records for selected scrap assets and store them in both `tblScrapSales_H` (header) and `tblScrapSales_D` (details) tables.

## Base URL
```
/api/scrap-sales
```

## Endpoints

### 1. Create Scrap Sale

**Endpoint:** `POST /api/scrap-sales`

**Description:** Creates a new scrap sale with header information and multiple scrap asset details.

**Authentication:** Required

**Request Body:**
```json
{
  "text": "Bulk Laptop Sale to Tech Recyclers",
  "total_sale_value": 2500.00,
  "buyer_name": "John Smith",
  "buyer_company": "Tech Recyclers Inc.",
  "buyer_phone": "+1-555-0123",
  "sale_date": "2024-01-15",
  "collection_date": "2024-01-20",
  "invoice_no": "INV-2024-001",
  "po_no": "PO-2024-001",
  "scrapAssets": [
    {
      "asd_id": "ASD0001",
      "sale_value": 500.00
    },
    {
      "asd_id": "ASD0002",
      "sale_value": 750.00
    },
    {
      "asd_id": "ASD0003",
      "sale_value": 1250.00
    }
  ]
}
```

**Required Fields:**
- `text`: Sale description/title
- `total_sale_value`: Total sale value (must match sum of individual asset values)
- `buyer_name`: Name of the buyer
- `scrapAssets`: Array of scrap assets with their sale values

**Optional Fields:**
- `buyer_company`: Company name of the buyer
- `buyer_phone`: Phone number of the buyer
- `sale_date`: Date of sale (defaults to current date)
- `collection_date`: Date when assets will be collected
- `invoice_no`: Invoice number
- `po_no`: Purchase order number

**Response:**
```json
{
  "success": true,
  "message": "Scrap sale created successfully",
  "scrap_sale": {
    "ssh_id": "SSH0001",
    "header": {
      "ssh_id": "SSH0001",
      "org_id": "ORG001",
      "text": "Bulk Laptop Sale to Tech Recyclers",
      "total_sale_value": 2500.00,
      "buyer_name": "John Smith",
      "buyer_company": "Tech Recyclers Inc.",
      "buyer_phone": "+1-555-0123",
      "created_by": "user123",
      "created_on": "2024-01-15",
      "sale_date": "2024-01-15",
      "collection_date": "2024-01-20",
      "invoice_no": "INV-2024-001",
      "po_no": "PO-2024-001"
    },
    "details": [
      {
        "ssd_id": "SSD0001",
        "ssh_id": "SSH0001",
        "asd_id": "ASD0001",
        "sale_value": 500.00
      },
      {
        "ssd_id": "SSD0002",
        "ssh_id": "SSH0001",
        "asd_id": "ASD0002",
        "sale_value": 750.00
      },
      {
        "ssd_id": "SSD0003",
        "ssh_id": "SSH0001",
        "asd_id": "ASD0003",
        "sale_value": 1250.00
      }
    ],
    "total_assets": 3
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing required fields, validation errors
- `401 Unauthorized`: Authentication required
- `500 Internal Server Error`: Server error

### 2. Get All Scrap Sales

**Endpoint:** `GET /api/scrap-sales`

**Description:** Retrieves all scrap sales with summary information.

**Authentication:** Not required (public)

**Response:**
```json
{
  "success": true,
  "message": "Found 5 scrap sales",
  "count": 5,
  "scrap_sales": [
    {
      "ssh_id": "SSH0001",
      "org_id": "ORG001",
      "text": "Bulk Laptop Sale to Tech Recyclers",
      "total_sale_value": 2500.00,
      "buyer_name": "John Smith",
      "buyer_company": "Tech Recyclers Inc.",
      "buyer_phone": "+1-555-0123",
      "created_by": "user123",
      "created_on": "2024-01-15",
      "sale_date": "2024-01-15",
      "collection_date": "2024-01-20",
      "invoice_no": "INV-2024-001",
      "po_no": "PO-2024-001",
      "total_assets": 3
    }
  ]
}
```

### 3. Get Scrap Sale by ID

**Endpoint:** `GET /api/scrap-sales/:id`

**Description:** Retrieves a specific scrap sale with full details including asset information.

**Authentication:** Not required (public)

**Parameters:**
- `id` (path parameter): The SSH ID of the scrap sale

**Response:**
```json
{
  "success": true,
  "message": "Scrap sale retrieved successfully",
  "scrap_sale": {
    "header": {
      "ssh_id": "SSH0001",
      "org_id": "ORG001",
      "text": "Bulk Laptop Sale to Tech Recyclers",
      "total_sale_value": 2500.00,
      "buyer_name": "John Smith",
      "buyer_company": "Tech Recyclers Inc.",
      "buyer_phone": "+1-555-0123",
      "created_by": "user123",
      "created_on": "2024-01-15",
      "sale_date": "2024-01-15",
      "collection_date": "2024-01-20",
      "invoice_no": "INV-2024-001",
      "po_no": "PO-2024-001"
    },
    "details": [
      {
        "ssd_id": "SSD0001",
        "ssh_id": "SSH0001",
        "asd_id": "ASD0001",
        "sale_value": 500.00,
        "asset_id": "A001",
        "asset_name": "Dell XPS 13",
        "serial_number": "DLXPS001",
        "asset_type_name": "Laptop"
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found`: Scrap sale not found
- `500 Internal Server Error`: Server error

### 4. Validate Scrap Assets

**Endpoint:** `POST /api/scrap-sales/validate-assets`

**Description:** Validates scrap assets before creating a sale to check if they exist and are available for sale.

**Authentication:** Not required (public)

**Request Body:**
```json
{
  "asdIds": ["ASD0001", "ASD0002", "ASD0003"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Asset validation completed",
  "validation": {
    "total_requested": 3,
    "valid_assets": 2,
    "already_sold": 1,
    "invalid_assets": 0,
    "valid_assets_list": [
      {
        "asd_id": "ASD0001",
        "asset_id": "A001",
        "asset_name": "Dell XPS 13",
        "serial_number": "DLXPS001",
        "already_sold": false
      },
      {
        "asd_id": "ASD0002",
        "asset_id": "A002",
        "asset_name": "HP Pavilion",
        "serial_number": "HPPAV001",
        "already_sold": false
      }
    ],
    "already_sold_list": [
      {
        "asd_id": "ASD0003",
        "asset_id": "A003",
        "asset_name": "Lenovo ThinkPad",
        "serial_number": "LNVTP001",
        "already_sold": true
      }
    ],
    "invalid_assets_list": []
  }
}
```

## Database Tables

### tblScrapSales_H (Header Table)
- `ssh_id`: Primary key (SSH0001, SSH0002, etc.)
- `org_id`: Organization ID
- `text`: Sale description
- `total_sale_value`: Total sale value
- `buyer_name`: Buyer's name
- `buyer_company`: Buyer's company
- `buyer_phone`: Buyer's phone number
- `created_by`: User who created the sale
- `created_on`: Creation date
- `changed_by`: User who last modified
- `changed_on`: Last modification date
- `sale_date`: Date of sale
- `collection_date`: Date when assets will be collected
- `invoice_no`: Invoice number
- `po_no`: Purchase order number

### tblScrapSales_D (Details Table)
- `ssd_id`: Primary key (SSD0001, SSD0002, etc.)
- `ssh_id`: Foreign key to header table
- `asd_id`: Foreign key to scrap asset details
- `sale_value`: Individual asset sale value

## Business Logic

### Validation Rules
1. **Required Fields**: All mandatory fields must be provided
2. **Asset Existence**: All scrap assets must exist in `tblAssetScrapDet`
3. **Asset Availability**: Assets must not already be sold (not in `tblScrapSales_D`)
4. **Value Consistency**: Total sale value must match sum of individual asset values
5. **Transaction Integrity**: Uses database transactions to ensure data consistency

### ID Generation
- **SSH ID**: Generated as SSH0001, SSH0002, etc. (Scrap Sales Header)
- **SSD ID**: Generated as SSD0001, SSD0002, etc. (Scrap Sales Detail)
- Uses direct database queries to find the next available sequence number
- No dependency on ID sequences table

### Error Handling
- Comprehensive validation with detailed error messages
- Transaction rollback on errors
- Proper HTTP status codes
- Detailed error responses for debugging

## Usage Examples

### Create a scrap sale:
```bash
curl -X POST "http://localhost:3000/api/scrap-sales" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Bulk Laptop Sale",
    "total_sale_value": 2500.00,
    "buyer_name": "John Smith",
    "buyer_company": "Tech Recyclers Inc.",
    "scrapAssets": [
      {"asd_id": "ASD0001", "sale_value": 500.00},
      {"asd_id": "ASD0002", "sale_value": 750.00},
      {"asd_id": "ASD0003", "sale_value": 1250.00}
    ]
  }'
```

### Get all scrap sales:
```bash
curl -X GET "http://localhost:3000/api/scrap-sales"
```

### Get specific scrap sale:
```bash
curl -X GET "http://localhost:3000/api/scrap-sales/SSH0001"
```

### Validate assets before sale:
```bash
curl -X POST "http://localhost:3000/api/scrap-sales/validate-assets" \
  -H "Content-Type: application/json" \
  -d '{"asdIds": ["ASD0001", "ASD0002", "ASD0003"]}'
```

## Notes

- **Authentication**: Create endpoint requires authentication, others are public for testing
- **Transactions**: Uses database transactions to ensure data consistency
- **Validation**: Comprehensive validation prevents data integrity issues
- **Error Handling**: Detailed error messages help with debugging
- **ID Generation**: Automatic ID generation with fallback mechanisms
