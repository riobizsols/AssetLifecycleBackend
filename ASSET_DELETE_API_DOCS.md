# Asset DELETE API Documentation

## Overview
The Asset DELETE API provides functionality to delete single or multiple assets from the Asset Lifecycle Management system.

## Base URL
```
http://localhost:5001/api/assets
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. DELETE /api/assets/:id
**Delete a single asset by ID**

**Parameters:**
- `id`: Asset ID to delete (path parameter)

**Response (200 OK):**
```json
{
    "message": "Asset deleted successfully",
    "deletedAsset": {
        "asset_id": "AST001",
        "asset_type_id": "AST001",
        "ext_id": "123e4567-e89b-12d3-a456-426614174000",
        "text": "Laptop Computer",
        "serial_number": "LAP123456",
        "description": "Dell Latitude 5520",
        "branch_id": "BR001",
        "vendor_id": "VEN001",
        "prod_serve_id": "PS001",
        "maintsch_id": "MT001",
        "purchased_cost": 1200.00,
        "purchased_on": "2024-01-15",
        "purchased_by": "EMP001",
        "expiry_date": "2027-01-15",
        "current_status": "Active",
        "warranty_period": "3 years",
        "parent_id": null,
        "group_id": null,
        "org_id": "ORG001",
        "created_by": "EMP001",
        "created_on": "2024-01-15T00:00:00.000Z",
        "changed_by": null,
        "changed_on": null
    }
}
```

**Error Responses:**
- `404 Not Found`: Asset not found
- `500 Internal Server Error`: Server error

### 2. DELETE /api/assets
**Delete multiple assets**

**Request Body:**
```json
{
    "asset_ids": ["AST001", "AST002", "AST003"]
}
```

**Response (200 OK):**
```json
{
    "message": "3 asset(s) deleted successfully",
    "deletedAssets": [
        {
            "asset_id": "AST001",
            "asset_type_id": "AST001",
            "ext_id": "123e4567-e89b-12d3-a456-426614174000",
            "text": "Laptop Computer",
            "serial_number": "LAP123456",
            "description": "Dell Latitude 5520",
            "branch_id": "BR001",
            "vendor_id": "VEN001",
            "prod_serve_id": "PS001",
            "maintsch_id": "MT001",
            "purchased_cost": 1200.00,
            "purchased_on": "2024-01-15",
            "purchased_by": "EMP001",
            "expiry_date": "2027-01-15",
            "current_status": "Active",
            "warranty_period": "3 years",
            "parent_id": null,
            "group_id": null,
            "org_id": "ORG001",
            "created_by": "EMP001",
            "created_on": "2024-01-15T00:00:00.000Z",
            "changed_by": null,
            "changed_on": null
        },
        {
            "asset_id": "AST002",
            "asset_type_id": "AST001",
            "ext_id": "987fcdeb-51a2-43d1-9f12-345678901234",
            "text": "Desktop Computer",
            "serial_number": "DESK789012",
            "description": "HP EliteDesk 800",
            "branch_id": "BR002",
            "vendor_id": "VEN002",
            "prod_serve_id": "PS002",
            "maintsch_id": "MT002",
            "purchased_cost": 800.00,
            "purchased_on": "2024-02-01",
            "purchased_by": "EMP002",
            "expiry_date": "2026-02-01",
            "current_status": "Active",
            "warranty_period": "2 years",
            "parent_id": null,
            "group_id": null,
            "org_id": "ORG001",
            "created_by": "EMP002",
            "created_on": "2024-02-01T00:00:00.000Z",
            "changed_by": null,
            "changed_on": null
        }
    ],
    "requestedCount": 3,
    "deletedCount": 2
}
```

**Error Responses:**
- `400 Bad Request`: Missing or empty asset_ids array
- `404 Not Found`: None of the specified assets were found
- `500 Internal Server Error`: Server error

## Example Usage

### cURL Examples

**Delete single asset:**
```bash
curl -X DELETE http://localhost:5001/api/assets/AST001 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Delete multiple assets:**
```bash
curl -X DELETE http://localhost:5001/api/assets \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_ids": ["AST001", "AST002", "AST003"]
  }'
```

## Testing in Postman

### **1. Delete Single Asset**

**Method:** `DELETE`
**URL:** `http://localhost:5001/api/assets/AST001`
**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Success Response (200 OK):**
```json
{
    "message": "Asset deleted successfully",
    "deletedAsset": {
        "asset_id": "AST001",
        "text": "Laptop Computer",
        "serial_number": "LAP123456",
        "description": "Dell Latitude 5520",
        "current_status": "Active"
    }
}
```

### **2. Delete Multiple Assets**

**Method:** `DELETE`
**URL:** `http://localhost:5001/api/assets`
**Headers:**
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Body (JSON):**
```json
{
    "asset_ids": ["AST001", "AST002", "AST003"]
}
```

**Expected Success Response (200 OK):**
```json
{
    "message": "2 asset(s) deleted successfully",
    "deletedAssets": [
        {
            "asset_id": "AST001",
            "text": "Laptop Computer"
        },
        {
            "asset_id": "AST002",
            "text": "Desktop Computer"
        }
    ],
    "requestedCount": 3,
    "deletedCount": 2
}
```

### **3. Error Cases to Test**

**Asset Not Found (404):**
```bash
curl -X DELETE http://localhost:5001/api/assets/NONEXISTENT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Empty Array (400):**
```json
{
    "asset_ids": []
}
```

**Missing Array (400):**
```json
{
    "asset_ids": null
}
```

## Error Handling

The API includes comprehensive error handling for:
- Non-existent assets
- Invalid asset IDs
- Empty or missing asset_ids array
- Database connection issues
- Authentication failures

All errors return appropriate HTTP status codes and descriptive error messages.

## Security Considerations

- **Authentication Required**: All delete operations require valid JWT token
- **Validation**: Checks if assets exist before deletion
- **Transaction Safety**: Uses database transactions for data integrity
- **Audit Trail**: Returns deleted asset information for audit purposes

## Database Impact

- **Cascade Effects**: Consider foreign key relationships before deletion
- **Data Recovery**: Deleted assets cannot be recovered through this API
- **Performance**: Bulk deletions are optimized for better performance

## Best Practices

1. **Verify Before Delete**: Always check if assets exist before deletion
2. **Bulk Operations**: Use multiple asset deletion for better performance
3. **Audit Logging**: Log deletion operations for compliance
4. **Backup**: Ensure database backups before bulk deletions
5. **Testing**: Test with non-critical assets first

## Integration Notes

- The delete operations are irreversible
- Consider implementing soft delete if data recovery is needed
- Monitor database performance during bulk deletions
- Implement proper error handling in client applications 