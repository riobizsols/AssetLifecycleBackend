# Maintenance Required Asset Types API Documentation

## Overview
This API endpoint allows you to retrieve all asset types where maintenance is required (`maint_required = true`). This is useful for filtering asset types that need regular maintenance scheduling.

## Endpoint

### Get Asset Types with Maintenance Required

**GET** `/api/asset-types/maint-required`

Retrieves all asset types where the `maint_required` field is set to `1` (true) and the asset type is active (`int_status = 1`).

#### Authentication
- **Required**: Yes
- **Type**: Bearer Token
- **Header**: `Authorization: Bearer <token>`

#### Request
No request body or parameters required.

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Asset types with maintenance required retrieved successfully",
  "data": [
    {
      "org_id": "ORG001",
      "asset_type_id": "AT001",
      "int_status": 1,
      "maint_required": 1,
      "assignment_type": "user",
      "inspection_required": true,
      "group_required": false,
      "created_by": "USR001",
      "created_on": "2024-01-01T10:00:00.000Z",
      "changed_by": "USR001",
      "changed_on": "2024-01-01T10:00:00.000Z",
      "text": "Company Vehicles",
      "is_child": false,
      "parent_asset_type_id": null,
      "maint_type_id": "MT001",
      "maint_lead_type": "monthly",
      "depreciation_type": "SLM"
    },
    {
      "org_id": "ORG001",
      "asset_type_id": "AT002",
      "int_status": 1,
      "maint_required": 1,
      "assignment_type": "department",
      "inspection_required": true,
      "group_required": true,
      "created_by": "USR001",
      "created_on": "2024-01-02T10:00:00.000Z",
      "changed_by": "USR001",
      "changed_on": "2024-01-02T10:00:00.000Z",
      "text": "Manufacturing Equipment",
      "is_child": false,
      "parent_asset_type_id": null,
      "maint_type_id": "MT002",
      "maint_lead_type": "weekly",
      "depreciation_type": "WDV"
    }
  ],
  "count": 2,
  "timestamp": "2024-01-15T12:30:45.123Z"
}
```

**Error Response (500 Internal Server Error)**

```json
{
  "success": false,
  "message": "Failed to fetch asset types by maintenance required",
  "error": "Error message details"
}
```

**Error Response (401 Unauthorized)**

```json
{
  "error": "Not authorized, token failed"
}
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | Boolean | Indicates if the request was successful |
| `message` | String | Descriptive message about the operation |
| `data` | Array | List of asset types with maintenance required |
| `count` | Number | Total number of asset types returned |
| `timestamp` | String | ISO timestamp of when the response was generated |

### Asset Type Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `org_id` | String | Organization identifier |
| `asset_type_id` | String | Unique asset type identifier |
| `int_status` | Number | Status (1 = Active, 0 = Inactive) |
| `maint_required` | Number | Maintenance required flag (1 = Yes, 0 = No) |
| `assignment_type` | String | How assets are assigned (e.g., "user", "department") |
| `inspection_required` | Boolean | Whether inspection is required |
| `group_required` | Boolean | Whether asset group is required |
| `created_by` | String | User ID who created the record |
| `created_on` | String | ISO timestamp of creation |
| `changed_by` | String | User ID who last modified the record |
| `changed_on` | String | ISO timestamp of last modification |
| `text` | String | Asset type name/description |
| `is_child` | Boolean | Whether this is a child asset type |
| `parent_asset_type_id` | String/Null | Parent asset type ID if is_child is true |
| `maint_type_id` | String/Null | Maintenance type identifier |
| `maint_lead_type` | String/Null | Maintenance lead time type (e.g., "monthly", "weekly") |
| `depreciation_type` | String | Depreciation method (e.g., "SLM", "WDV", "ND") |

## Example Usage

### cURL

```bash
curl -X GET http://localhost:5000/api/asset-types/maint-required \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### JavaScript (Axios)

```javascript
const axios = require('axios');

async function getMaintRequiredAssetTypes(token) {
  try {
    const response = await axios.get(
      'http://localhost:5000/api/asset-types/maint-required',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Asset Types:', response.data.data);
    console.log('Total Count:', response.data.count);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}
```

### JavaScript (Fetch)

```javascript
async function getMaintRequiredAssetTypes(token) {
  try {
    const response = await fetch(
      'http://localhost:5000/api/asset-types/maint-required',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch asset types');
    }
    
    console.log('Asset Types:', data.data);
    console.log('Total Count:', data.count);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}
```

## Use Cases

1. **Maintenance Dashboard**: Display all asset types that require maintenance scheduling
2. **Maintenance Planning**: Filter assets that need regular maintenance for resource planning
3. **Compliance Reporting**: Generate reports on assets requiring maintenance
4. **Preventive Maintenance**: Identify asset types for preventive maintenance programs
5. **Mobile App Filtering**: Show only maintenance-required assets in mobile maintenance apps

## Notes

- Only returns asset types where `maint_required = 1` (true)
- Only returns active asset types (`int_status = 1`)
- Results are ordered by asset type name (`text`) alphabetically
- Requires valid authentication token
- Returns all maintenance-related fields including `maint_type_id` and `maint_lead_type`

## Related Endpoints

- `GET /api/asset-types` - Get all asset types
- `GET /api/asset-types/group-required` - Get asset types where group is required
- `GET /api/asset-types/assignment-type/:assignment_type` - Get asset types by assignment type
- `GET /api/asset-types/:id` - Get specific asset type by ID

## Testing

A test script is available at `test_maint_required_api.js` to verify the endpoint functionality.

To run the test:

```bash
node test_maint_required_api.js
```

Make sure to update the test credentials and server URL in the script before running.

