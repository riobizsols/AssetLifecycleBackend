# Serial Number Generation System

## Overview

The serial number generation system has been updated to use the `last_gen_seq_no` column in the `tblAssetTypes` table for tracking sequence numbers per asset type. This ensures that each asset type maintains its own sequential counter.

## Database Changes

### New Column Added
- **Table**: `tblAssetTypes`
- **Column**: `last_gen_seq_no` (INTEGER DEFAULT 0)
- **Purpose**: Stores the last generated sequence number for each asset type

### Migration
Run the migration script to add the column:
```bash
node run_migration.js
```

## Serial Number Format

The serial number follows this format:
```
[AssetTypeCode (2 digits)] + [Year (2 digits, reversed)] + [Month (2 digits)] + [Running Number (5 digits)]
```

**Example**: `1250700301`
- `12` = Asset Type Code (AT001 → 12)
- `50` = Year reversed (2025 → 25 → 50)
- `07` = Month (July)
- `00301` = Running number (301)

## API Endpoints

### 1. Generate Serial Number
- **POST** `/api/serial-numbers/generate-and-queue`
- **Body**: `{ assetTypeId, orgId }`
- **Response**: Generated serial number and queue information

### 2. Preview Next Serial Number
- **GET** `/api/serial-numbers/next/:assetTypeId`
- **Query**: `orgId`
- **Response**: Next serial number without generating it

### 3. Get Current Sequence
- **GET** `/api/serial-numbers/current/:assetTypeId`
- **Query**: `orgId`
- **Response**: Current sequence number for the asset type

## Frontend Features

### Add Asset Form (`/assets/add`)

1. **Asset Type Selection**: Must select an asset type first
2. **Generate Button**: Generates and displays the serial number in the field (sequence not incremented yet)

### Workflow

1. **Select Asset Type**: Choose an asset type from the dropdown
2. **Generate**: Click "Generate" to display the serial number in the field
3. **Submit**: Complete the form and save the asset (sequence incremented only when asset is created)

## Database Schema

### tblAssetTypes Table
```sql
ALTER TABLE "tblAssetTypes" 
ADD COLUMN last_gen_seq_no INTEGER DEFAULT 0;
```

### tblPrintSerialNoQueue Table
```sql
-- Existing table for print queue
CREATE TABLE "tblPrintSerialNoQueue" (
  psnq_id VARCHAR(20) PRIMARY KEY,
  serial_no VARCHAR(50) NOT NULL,
  status VARCHAR(10) DEFAULT 'PN',
  created_by VARCHAR(20),
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  org_id VARCHAR(20)
);
```

## Implementation Details

### Backend Changes

1. **serialNumberGenerator.js**: Updated to use `last_gen_seq_no` from `tblAssetTypes`
2. **assetTypeModel.js**: Updated queries to include `last_gen_seq_no` column
3. **serialNumberRoutes.js**: Added new endpoint for previewing next serial number

### Frontend Changes

1. **AddAssetForm.jsx**: Added preview functionality and UI improvements
2. **State Management**: Added states for preview and next serial number
3. **API Integration**: Added calls to preview endpoint

## Benefits

1. **Asset Type Isolation**: Each asset type has its own sequence counter
2. **Predictable Format**: Consistent serial number format across all asset types
3. **Database Efficiency**: Uses dedicated column instead of counting from queue table
4. **Scalability**: Supports multiple asset types with independent counters
5. **Safe Generation**: Sequence is only incremented when asset is actually created, preventing gaps

## Example Usage

### For Fan Asset Type (AT001)
- First serial: `12507000001`
- Second serial: `12507000002`
- Third serial: `12507000003`

### For Laptop Asset Type (AT002)
- First serial: `22507000001`
- Second serial: `22507000002`
- Third serial: `22507000003`

## Error Handling

- **Asset Type Not Found**: Returns error if asset type doesn't exist
- **Database Errors**: Proper error messages for database issues
- **Frontend Validation**: Prevents generation without asset type selection
- **Network Errors**: Graceful handling of API failures

## Testing

### Backend Testing
```bash
# Test serial number generation
curl -X POST http://localhost:3000/api/serial-numbers/generate-and-queue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"assetTypeId": "AT001", "orgId": "ORG001"}'

# Test preview functionality
curl -X GET http://localhost:3000/api/serial-numbers/next/AT001 \
  -H "Authorization: Bearer <token>"
```

### Frontend Testing
1. Navigate to `/assets/add`
2. Select an asset type
3. Click "Generate" to create serial number
4. Verify the serial number appears in the input field
