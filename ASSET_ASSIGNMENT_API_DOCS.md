# Asset Assignment API Documentation

This document describes the API endpoints for managing asset assignments in the Asset Lifecycle Management system.

## Base URL
```
http://localhost:5001/api/asset-assignments
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Create Asset Assignment
**POST** `/api/asset-assignments`

Creates a new asset assignment.

**Request Body:**
```json
{
  "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
  "dept_id": "dept-uuid-here",
  "employee_id": "employee-uuid-here",
  "asset_id": "asset-uuid-here",
  "effective_date": "2024-01-15",
  "return_date": "2024-12-31",
  "status": "Active",
  "org_id": "org-uuid-here"
}
```

**Required Fields:**
- `asset_assign_id` (String): Unique identifier for the assignment
- `dept_id` (String): Department ID
- `employee_id` (String): Employee ID
- `asset_id` (String): Asset ID
- `org_id` (String): Organization ID

**Optional Fields:**
- `effective_date` (Date): When the assignment becomes effective
- `return_date` (Date): Expected return date
- `status` (String): Assignment status (default: "Active")

**Response (201):**
```json
{
  "message": "Asset assignment added successfully",
  "assignment": {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Get All Asset Assignments
**GET** `/api/asset-assignments`

Retrieves all asset assignments.

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 3. Get Asset Assignment by ID
**GET** `/api/asset-assignments/:id`

Retrieves a specific asset assignment by its ID.

**Parameters:**
- `id` (String): Asset assignment ID

**Response (200):**
```json
{
  "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
  "dept_id": "dept-uuid-here",
  "employee_id": "employee-uuid-here",
  "asset_id": "asset-uuid-here",
  "effective_date": "2024-01-15",
  "return_date": "2024-12-31",
  "status": "Active",
  "org_id": "org-uuid-here",
  "created_by": "user-uuid-here",
  "created_on": "2024-01-15T10:30:00Z",
  "changed_by": "user-uuid-here",
  "changed_on": "2024-01-15T10:30:00Z"
}
```

### 4. Get Asset Assignment with Details
**GET** `/api/asset-assignments/details/:id`

Retrieves a specific asset assignment with related information (department name, employee name, asset name, organization name).

**Parameters:**
- `id` (String): Asset assignment ID

**Response (200):**
```json
{
  "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
  "dept_id": "dept-uuid-here",
  "employee_id": "employee-uuid-here",
  "asset_id": "asset-uuid-here",
  "effective_date": "2024-01-15",
  "return_date": "2024-12-31",
  "status": "Active",
  "org_id": "org-uuid-here",
  "created_by": "user-uuid-here",
  "created_on": "2024-01-15T10:30:00Z",
  "changed_by": "user-uuid-here",
  "changed_on": "2024-01-15T10:30:00Z",
  "dept_name": "IT Department",
  "employee_name": "John Doe",
  "asset_name": "Laptop Dell XPS",
  "org_name": "ABC Corporation"
}
```

### 5. Get Asset Assignments by Department
**GET** `/api/asset-assignments/dept/:dept_id`

Retrieves all asset assignments for a specific department.

**Parameters:**
- `dept_id` (String): Department ID

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 6. Get Asset Assignments by Employee
**GET** `/api/asset-assignments/employee/:employee_id`

Retrieves all asset assignments for a specific employee.

**Parameters:**
- `employee_id` (String): Employee ID

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 7. Get Asset Assignments by Asset
**GET** `/api/asset-assignments/asset/:asset_id`

Retrieves all asset assignments for a specific asset.

**Parameters:**
- `asset_id` (String): Asset ID

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 8. Get Asset Assignments by Status
**GET** `/api/asset-assignments/status/:status`

Retrieves all asset assignments with a specific status.

**Parameters:**
- `status` (String): Assignment status (e.g., "Active", "Returned", "Expired")

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 9. Get Asset Assignments by Organization
**GET** `/api/asset-assignments/org/:org_id`

Retrieves all asset assignments for a specific organization.

**Parameters:**
- `org_id` (String): Organization ID

**Response (200):**
```json
[
  {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
]
```

### 10. Update Asset Assignment
**PUT** `/api/asset-assignments/:id`

Updates an existing asset assignment.

**Parameters:**
- `id` (String): Asset assignment ID

**Request Body:**
```json
{
  "dept_id": "dept-uuid-here",
  "employee_id": "employee-uuid-here",
  "asset_id": "asset-uuid-here",
  "effective_date": "2024-01-15",
  "return_date": "2024-12-31",
  "status": "Returned",
  "org_id": "org-uuid-here"
}
```

**Response (200):**
```json
{
  "message": "Asset assignment updated successfully",
  "assignment": {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Returned",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T11:45:00Z"
  }
}
```

### 11. Delete Asset Assignment
**DELETE** `/api/asset-assignments/:id`

Deletes a specific asset assignment.

**Parameters:**
- `id` (String): Asset assignment ID

**Response (200):**
```json
{
  "message": "Asset assignment deleted successfully",
  "assignment": {
    "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
    "dept_id": "dept-uuid-here",
    "employee_id": "employee-uuid-here",
    "asset_id": "asset-uuid-here",
    "effective_date": "2024-01-15",
    "return_date": "2024-12-31",
    "status": "Active",
    "org_id": "org-uuid-here",
    "created_by": "user-uuid-here",
    "created_on": "2024-01-15T10:30:00Z",
    "changed_by": "user-uuid-here",
    "changed_on": "2024-01-15T10:30:00Z"
  }
}
```

### 12. Delete Multiple Asset Assignments
**DELETE** `/api/asset-assignments`

Deletes multiple asset assignments.

**Request Body:**
```json
{
  "asset_assign_ids": [
    "123e4567-e89b-12d3-a456-426614174000",
    "456e7890-e89b-12d3-a456-426614174001"
  ]
}
```

**Response (200):**
```json
{
  "message": "2 asset assignment(s) deleted successfully",
  "deleted_assignments": [
    {
      "asset_assign_id": "123e4567-e89b-12d3-a456-426614174000",
      "dept_id": "dept-uuid-here",
      "employee_id": "employee-uuid-here",
      "asset_id": "asset-uuid-here",
      "effective_date": "2024-01-15",
      "return_date": "2024-12-31",
      "status": "Active",
      "org_id": "org-uuid-here",
      "created_by": "user-uuid-here",
      "created_on": "2024-01-15T10:30:00Z",
      "changed_by": "user-uuid-here",
      "changed_on": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "asset_assign_id, dept_id, employee_id, asset_id, and org_id are required fields"
}
```

### 404 Not Found
```json
{
  "error": "Asset assignment not found"
}
```

### 409 Conflict
```json
{
  "error": "Asset assignment with this asset_assign_id already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Database Schema

The asset assignments are stored in the `tblAssetAssignments` table with the following structure:

```sql
CREATE TABLE "tblAssetAssignments" (
    asset_assign_id VARCHAR(255) PRIMARY KEY,
    dept_id VARCHAR(255) REFERENCES "tblDepartments"(dept_id),
    employee_id VARCHAR(255) REFERENCES "tblUsers"(user_id),
    asset_id VARCHAR(255) REFERENCES "tblAssets"(asset_id),
    effective_date DATE,
    return_date DATE,
    status VARCHAR(50) DEFAULT 'Active',
    org_id VARCHAR(255) REFERENCES "tblOrganizations"(org_id),
    created_by VARCHAR(255) REFERENCES "tblUsers"(user_id),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255) REFERENCES "tblUsers"(user_id),
    changed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
```

## Notes

1. All ID fields are stored as VARCHAR(255) strings
2. The system prevents duplicate active assignments for the same asset and employee
3. Status values typically include: "Active", "Returned", "Expired", "Cancelled"
4. All timestamps are in UTC format
5. The `changed_by` and `changed_on` fields are automatically updated on modifications 