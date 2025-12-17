# Vendor Contract Renewal Tracking Feature

## Overview

This feature implements automatic tracking of vendor contract renewals when maintenance type MT005 (Vendor Contract Renewal) workflows are approved. When a vendor contract renewal workflow is approved and receives status "CO" (Completed), the system automatically creates a record in the `tblVendorRenewal` table.

## Components

### 1. Database Table: `tblVendorRenewal`

**Table Structure:**
```sql
- vr_id (VARCHAR(50)) - Primary key, format: VR001, VR002, etc.
- wfamsh_id (VARCHAR(50)) - Workflow maintenance schedule header ID
- vendor_id (VARCHAR(50)) - Foreign key to tblVendors
- vendor_name (VARCHAR(255)) - Vendor name for quick reference
- contract_start_date (DATE) - New contract start date
- contract_end_date (DATE) - New contract end date
- previous_contract_end_date (DATE) - Previous contract end date before renewal
- renewal_date (TIMESTAMP) - Date when renewal was completed
- renewal_approved_by (VARCHAR(50)) - User who approved the renewal
- renewal_notes (TEXT) - Notes about the renewal
- status (VARCHAR(10)) - Status of the renewal (default: 'CO')
- org_id (VARCHAR(50)) - Organization ID
- branch_code (VARCHAR(50)) - Branch code
- created_by (VARCHAR(50)) - Creator user ID
- created_on (TIMESTAMP) - Creation timestamp
- changed_by (VARCHAR(50)) - Last modified by
- changed_on (TIMESTAMP) - Last modified timestamp
```

**Indexes:**
- idx_vendor_renewal_vendor_id
- idx_vendor_renewal_wfamsh_id
- idx_vendor_renewal_org_id
- idx_vendor_renewal_renewal_date

### 2. Model: `vendorRenewalModel.js`

**Functions:**
- `createVendorRenewalTable()` - Creates the table with all necessary fields and indexes
- `getNextVRId()` - Generates the next sequential vendor renewal ID
- `insertVendorRenewal(renewalData)` - Inserts a new vendor renewal record
- `getAllVendorRenewals(orgId, branchCode, hasSuperAccess)` - Retrieves all vendor renewals
- `getVendorRenewalById(vrId, orgId)` - Retrieves a specific vendor renewal by ID
- `getVendorRenewalsByVendorId(vendorId, orgId)` - Retrieves all renewals for a specific vendor

### 3. Controller: `vendorRenewalController.js`

**Endpoints:**
- `getVendorRenewals` - GET /api/vendor-renewals
- `getVendorRenewal` - GET /api/vendor-renewals/:vrId
- `getVendorRenewalsByVendor` - GET /api/vendor-renewals/vendor/:vendorId
- `initializeVendorRenewalTable` - POST /api/vendor-renewals/initialize

### 4. Routes: `vendorRenewalRoutes.js`

All API routes are prefixed with `/api/vendor-renewals`

### 5. Integration: `approvalDetailModel.js`

Modified the approval workflow to automatically create a vendor renewal record when:
- Maintenance type is MT005 (Vendor Contract Renewal)
- All approvers have approved the workflow
- Status is set to "CO" (Completed)

## Installation & Setup

### Step 1: Create the Database Table

Run the migration script to create the `tblVendorRenewal` table:

```bash
cd AssetLifecycleBackend
node migrations/createVendorRenewalTable.js
```

**OR** make a POST request to the API endpoint:

```bash
POST /api/vendor-renewals/initialize
```

### Step 2: Restart the Server

After adding the routes, restart your Node.js server:

```bash
npm run dev
# or
npm start
```

### Step 3: Verify Installation

Check that the table was created successfully:

```sql
SELECT * FROM "tblVendorRenewal";
```

## Usage

### Automatic Creation

When a vendor contract renewal workflow (MT005) is approved:

1. The system checks if all approvers have approved the workflow
2. Updates the workflow header status to "CO"
3. Automatically creates a vendor renewal record in `tblVendorRenewal`
4. Populates the record with:
   - Workflow ID (wfamsh_id)
   - Vendor details (vendor_id, vendor_name)
   - Contract dates (start, end, previous end)
   - Approval information (approved_by, notes)
   - Organization and branch information

### API Endpoints

#### 1. Get All Vendor Renewals

```http
GET /api/vendor-renewals
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "vr_id": "VR001",
      "wfamsh_id": "WFAMSH_45",
      "vendor_id": "VEN001",
      "vendor_name": "ABC Maintenance Services",
      "contract_start_date": "2025-01-01",
      "contract_end_date": "2026-01-01",
      "previous_contract_end_date": "2024-12-31",
      "renewal_date": "2024-12-08T10:30:00Z",
      "renewal_approved_by": "SYSTEM",
      "renewal_notes": "Contract renewed for 1 year",
      "status": "CO",
      "org_id": "ORG001",
      "branch_code": "BR001"
    }
  ]
}
```

#### 2. Get Vendor Renewal by ID

```http
GET /api/vendor-renewals/VR001
Authorization: Bearer <token>
```

#### 3. Get Vendor Renewals by Vendor ID

```http
GET /api/vendor-renewals/vendor/VEN001
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [...]
}
```

#### 4. Initialize Table (Admin Only)

```http
POST /api/vendor-renewals/initialize
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Table created successfully"
}
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  Vendor Contract Renewal Workflow (MT005)                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Contract End Date Approaching (Cron Job Detection)         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflow Created with Status 'IN'                          │
│  (tblWFAssetMaintSch_H)                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Approval Process                                            │
│  - Role-based approvals                                      │
│  - Multiple approval steps                                   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  All Approvers Approve                                       │
│  (approvalDetailModel.js)                                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Workflow Status Updated to 'CO'                            │
│  (tblWFAssetMaintSch_H.status = 'CO')                      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Check if Maintenance Type = MT005                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  INSERT into tblVendorRenewal                               │
│  - Generate VR_ID                                            │
│  - Store vendor details                                      │
│  - Store contract dates                                      │
│  - Store approval information                                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Vendor Renewal Record Created ✅                           │
└─────────────────────────────────────────────────────────────┘
```

## Benefits

1. **Audit Trail**: Complete history of all vendor contract renewals
2. **Compliance**: Track when contracts were renewed and by whom
3. **Reporting**: Easy to generate reports on vendor renewals
4. **Reference**: Quick access to previous contract terms and dates
5. **Automation**: No manual entry required - fully automated upon approval

## Database Queries

### Get all renewals for the current year
```sql
SELECT * FROM "tblVendorRenewal" 
WHERE EXTRACT(YEAR FROM renewal_date) = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY renewal_date DESC;
```

### Get renewals by vendor
```sql
SELECT * FROM "tblVendorRenewal" 
WHERE vendor_id = 'VEN001'
ORDER BY renewal_date DESC;
```

### Get renewal statistics by organization
```sql
SELECT 
  org_id,
  COUNT(*) as total_renewals,
  MIN(renewal_date) as first_renewal,
  MAX(renewal_date) as latest_renewal
FROM "tblVendorRenewal"
GROUP BY org_id;
```

## Troubleshooting

### Table doesn't exist
Run the migration script or use the initialize endpoint:
```bash
node migrations/createVendorRenewalTable.js
```

### Records not being created
1. Check that the workflow maintenance type is exactly 'MT005'
2. Verify all approvers have approved the workflow
3. Check server logs for any errors in the approval process
4. Verify the vendor exists in tblVendors

### Permission issues
Ensure the database user has:
- CREATE TABLE permissions (for initialization)
- INSERT, SELECT permissions on tblVendorRenewal
- SELECT permissions on tblVendors and tblWFAssetMaintSch_H

## Future Enhancements

Potential future improvements:
1. Email notifications when renewal is completed
2. Integration with vendor contact for renewal confirmation
3. Automatic contract document attachment
4. Renewal reminder notifications before contract expires
5. Dashboard widget showing upcoming and recent renewals
6. Bulk renewal processing
7. Renewal analytics and reporting module

## Support

For issues or questions about this feature, please contact the development team or refer to the main project documentation.
