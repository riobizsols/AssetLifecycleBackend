# Maintenance Schedule API Documentation

## Overview

The Maintenance Schedule API provides endpoints for generating and managing maintenance schedules for assets. The system supports both workflow-based and direct maintenance scheduling based on asset type configuration.

## New Workflow Bypass Feature

### Overview

The system now supports automatic workflow bypass for asset types that don't require approval workflows. When an asset type has no records in the `tblWFATSeqs` table, the system will automatically create direct maintenance schedules in `tblAssetMaintSch` instead of going through the workflow tables.

### Workflow Logic

1. **Check Asset Type Workflow Requirement**: The system checks if the asset type has any records in `tblWFATSeqs`
2. **Workflow Required**: If records exist, create workflow schedules in `tblWFAssetMaintSch_H` and `tblWFAssetMaintSch_D`
3. **No Workflow Required**: If no records exist, create direct maintenance schedules in `tblAssetMaintSch` with status 'IN'

## API Endpoints

### 1. Generate Maintenance Schedules with Workflow Bypass

**Endpoint:** `POST /api/maintenance-schedules/generate-with-bypass`

**Description:** Generates maintenance schedules with automatic workflow bypass logic.

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "test_date": "2024-01-15" // Optional: Use specific date for testing
}
```

**Response:**
```json
{
  "message": "Maintenance schedules generated successfully with workflow bypass logic",
  "asset_types_processed": 3,
  "assets_processed": 25,
  "assets_skipped": 5,
  "total_schedules_created": 20,
  "workflow_schedules_created": 15,
  "direct_schedules_created": 5,
  "test_date_used": "2024-01-15T00:00:00.000Z"
}
```

### 2. Generate Maintenance Schedules with Workflow Bypass (Cron)

**Endpoint:** `POST /api/maintenance-schedules/generate-cron-with-bypass`

**Description:** Same as above but without authentication for cron job usage.

**Authentication:** Not Required

**Request Body:** Same as above

**Response:** Same as above

## Workflow Bypass Logic

### Step-by-Step Process

1. **Get Asset Types**: Retrieve all asset types that require maintenance (`maint_required = true`)

2. **Check Workflow Requirement**: For each asset type, check if records exist in `tblWFATSeqs`
   ```sql
   SELECT COUNT(*) as workflow_count
   FROM "tblWFATSeqs"
   WHERE asset_type_id = $1
   ```

3. **Process Assets**: For each asset of the asset type:
   - Check existing maintenance schedules
   - Calculate next maintenance date based on frequency
   - Determine if maintenance is due

4. **Create Schedules**:
   - **If workflow required**: Create records in `tblWFAssetMaintSch_H` and `tblWFAssetMaintSch_D`
   - **If no workflow required**: Create direct record in `tblAssetMaintSch` with status 'IN'

### Database Tables Involved

#### Workflow Tables (when workflow is required)
- `tblWFATSeqs` - Workflow asset sequences
- `tblWFAssetMaintSch_H` - Workflow maintenance schedule headers
- `tblWFAssetMaintSch_D` - Workflow maintenance schedule details

#### Direct Maintenance Table (when workflow is bypassed)
- `tblAssetMaintSch` - Direct asset maintenance schedules

### Status Codes

| Status | Description | Table |
|--------|-------------|-------|
| `IN` | In Progress | Both tblAssetMaintSch and tblWFAssetMaintSch_H |
| `IP` | In Process | tblWFAssetMaintSch_H only |
| `CO` | Completed | Both tables |
| `CA` | Cancelled | Both tables |

## Usage Examples

### Using cURL

**Generate schedules with workflow bypass:**
```bash
curl -X POST http://localhost:4000/api/maintenance-schedules/generate-with-bypass \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"test_date": "2024-01-15"}'
```

**Generate schedules with workflow bypass (cron):**
```bash
curl -X POST http://localhost:4000/api/maintenance-schedules/generate-cron-with-bypass \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using JavaScript/Fetch

**Generate schedules with workflow bypass:**
```javascript
const response = await fetch('/api/maintenance-schedules/generate-with-bypass', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    test_date: '2024-01-15'
  })
});

const result = await response.json();
console.log('Schedules created:', result.total_schedules_created);
console.log('Workflow schedules:', result.workflow_schedules_created);
console.log('Direct schedules:', result.direct_schedules_created);
```

## Configuration

### Asset Type Workflow Configuration

To configure an asset type to bypass workflow:

1. **Remove workflow sequences**: Delete all records from `tblWFATSeqs` for the asset type
2. **Keep maintenance settings**: Ensure `maint_required = true` in `tblAssetTypes`
3. **Set maintenance frequency**: Configure frequency in `tblATMaintFreq`

### Example SQL

**Check if asset type has workflow:**
```sql
SELECT COUNT(*) as has_workflow
FROM "tblWFATSeqs"
WHERE asset_type_id = 'AT-001';
```

**Remove workflow for asset type:**
```sql
DELETE FROM "tblWFATSeqs"
WHERE asset_type_id = 'AT-001';
```

## Error Handling

The API returns appropriate error responses:

```json
{
  "error": "Failed to generate maintenance schedules with workflow bypass",
  "details": "Specific error message"
}
```

Common error scenarios:
- Database connection issues
- Invalid asset type configurations
- Missing maintenance frequency settings
- Permission issues

## Monitoring and Logging

The API provides detailed logging for monitoring:

- Asset types processed
- Workflow vs direct schedule creation
- Assets skipped and reasons
- Schedule creation counts
- Error details

## Integration with Existing System

The new workflow bypass functionality integrates seamlessly with existing features:

- **Maintenance Approval**: Workflow schedules still go through approval process
- **Direct Maintenance**: Bypassed schedules appear in maintenance management
- **Notifications**: Both types trigger appropriate notifications
- **Reporting**: Unified reporting for all maintenance schedules

---

## Original API Endpoints (Still Available)

### Generate Maintenance Schedules

**Endpoint:** `POST /api/maintenance-schedules/generate`

**Description:** Generates maintenance schedules using the original workflow-only logic.

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "test_date": "2024-01-15" // Optional: Use specific date for testing
}
```

**Response:**
```json
{
  "message": "Maintenance schedules generated successfully",
  "asset_types_processed": 3,
  "assets_processed": 25,
  "assets_skipped": 5,
  "schedules_created": 20,
  "test_date_used": "2024-01-15T00:00:00.000Z"
}
```

### Get All Maintenance Schedules

**Endpoint:** `GET /api/maintenance-schedules/all`

**Description:** Retrieves all maintenance schedules from `tblAssetMaintSch`.

**Authentication:** Required (JWT Token)

**Query Parameters:**
- `orgId` (optional): Organization ID (default: 'ORG001')

**Response:**
```json
{
  "success": true,
  "message": "Maintenance schedules retrieved successfully",
  "data": [
    {
      "ams_id": "ams001",
      "asset_id": "ASSET001",
      "status": "IN",
      "act_maint_st_date": "2024-01-20",
      "asset_type_name": "Laptop",
      "maintenance_type_name": "Preventive",
      "vendor_name": "Tech Vendor",
      "days_until_due": 5
    }
  ],
  "count": 1,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Get Maintenance Schedules for Asset

**Endpoint:** `GET /api/maintenance-schedules/asset/:asset_id`

**Description:** Retrieves maintenance schedules for a specific asset.

**Authentication:** Required (JWT Token)

**Response:**
```json
{
  "asset_id": "ASSET001",
  "workflow_schedules": [
    {
      "wfamsh_id": "WFAMSH_01",
      "status": "IN",
      "pl_sch_date": "2024-01-20"
    }
  ],
  "maintenance_schedules": [
    {
      "ams_id": "ams001",
      "status": "IN",
      "act_maint_st_date": "2024-01-20"
    }
  ]
}
```

### Update Maintenance Schedule

**Endpoint:** `PUT /api/maintenance-schedules/:id`

**Description:** Updates a maintenance schedule in `tblAssetMaintSch`.

**Authentication:** Required (JWT Token)

**Request Body:**
```json
{
  "status": "CO",
  "notes": "Maintenance completed successfully",
  "po_number": "PO-2024-001",
  "invoice": "INV-2024-001",
  "technician_name": "John Doe",
  "technician_email": "john@example.com",
  "technician_phno": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Maintenance schedule updated successfully",
  "data": {
    "ams_id": "ams001",
    "status": "CO",
    "act_main_end_date": "2024-01-15"
  }
}
```

### Get Asset Types Requiring Maintenance

**Endpoint:** `GET /api/maintenance-schedules/asset-types`

**Description:** Retrieves all asset types that require maintenance.

**Authentication:** Required (JWT Token)

**Response:**
```json
[
  {
    "asset_type_id": "AT-001",
    "text": "Laptop",
    "maint_required": true
  }
]
```

### Get Maintenance Frequency for Asset Type

**Endpoint:** `GET /api/maintenance-schedules/frequency/:asset_type_id`

**Description:** Retrieves maintenance frequency settings for an asset type.

**Authentication:** Required (JWT Token)

**Response:**
```json
[
  {
    "at_main_freq_id": "ATMF001",
    "asset_type_id": "AT-001",
    "maint_type_id": "MT001",
    "frequency": 30,
    "uom": "days"
  }
]
```

### Get Maintenance Schedule by ID

**Endpoint:** `GET /api/maintenance-schedules/:id`

**Description:** Retrieves details of a specific maintenance schedule.

**Authentication:** Required (JWT Token)

**Query Parameters:**
- `orgId` (optional): Organization ID (default: 'ORG001')

**Response:**
```json
{
  "success": true,
  "message": "Maintenance schedule details retrieved successfully",
  "data": {
    "ams_id": "ams001",
    "asset_id": "ASSET001",
    "status": "IN",
    "act_maint_st_date": "2024-01-20",
    "asset_type_name": "Laptop"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Database Schema

### tblAssetMaintSch (Direct Maintenance Schedules)

| Column | Type | Description |
|--------|------|-------------|
| ams_id | VARCHAR | Primary key |
| wfamsh_id | VARCHAR | Workflow header ID (NULL for direct schedules) |
| asset_id | VARCHAR | Asset ID |
| maint_type_id | VARCHAR | Maintenance type ID |
| vendor_id | VARCHAR | Vendor ID |
| at_main_freq_id | VARCHAR | Asset type maintenance frequency ID |
| maintained_by | VARCHAR | User who performed the maintenance |
| notes | TEXT | Notes |
| status | VARCHAR | Status (IN, CO, CA) |
| act_maint_st_date | DATE | Actual maintenance start date |
| act_main_end_date | DATE | Actual maintenance end date |
| po_number | VARCHAR | Purchase order number |
| invoice | VARCHAR | Invoice number |
| technician_name | VARCHAR | Technician name |
| technician_email | VARCHAR | Technician email |
| technician_phno | VARCHAR | Technician phone |
| created_by | VARCHAR | Created by user |
| created_on | TIMESTAMP | Creation timestamp |
| changed_by | VARCHAR | Changed by user |
| changed_on | TIMESTAMP | Change timestamp |
| org_id | VARCHAR | Organization ID |

### tblWFAssetMaintSch_H (Workflow Maintenance Headers)

| Column | Type | Description |
|--------|------|-------------|
| wfamsh_id | VARCHAR | Primary key |
| at_main_freq_id | VARCHAR | Asset type maintenance frequency ID |
| maint_type_id | VARCHAR | Maintenance type ID |
| asset_id | VARCHAR | Asset ID |
| group_id | VARCHAR | Group ID |
| vendor_id | VARCHAR | Vendor ID |
| pl_sch_date | DATE | Planned schedule date |
| act_sch_date | DATE | Actual schedule date |
| status | VARCHAR | Status (IN, IP, CO, CA) |
| created_by | VARCHAR | Created by user |
| created_on | TIMESTAMP | Creation timestamp |
| changed_by | VARCHAR | Changed by user |
| changed_on | TIMESTAMP | Change timestamp |
| org_id | VARCHAR | Organization ID |

### tblWFAssetMaintSch_D (Workflow Maintenance Details)

| Column | Type | Description |
|--------|------|-------------|
| wfamsd_id | VARCHAR | Primary key |
| wfamsh_id | VARCHAR | Workflow header ID |
| job_role_id | VARCHAR | Job role ID |
| user_id | VARCHAR | User ID |
| dept_id | VARCHAR | Department ID |
| sequence | INTEGER | Sequence number |
| status | VARCHAR | Status (IN, IP, UA, UR, AP) |
| notes | TEXT | Notes |
| created_by | VARCHAR | Created by user |
| created_on | TIMESTAMP | Creation timestamp |
| changed_by | VARCHAR | Changed by user |
| changed_on | TIMESTAMP | Change timestamp |
| org_id | VARCHAR | Organization ID |

## Status Flow

### Workflow Schedules
1. **IN** (Initial) → **IP** (In Process) → **CO** (Completed) / **CA** (Cancelled)

### Direct Schedules
1. **IN** (Initial) → **CO** (Completed) / **CA** (Cancelled)

## Frequency Units

| Unit | Description |
|------|-------------|
| days | Number of days |
| weeks | Number of weeks |
| months | Number of months |
| years | Number of years |

## Date Calculation Examples

```javascript
// 30 days frequency
const baseDate = new Date('2024-01-01');
const frequency = 30;
const uom = 'days';
const nextDate = new Date(baseDate);
nextDate.setDate(nextDate.getDate() + frequency);
// Result: 2024-01-31

// 6 months frequency
const baseDate = new Date('2024-01-01');
const frequency = 6;
const uom = 'months';
const nextDate = new Date(baseDate);
nextDate.setMonth(nextDate.getMonth() + frequency);
// Result: 2024-07-01
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 404 | Not Found - Asset or schedule not found |
| 500 | Internal Server Error - Database or system error |

## Best Practices

1. **Use appropriate endpoint**: Use workflow bypass endpoints for asset types without workflow requirements
2. **Monitor logs**: Check console logs for detailed processing information
3. **Handle errors**: Implement proper error handling for API responses
4. **Test with specific dates**: Use test_date parameter for testing specific scenarios
5. **Regular maintenance**: Run schedule generation regularly via cron jobs

## Troubleshooting

### Common Issues

1. **No schedules created**: Check if asset types have `maint_required = true`
2. **Missing workflow sequences**: Ensure `tblWFATSeqs` has records for workflow-required asset types
3. **Date calculation issues**: Verify frequency and UOM settings in `tblATMaintFreq`
4. **Permission errors**: Check JWT token validity and user permissions

### Debug Information

The API provides detailed console logging:
- Asset processing steps
- Workflow requirement checks
- Schedule creation details
- Error information

### Support

For issues or questions:
1. Check console logs for detailed error information
2. Verify database table structures and data
3. Test with specific dates using test_date parameter
4. Review asset type and frequency configurations 