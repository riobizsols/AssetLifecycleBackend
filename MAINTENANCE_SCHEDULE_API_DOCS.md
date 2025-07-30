# Maintenance Schedule API Documentation

This document describes the API endpoints for the Maintenance Schedule module in the Asset Lifecycle Management system.

## Overview

The Maintenance Schedule module automatically generates maintenance schedules for assets based on:
- Asset types that require maintenance (`maint_required = true`)
- Maintenance frequency settings from `tblATMaintFreq`
- Asset purchase dates and previous maintenance history
- Workflow sequences and job role assignments

## Base URL
```
http://localhost:4000/api/maintenance-schedules
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Generate Maintenance Schedules
**POST** `/api/maintenance-schedules/generate`

Automatically generates maintenance schedules for all assets that require maintenance.

**Request Body:** None required

**Response:**
```json
{
  "message": "Maintenance schedules generated successfully",
  "asset_types_processed": 3,
  "assets_processed": 15,
  "assets_skipped": 2,
  "schedules_created": 8
}
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 2. Get Maintenance Schedules for Asset
**GET** `/api/maintenance-schedules/asset/:asset_id`

Retrieves all maintenance schedules for a specific asset.

**Parameters:**
- `asset_id` (path parameter) - The asset ID

**Response:**
```json
{
  "asset_id": "ASSET001",
  "workflow_schedules": [
    {
      "wfamsh_id": "WFAMSH_01",
      "asset_id": "ASSET001",
      "status": "IN",
      "act_sch_date": "2024-01-15T10:30:00Z"
    }
  ],
  "maintenance_schedules": [
    {
      "ams_id": "AMS001",
      "asset_id": "ASSET001",
      "status": "CO",
      "act_maint_st_date": "2024-01-10T09:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 3. Get Asset Types Requiring Maintenance
**GET** `/api/maintenance-schedules/asset-types`

Retrieves all asset types that require maintenance.

**Response:**
```json
[
  {
    "asset_type_id": "AT-01",
    "text": "Laptop",
    "maint_required": true
  },
  {
    "asset_type_id": "AT-02",
    "text": "Server",
    "maint_required": true
  }
]
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

### 4. Get Maintenance Frequency for Asset Type
**GET** `/api/maintenance-schedules/frequency/:asset_type_id`

Retrieves maintenance frequency settings for a specific asset type.

**Parameters:**
- `asset_type_id` (path parameter) - The asset type ID

**Response:**
```json
[
  {
    "at_main_freq_id": "AMF001",
    "asset_type_id": "AT-01",
    "maint_type_id": "MT-01",
    "frequency": 30,
    "uom": "days"
  },
  {
    "at_main_freq_id": "AMF002",
    "asset_type_id": "AT-01",
    "maint_type_id": "MT-02",
    "frequency": 6,
    "uom": "months"
  }
]
```

**Status Codes:**
- `200` - Success
- `500` - Internal server error

---

## Business Logic Flow

### Maintenance Schedule Generation Process

1. **Get Asset Types Requiring Maintenance**
   - Query `tblAssetTypes` where `maint_required = true`

2. **For Each Asset Type:**
   - Get all assets of that type from `tblAssets`
   - Get maintenance frequency from `tblATMaintFreq`

3. **For Each Asset:**
   - Check `tblAssetMaintSch` for status "IN" (skip if found)
   - Check `tblAssetMaintSch` for status "CO"/"CA" (get latest date)
   - Check `tblWFAssetMaintSch_H` for status "IN"/"IP" (skip if found)
   - Check `tblWFAssetMaintSch_H` for status "CO"/"CA" (get latest date)
   - Calculate `date_to_consider` (max of purchase date and latest maintenance date)

4. **For Each Frequency:**
   - Check if maintenance is due based on frequency and UOM
   - If due, create workflow maintenance schedule

5. **Create Workflow Schedules:**
   - Insert into `tblWFAssetMaintSch_H` (header)
   - Get workflow sequences from `tblWFATSeqs`
   - Get job roles from `tblWFJobRole`
   - Insert into `tblWFAssetMaintSch_D` (details)

### Date Calculation Logic

```javascript
// Example: 30 days frequency
const baseDate = new Date('2024-01-01');
const frequency = 30;
const uom = 'days';

// Calculate next maintenance date
const nextDate = new Date(baseDate);
nextDate.setDate(nextDate.getDate() + frequency);
// Result: 2024-01-31
```

### Status Codes

| Status | Description |
|--------|-------------|
| `IN` | In Progress |
| `IP` | In Process |
| `CO` | Completed |
| `CA` | Cancelled |

---

## Database Tables Involved

### Primary Tables
- `tblAssetTypes` - Asset type definitions
- `tblAssets` - Asset inventory
- `tblATMaintFreq` - Maintenance frequency settings
- `tblMaintTypes` - Maintenance type definitions

### Maintenance Tables
- `tblAssetMaintSch` - Asset maintenance schedules
- `tblWFAssetMaintSch_H` - Workflow maintenance schedule headers
- `tblWFAssetMaintSch_D` - Workflow maintenance schedule details

### Workflow Tables
- `tblWFATSeqs` - Workflow asset sequences
- `tblWFJobRole` - Workflow job role assignments

---

## Usage Examples

### Using cURL

**Generate maintenance schedules:**
```bash
curl -X POST http://localhost:4000/api/maintenance-schedules/generate \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get schedules for specific asset:**
```bash
curl -X GET http://localhost:4000/api/maintenance-schedules/asset/ASSET001 \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get asset types requiring maintenance:**
```bash
curl -X GET http://localhost:4000/api/maintenance-schedules/asset-types \
  -H "Authorization: Bearer <your-jwt-token>"
```

**Get maintenance frequency for asset type:**
```bash
curl -X GET http://localhost:4000/api/maintenance-schedules/frequency/AT-01 \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Using JavaScript/Fetch

**Generate maintenance schedules:**
```javascript
const response = await fetch('http://localhost:4000/api/maintenance-schedules/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <your-jwt-token>'
  }
});
const result = await response.json();
console.log(`Created ${result.schedules_created} schedules`);
```

**Get asset maintenance schedules:**
```javascript
const response = await fetch('http://localhost:4000/api/maintenance-schedules/asset/ASSET001', {
  headers: {
    'Authorization': 'Bearer <your-jwt-token>'
  }
});
const schedules = await response.json();
console.log('Workflow schedules:', schedules.workflow_schedules);
console.log('Maintenance schedules:', schedules.maintenance_schedules);
```

---

## Error Responses

### Bad Request (400)
```json
{
  "error": "Invalid asset ID format"
}
```

### Unauthorized (401)
```json
{
  "message": "Unauthorized: No token provided"
}
```

### Internal Server Error (500)
```json
{
  "error": "Failed to generate maintenance schedules",
  "details": "Database connection failed"
}
```

---

## Scheduling Logic Details

### Frequency Units of Measure (UOM)
- `days` - Number of days
- `weeks` - Number of weeks (7 days each)
- `months` - Number of months
- `years` - Number of years

### Date Calculation Examples

| Base Date | Frequency | UOM | Next Maintenance Date |
|-----------|-----------|-----|---------------------|
| 2024-01-01 | 30 | days | 2024-01-31 |
| 2024-01-01 | 2 | weeks | 2024-01-15 |
| 2024-01-01 | 6 | months | 2024-07-01 |
| 2024-01-01 | 1 | years | 2025-01-01 |

### Skip Conditions
1. Asset has in-progress maintenance schedules (`status = 'IN'`)
2. Asset has in-progress workflow schedules (`status = 'IN'` or `status = 'IP'`)
3. Maintenance is not due based on frequency calculation

### Create Conditions
1. Asset has completed/cancelled maintenance schedules (use latest date)
2. Asset has completed/cancelled workflow schedules (use latest date)
3. Maintenance is due based on frequency calculation

---

## Monitoring and Logging

The API provides detailed console logging for monitoring:

```
Starting maintenance schedule generation...
Found 3 asset types requiring maintenance
Processing asset type: AT-01 - Laptop
Found 5 assets for asset type AT-01
Processing asset: ASSET001 - Dell Laptop
Asset ASSET001 has completed maintenance, using latest date: 2024-01-15
Processing frequency: 30 days for asset ASSET001
Maintenance is due for asset ASSET001, creating schedule...
Created workflow maintenance schedule header: WFAMSH_01
Created workflow maintenance schedule detail: WFAMSD_01
Maintenance schedule generation completed.
Total assets processed: 15
Assets skipped: 2
Schedules created: 8
``` 