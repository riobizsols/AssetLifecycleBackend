# Scrap Sales API Implementation Summary

## Overview
A complete scrap sales management system has been implemented to handle the creation of scrap sales records. The system allows users to select multiple scrap assets and create sales transactions that are stored in both header (`tblScrapSales_H`) and detail (`tblScrapSales_D`) tables.

## Files Created

### 1. Model: `models/scrapSalesModel.js`
**Key Functions:**
- `createScrapSale(saleData)` - Creates complete scrap sale with transaction support
- `createScrapSalesHeader(headerData)` - Creates header record
- `createScrapSalesDetails(ssh_id, scrapAssets)` - Creates detail records
- `getAllScrapSales()` - Retrieves all scrap sales with summary
- `getScrapSaleById(ssh_id)` - Gets specific sale with full details
- `validateScrapAssets(asdIds)` - Validates assets before sale
- `generateSshId()` / `generateSsdId()` - ID generation with fallback

**Features:**
- Database transaction support for data consistency
- Automatic ID generation (SSH0001, SSD0001, etc.)
- Comprehensive validation logic
- Fallback ID generation if sequences table doesn't exist

### 2. Controller: `controllers/scrapSalesController.js`
**Endpoints:**
- `POST /api/scrap-sales` - Create new scrap sale (authenticated)
- `GET /api/scrap-sales` - Get all scrap sales (public)
- `GET /api/scrap-sales/:id` - Get specific scrap sale (public)
- `POST /api/scrap-sales/validate-assets` - Validate assets before sale (public)

**Validation Features:**
- Required field validation
- Asset existence verification
- Already sold asset detection
- Value consistency checking
- Comprehensive error handling

### 3. Routes: `routes/scrapSalesRoutes.js`
- Public routes for testing (GET endpoints, validation)
- Protected routes for data modification (POST create)
- Middleware integration for authentication
- Role-based authorization ready

### 4. Server Integration: `server.js`
- Added route registration: `/api/scrap-sales`
- Integrated with existing server configuration

## API Endpoints

### 1. Create Scrap Sale
```
POST /api/scrap-sales
```
**Purpose:** Creates a new scrap sale with header and detail records
**Authentication:** Required
**Features:** Transaction support, validation, automatic ID generation

### 2. Get All Scrap Sales
```
GET /api/scrap-sales
```
**Purpose:** Retrieves all scrap sales with summary information
**Authentication:** Not required
**Features:** Asset count, buyer information, sale details

### 3. Get Scrap Sale by ID
```
GET /api/scrap-sales/:id
```
**Purpose:** Gets specific scrap sale with full asset details
**Authentication:** Not required
**Features:** Complete asset information, buyer details

### 4. Validate Scrap Assets
```
POST /api/scrap-sales/validate-assets
```
**Purpose:** Validates assets before creating a sale
**Authentication:** Not required
**Features:** Existence check, availability check, detailed reporting

## Database Schema

### tblScrapSales_H (Header Table)
| Field | Type | Description |
|-------|------|-------------|
| ssh_id | VARCHAR | Primary key (SSH0001, SSH0002, etc.) |
| org_id | VARCHAR | Organization ID |
| text | VARCHAR | Sale description |
| total_sale_value | DECIMAL | Total sale value |
| buyer_name | VARCHAR | Buyer's name |
| buyer_company | VARCHAR | Buyer's company |
| buyer_phone | VARCHAR | Buyer's phone |
| created_by | VARCHAR | User who created |
| created_on | DATE | Creation date |
| changed_by | VARCHAR | User who modified |
| changed_on | DATE | Modification date |
| sale_date | DATE | Date of sale |
| collection_date | DATE | Collection date |
| invoice_no | VARCHAR | Invoice number |
| po_no | VARCHAR | Purchase order number |

### tblScrapSales_D (Details Table)
| Field | Type | Description |
|-------|------|-------------|
| ssd_id | VARCHAR | Primary key (SSD0001, SSD0002, etc.) |
| ssh_id | VARCHAR | Foreign key to header |
| asd_id | VARCHAR | Foreign key to scrap asset |
| sale_value | DECIMAL | Individual asset sale value |

## Business Logic

### Validation Rules
1. **Required Fields**: text, total_sale_value, buyer_name, scrapAssets array
2. **Asset Existence**: All scrap assets must exist in tblAssetScrapDet
3. **Asset Availability**: Assets must not already be sold (not in tblScrapSales_D)
4. **Value Consistency**: Total sale value must match sum of individual asset values
5. **Transaction Integrity**: Uses database transactions for consistency

### ID Generation
- **SSH ID**: SSH0001, SSH0002, etc. (Scrap Sales Header)
- **SSD ID**: SSD0001, SSD0002, etc. (Scrap Sales Detail)
- Direct database queries for sequence generation
- No dependency on ID sequences table

### Error Handling
- Comprehensive validation with detailed error messages
- Transaction rollback on errors
- Proper HTTP status codes
- Detailed error responses for debugging

## Testing

### Test Script: `test_scrap_sales_api.js`
**Test Coverage:**
- Server connectivity
- Get all scrap sales
- Validate scrap assets
- Get specific scrap sale
- Create scrap sale (authentication test)
- Invalid data validation
- Value mismatch validation

### Running Tests
```bash
# Start the server
npm start

# Run tests
node test_scrap_sales_api.js
```

## Documentation

### API Documentation: `SCRAP_SALES_API_DOCS.md`
- Complete endpoint documentation
- Request/response examples
- Error handling details
- Usage examples with curl commands
- Database schema details

## Key Features

### 1. Transaction Support
- Database transactions ensure data consistency
- Automatic rollback on errors
- Atomic operations for header and details

### 2. Comprehensive Validation
- Asset existence verification
- Already sold asset detection
- Value consistency checking
- Required field validation

### 3. Flexible ID Generation
- Automatic ID generation with fallback
- Support for ID sequences table
- Manual generation if needed

### 4. Detailed Error Handling
- Specific error messages
- Proper HTTP status codes
- Validation feedback
- Debugging information

### 5. Security Features
- Authentication for data modification
- Public access for read operations
- Role-based authorization ready

## Usage Workflow

### 1. Asset Selection
1. Use scrap assets by type API to get available assets
2. Select single or multiple scrap assets
3. Assign sale values to each asset

### 2. Sale Creation
1. Prepare sale data with header information
2. Include selected assets with their sale values
3. Submit to create scrap sale endpoint
4. System validates and creates records

### 3. Validation Process
1. Check asset existence
2. Verify assets are not already sold
3. Validate value consistency
4. Create transaction records

## Integration Points

### With Existing APIs
- **Scrap Assets by Type API**: Provides available assets for selection
- **Asset Scrap API**: Source of scrap asset data
- **Authentication System**: User management and authorization

### Database Tables
- `tblAssetScrapDet`: Source of scrap assets
- `tblAssets`: Asset information
- `tblAssetTypes`: Asset type information
- `tblScrapSales_H`: Sales header records
- `tblScrapSales_D`: Sales detail records

## Files Modified

1. `server.js` - Added route registration
2. All other files are new additions

## Next Steps

### Immediate
1. Test with actual database data
2. Verify ID generation works correctly
3. Test transaction rollback scenarios

### Future Enhancements
1. Add update/delete functionality
2. Implement pagination for large datasets
3. Add reporting and analytics
4. Create frontend integration
5. Add email notifications
6. Implement approval workflows

### Configuration
1. Add ID sequences to tblIDSequences table:
   - `scrap_sales_h` with prefix `SSH`
   - `scrap_sales_d` with prefix `SSD`
2. Configure authentication middleware
3. Set up role-based permissions

## Notes

- **Current Status**: Ready for testing
- **Authentication**: Create endpoint requires authentication
- **Database**: Assumes tables exist with specified schema
- **ID Generation**: Works with or without sequences table
- **Transactions**: Ensures data consistency
- **Validation**: Comprehensive business rule enforcement
