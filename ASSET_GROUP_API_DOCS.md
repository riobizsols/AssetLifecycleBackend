# Asset Group API Documentation

## Overview
The Asset Group API allows you to create, manage, and organize assets into groups. This system uses two tables:
- `tblAssetGroup_H`: Stores group header information
- `tblAssetGroup_D`: Stores individual asset associations with groups

## Database Schema

### tblAssetGroup_H (Header Table)
| Column | Type | Description |
|--------|------|-------------|
| assetgroup_h_id | VARCHAR | Primary key (format: AGH001, AGH002, etc.) |
| org_id | VARCHAR | Organization ID |
| text | VARCHAR | Group name/description |
| created_by | VARCHAR | User ID who created the group |
| created_on | TIMESTAMP | Creation timestamp |
| changed_by | VARCHAR | User ID who last modified |
| changed_on | TIMESTAMP | Last modification timestamp |

### tblAssetGroup_D (Detail Table)
| Column | Type | Description |
|--------|------|-------------|
| assetgroup_d_id | VARCHAR | Primary key (format: AGD001, AGD002, etc.) |
| assetgroup_h_id | VARCHAR | Foreign key to tblAssetGroup_H |
| asset_id | VARCHAR | Foreign key to tblAssets |

## API Endpoints

### 1. Create Asset Group
**POST** `/api/asset-groups`

Creates a new asset group with selected assets.

**Request Body:**
```json
{
  "text": "Development Team Laptops",
  "asset_ids": ["A001", "A002", "A003"]
}
```

**Response:**
```json
{
  "message": "Asset group created successfully",
  "asset_group": {
    "header": {
      "assetgroup_h_id": "AGH001",
      "org_id": "ORG001",
      "text": "Development Team Laptops",
      "created_by": "USR001",
      "created_on": "2024-01-15T10:30:00Z",
      "changed_by": "USR001",
      "changed_on": "2024-01-15T10:30:00Z"
    },
    "details": [
      {
        "assetgroup_d_id": "AGD001",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A001"
      },
      {
        "assetgroup_d_id": "AGD002",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A002"
      },
      {
        "assetgroup_d_id": "AGD003",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A003"
      }
    ]
  }
}
```

### 2. Get All Asset Groups
**GET** `/api/asset-groups`

Retrieves all asset groups with asset counts.

**Response:**
```json
[
  {
    "assetgroup_h_id": "AGH001",
    "org_id": "ORG001",
    "text": "Development Team Laptops",
    "created_by": "USR001",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "USR001",
    "changed_on": "2024-01-15T10:30:00Z",
    "asset_count": 3
  }
]
```

### 3. Get Asset Group by ID
**GET** `/api/asset-groups/:id`

Retrieves a specific asset group with all its assets.

**Response:**
```json
{
  "header": {
    "assetgroup_h_id": "AGH001",
    "org_id": "ORG001",
    "text": "Development Team Laptops",
    "created_by": "USR001",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "USR001",
    "changed_on": "2024-01-15T10:30:00Z"
  },
  "details": [
    {
      "assetgroup_d_id": "AGD001",
      "assetgroup_h_id": "AGH001",
      "asset_id": "A001",
      "asset_name": "Dell XPS 13",
      "description": "Laptop - Dell XPS 13",
      "purchased_on": "2023-01-15"
    }
  ]
}
```

### 4. Update Asset Group
**PUT** `/api/asset-groups/:id`

Updates an existing asset group.

**Request Body:**
```json
{
  "text": "Updated Development Team Laptops",
  "asset_ids": ["A001", "A002", "A004"]
}
```

**Response:**
```json
{
  "message": "Asset group updated successfully",
  "asset_group": {
    "header": {
      "assetgroup_h_id": "AGH001",
      "org_id": "ORG001",
      "text": "Updated Development Team Laptops",
      "created_by": "USR001",
      "created_on": "2024-01-15T10:30:00Z",
      "changed_by": "USR001",
      "changed_on": "2024-01-15T11:00:00Z"
    },
    "details": [
      {
        "assetgroup_d_id": "AGD004",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A001"
      },
      {
        "assetgroup_d_id": "AGD005",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A002"
      },
      {
        "assetgroup_d_id": "AGD006",
        "assetgroup_h_id": "AGH001",
        "asset_id": "A004"
      }
    ]
  }
}
```

### 5. Delete Asset Group
**DELETE** `/api/asset-groups/:id`

Deletes an asset group and all its asset associations.

**Response:**
```json
{
  "message": "Asset group deleted successfully",
  "deleted_group": {
    "assetgroup_h_id": "AGH001",
    "org_id": "ORG001",
    "text": "Development Team Laptops",
    "created_by": "USR001",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "USR001",
    "changed_on": "2024-01-15T10:30:00Z"
  }
}
```

## Setup Instructions

### 1. Run Database Setup
```bash
node setup_asset_groups.js
```

This will:
- Create `tblAssetGroup_H` and `tblAssetGroup_D` tables
- Add ID sequences for `asset_group_h` and `asset_group_d`
- Verify the setup

### 2. Start the Server
```bash
npm start
```

### 3. Test the API
You can test the API using tools like Postman or curl:

```bash
# Create an asset group
curl -X POST http://localhost:5000/api/asset-groups \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "text": "Test Group",
    "asset_ids": ["A001", "A002"]
  }'
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `201` - Created successfully
- `400` - Bad request (missing required fields)
- `404` - Asset group not found
- `500` - Internal server error

Error responses include details:
```json
{
  "error": "Group name (text) is required"
}
```

## ID Generation

- Asset Group Header IDs: `AGH001`, `AGH002`, `AGH003`, etc.
- Asset Group Detail IDs: `AGD001`, `AGD002`, `AGD003`, etc.

IDs are automatically generated using the ID sequence system and are guaranteed to be unique.

## Security

All endpoints require authentication. The API uses the authenticated user's:
- `org_id` for organization-specific data
- `user_id` for audit trails (created_by, changed_by)

## Transaction Safety

The create and update operations use database transactions to ensure data consistency. If any part of the operation fails, all changes are rolled back.
