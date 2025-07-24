# Asset Assignment API Documentation

## Overview
This API provides endpoints for managing asset assignments within the organization.

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Add New Asset Assignment
- **POST** `/api/asset-assignments`
- **Description**: Creates a new asset assignment record
- **Body**:
  ```json
  {
    "asset_assign_id": "string",
    "dept_id": "string",
    "asset_id": "string",
    "org_id": "string",
    "employee_int_id": "string",
    "action": "string (optional, default: 'Assigned')",
    "action_by": "string",
    "latest_assignment_flag": "boolean"
  }
  ```

### 2. Get All Asset Assignments
- **GET** `/api/asset-assignments`
- **Description**: Retrieves all asset assignments

### 3. Get Asset Assignment by ID
- **GET** `/api/asset-assignments/:id`
- **Description**: Retrieves a specific asset assignment by its ID

### 4. Get Asset Assignment with Details
- **GET** `/api/asset-assignments/details/:id`
- **Description**: Retrieves asset assignment with detailed information including department, employee, asset, and organization names

### 5. Get Asset Assignments by Department
- **GET** `/api/asset-assignments/dept/:dept_id`
- **Description**: Retrieves all asset assignments for a specific department

### 6. Get Asset Assignments by Employee (History)
- **GET** `/api/asset-assignments/employee/:employee_id`
- **Description**: Retrieves all asset assignment history for a specific employee

### 7. Get Active Asset Assignments by Employee
- **GET** `/api/asset-assignments/employee/:employee_id/active`
- **Description**: Retrieves only active asset assignments for a specific employee
- **Parameters**: 
  - `employee_id` (String): Employee ID or Internal Employee ID (emp_int_id)
- **Filters**: Returns only records where `action = "A"` and `latest_assignment_flag = true`
- **Response**: Object containing message, count, data array, employee details, and department details
- **Example Response (With Active Assignments)**:
  ```json
  {
    "message": "Active AssetAssignment : 2",
    "count": 2,
    "data": [
      {
        "asset_assign_id": "AA001",
        "dept_id": "DEPT001",
        "asset_id": "ASSET001",
        "org_id": "ORG001",
        "employee_int_id": "EMP_INT_0004",
        "action": "A",
        "action_on": "2024-01-15T10:30:00Z",
        "action_by": "USER001",
        "latest_assignment_flag": true
      },
      {
        "asset_assign_id": "AA002",
        "dept_id": "DEPT001",
        "asset_id": "ASSET002",
        "org_id": "ORG001",
        "employee_int_id": "EMP_INT_0004",
        "action": "A",
        "action_on": "2024-01-16T09:15:00Z",
        "action_by": "USER001",
        "latest_assignment_flag": true
      }
    ],
    "employee": {
      "emp_int_id": "EMP_INT_0004",
      "employee_id": "EMP001",
      "employee_name": "John Doe",
      "dept_id": "DEPT001"
    },
    "department": {
      "dept_id": "DEPT001",
      "department_name": "IT Department"
    }
  }
  ```
- **Example Response (No Active Assignments)**:
  ```json
  {
    "message": "No active asset assignments found",
    "count": 0,
    "data": [],
    "employee": {
      "employee_id": "EMP001",
      "employee_name": "John Doe",
      "dept_id": "DEPT001"
    },
    "department": {
      "dept_id": "DEPT001",
      "department_name": "IT Department"
    }
  }
  ```
- **Example Response (Employee Not Found)**:
  ```json
  {
    "error": "Employee not found",
    "message": "Employee not found",
    "count": 0,
    "data": [],
    "employee": null,
    "department": null
  }
  ```

### 8. Get Asset Assignments by Asset
- **GET** `/api/asset-assignments/asset/:asset_id`
- **Description**: Retrieves all asset assignments for a specific asset

### 9. Get Asset Assignments by Status
- **GET** `/api/asset-assignments/action/:action`
- **Description**: Retrieves asset assignments by action status

### 10. Get Asset Assignments by Organization
- **GET** `/api/asset-assignments/org/:org_id`
- **Description**: Retrieves all asset assignments for a specific organization

### 11. Update Asset Assignment
- **PUT** `/api/asset-assignments/:id`
- **Description**: Updates an existing asset assignment
- **Body**:
  ```json
  {
    "dept_id": "string",
    "asset_id": "string",
    "org_id": "string",
    "employee_int_id": "string",
    "action": "string",
    "action_by": "string",
    "latest_assignment_flag": "boolean"
  }
  ```

### 12. Update Asset Assignment by Asset ID
- **PUT** `/api/asset-assignments/asset/:asset_id`
- **Description**: Updates asset assignment for a specific asset (only for action="A" and latest_assignment_flag=true)
- **Body**:
  ```json
  {
    "latest_assignment_flag": "boolean"
  }
  ```

### 13. Delete Single Asset Assignment
- **DELETE** `/api/asset-assignments/:id`
- **Description**: Deletes a specific asset assignment

### 14. Delete Multiple Asset Assignments
- **DELETE** `/api/asset-assignments`
- **Description**: Deletes multiple asset assignments
- **Body**:
  ```json
  {
    "asset_assign_ids": ["id1", "id2", "id3"]
  }
  ```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Required fields are missing"
}
```

### 401 Unauthorized
```json
{
  "error": "Not authorized, no token"
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

## Data Models

### Asset Assignment
```json
{
  "asset_assign_id": "string",
  "dept_id": "string",
  "asset_id": "string",
  "org_id": "string",
  "employee_int_id": "string",
  "action": "string",
  "action_on": "timestamp",
  "action_by": "string",
  "latest_assignment_flag": "boolean"
}
```

## Notes
- The `action` field typically uses "A" for Assigned, "R" for Returned, etc.
- The `latest_assignment_flag` indicates the current active assignment for an asset-employee combination
- All timestamps are in ISO 8601 format
- Employee IDs should match existing employee records in the system 