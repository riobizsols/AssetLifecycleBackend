# Depreciation System Implementation

## Overview

This document describes the complete depreciation system implementation for the Asset Lifecycle Management system. The system supports multiple depreciation methods including Straight Line, Reducing Balance, and Double Declining Balance.

## Features

- **Multiple Depreciation Methods**: ND (No Depreciation), SL (Straight Line), RB (Reducing Balance), DD (Double Decline)
- **Automatic Calculations**: Calculate depreciation for single assets or bulk operations
- **Historical Tracking**: Complete audit trail of all depreciation calculations
- **Flexible Configuration**: Organization-wide settings for fiscal years and calculation frequency
- **Schedule Generation**: Generate complete depreciation schedules for assets

## Database Schema

### New Columns Added

#### tblAssetTypes
```sql
depreciation_method VARCHAR(2) DEFAULT 'ND'  -- ND, SL, RB, DD
```

#### tblAssets
```sql
salvage_value DECIMAL(15,2) DEFAULT 0.00           -- End-of-life value
useful_life_years INTEGER DEFAULT 0                 -- Asset lifespan in years
depreciation_rate DECIMAL(5,2) DEFAULT 0.00        -- Calculated depreciation rate
current_book_value DECIMAL(15,2) DEFAULT 0.00      -- Current asset value
accumulated_depreciation DECIMAL(15,2) DEFAULT 0.00 -- Total depreciation so far
last_depreciation_date DATE DEFAULT NULL            -- When last calculated
```

### New Tables Created

#### tblAssetDepreciation
Stores historical depreciation records for audit and reporting.

#### tblDepreciationSettings
Organization-wide configuration for depreciation calculations.

## API Endpoints

### Base URL: `/api/depreciation`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calculate/:asset_id` | Calculate depreciation for a single asset |
| POST | `/calculate-bulk` | Calculate depreciation for multiple assets |
| GET | `/history/:asset_id` | Get depreciation history for an asset |
| GET | `/summary/:org_id` | Get depreciation summary for organization |
| GET | `/assets/:org_id/:method` | Get assets by depreciation method |
| GET | `/settings/:org_id` | Get depreciation settings |
| PUT | `/settings/:setting_id` | Update depreciation settings |
| POST | `/schedule/:asset_id` | Generate depreciation schedule |
| GET | `/eligible-assets/:org_id` | Get assets eligible for depreciation |
| GET | `/health` | Health check endpoint |

## Depreciation Methods

### 1. Straight Line (SL)
**Formula**: `(Cost of Asset - Salvage Value) / Useful Life of Asset`

**Example**:
- Asset Cost: $10,000
- Salvage Value: $1,000
- Useful Life: 5 years
- Annual Depreciation: ($10,000 - $1,000) / 5 = $1,800

### 2. Reducing Balance (RB)
**Formula**: `Current Book Value × Depreciation Rate`

**Example**:
- Current Book Value: $10,000
- Depreciation Rate: 25%
- Annual Depreciation: $10,000 × 0.25 = $2,500

### 3. Double Declining (DD)
**Formula**: `2 × (100% / Useful Life) × Current Book Value`

**Example**:
- Useful Life: 5 years
- Rate: 2 × (100% / 5) = 40%
- Current Book Value: $10,000
- Annual Depreciation: $10,000 × 0.40 = $4,000

### 4. No Depreciation (ND)
Assets with this method are not depreciated.

## Usage Examples

### Calculate Single Asset Depreciation

```javascript
// Frontend
const response = await axios.post(`/api/depreciation/calculate/${assetId}`, {
    calculation_date: '2024-12-31',
    org_id: 'ORG001'
});

// Response
{
    "message": "Depreciation calculated successfully",
    "asset_id": "ASSET001",
    "depreciation_amount": 1800.00,
    "book_value_before": 10000.00,
    "book_value_after": 8200.00,
    "depreciation_method": "SL"
}
```

### Get Depreciation History

```javascript
// Frontend
const response = await axios.get(`/api/depreciation/history/${assetId}`);

// Response
{
    "asset_id": "ASSET001",
    "history": [
        {
            "depreciation_date": "2024-12-31",
            "depreciation_amount": 1800.00,
            "book_value_before": 10000.00,
            "book_value_after": 8200.00,
            "depreciation_method": "SL"
        }
    ]
}
```

### Bulk Depreciation Calculation

```javascript
// Frontend
const response = await axios.post('/api/depreciation/calculate-bulk', {
    org_id: 'ORG001',
    calculation_date: '2024-12-31',
    asset_ids: ['ASSET001', 'ASSET002'] // Optional: specific assets
});

// Response
{
    "message": "Bulk depreciation calculation completed",
    "total_assets": 25,
    "successful": 23,
    "failed": 2,
    "results": [...],
    "errors": [...]
}
```

## Frontend Components

### 1. AddAssetType.jsx
Enhanced asset type creation form with depreciation fields:
- Depreciation Method dropdown
- Useful Life Years input
- Salvage Value input

### 2. DepreciationManagement.jsx
Comprehensive depreciation management interface:
- Asset selection
- Depreciation calculation
- Historical view
- Results display

## Backend Architecture

### 1. DepreciationService
Pure business logic for depreciation calculations:
- `calculateStraightLineDepreciation()`
- `calculateReducingBalanceDepreciation()`
- `calculateDoubleDecliningDepreciation()`
- `generateDepreciationSchedule()`

### 2. DepreciationModel
Database operations and data access:
- Asset depreciation information retrieval
- Depreciation record insertion
- Asset value updates
- Historical data queries

### 3. DepreciationController
Business logic coordination:
- Input validation
- Service method calls
- Database updates
- Response formatting

### 4. DepreciationRoutes
API endpoint definitions and routing.

## Setup Instructions

### 1. Database Setup
Run the setup script to create necessary tables and columns:
```bash
node setup_depreciation.js
```

### 2. Backend Integration
Add depreciation routes to your main Express app:
```javascript
const depreciationRoutes = require('./routes/depreciationRoutes');
app.use('/api/depreciation', depreciationRoutes);
```

### 3. Frontend Integration
Import and use the depreciation components in your React app:
```javascript
import DepreciationManagement from './components/DepreciationManagement';
```

## Configuration

### Organization Settings
Configure depreciation settings per organization:
- Fiscal year start month/day
- Calculation frequency (monthly, quarterly, yearly)
- Auto-calculation enable/disable

### Asset Type Configuration
Set depreciation method when creating asset types:
- ND: No Depreciation
- SL: Straight Line
- RB: Reducing Balance
- DD: Double Decline

## Error Handling

The system includes comprehensive error handling:
- Input validation
- Business rule validation
- Database error handling
- User-friendly error messages

## Performance Considerations

- Bulk operations for multiple assets
- Efficient database queries with proper indexing
- Transaction management for data consistency
- Pagination for large result sets

## Security

- Input sanitization and validation
- SQL injection prevention
- User authentication (when implemented)
- Role-based access control (when implemented)

## Future Enhancements

- Cron job integration for automated calculations
- Advanced reporting and analytics
- Tax depreciation support
- Multi-currency support
- Audit trail enhancements

## Testing

Test the system with various scenarios:
- Different depreciation methods
- Edge cases (zero values, negative values)
- Bulk operations
- Error conditions
- Performance with large datasets

## Support

For issues or questions:
1. Check the error logs
2. Verify database connectivity
3. Validate input parameters
4. Check asset eligibility for depreciation

## Conclusion

This depreciation system provides a robust, scalable solution for asset lifecycle management with comprehensive tracking, multiple calculation methods, and flexible configuration options.
