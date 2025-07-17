# User Job Roles API Documentation

This document describes the CRUD operations available for the `tblUserJobRoles` table.

## Table Structure

The `tblUserJobRoles` table has the following columns:
- `user_job_role_id` (character_varying, Length: 20) - Primary key
- `user_id` (character_varying, Length: 20) - Foreign key to users table
- `job_role_id` (character_varying, Length: 20) - Foreign key to job roles table

## API Endpoints

### Base URL
All endpoints are prefixed with `/api/user-job-roles`

### 1. Get All User Job Roles
**GET** `/api/user-job-roles/get-all`

Returns all user job role associations.

**Response:**
```json
[
  {
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
  },
  {
    "user_job_role_id": "UJR002",
    "user_id": "USR002",
    "job_role_id": "JR002"
  }
]
```

### 2. Get User Job Role by ID
**GET** `/api/user-job-roles/get-by-id/:user_job_role_id`

Returns a specific user job role by its ID.

**Parameters:**
- `user_job_role_id` (path parameter) - The ID of the user job role

**Response:**
```json
{
  "user_job_role_id": "UJR001",
  "user_id": "USR001",
  "job_role_id": "JR001"
}
```

**Error Responses:**
- `404` - User job role not found
- `400` - Missing user_job_role_id parameter

### 3. Get User Job Roles by User ID
**GET** `/api/user-job-roles/get-by-user/:user_id`

Returns all job roles associated with a specific user.

**Parameters:**
- `user_id` (path parameter) - The ID of the user

**Response:**
```json
[
  {
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
  },
  {
    "user_job_role_id": "UJR003",
    "user_id": "USR001",
    "job_role_id": "JR002"
  }
]
```

### 4. Get User Job Roles by Job Role ID
**GET** `/api/user-job-roles/get-by-job-role/:job_role_id`

Returns all users associated with a specific job role.

**Parameters:**
- `job_role_id` (path parameter) - The ID of the job role

**Response:**
```json
[
  {
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
  },
  {
    "user_job_role_id": "UJR002",
    "user_id": "USR002",
    "job_role_id": "JR001"
  }
]
```

### 5. Create User Job Role
**POST** `/api/user-job-roles/create`

Creates a new user job role association.

**Request Body:**
```json
{
  "user_job_role_id": "UJR001",
  "user_id": "USR001",
  "job_role_id": "JR001"
}
```

**Response:**
```json
{
  "user_job_role_id": "UJR001",
  "user_id": "USR001",
  "job_role_id": "JR001"
}
```

**Error Responses:**
- `400` - Missing required fields
- `409` - User job role already exists or user-job role combination already exists

### 6. Update User Job Role
**PUT** `/api/user-job-roles/update/:user_job_role_id`

Updates an existing user job role association.

**Parameters:**
- `user_job_role_id` (path parameter) - The ID of the user job role to update

**Request Body:**
```json
{
  "user_id": "USR002",
  "job_role_id": "JR002"
}
```

**Response:**
```json
{
  "user_job_role_id": "UJR001",
  "user_id": "USR002",
  "job_role_id": "JR002"
}
```

**Error Responses:**
- `400` - Missing user_job_role_id or update fields, or invalid fields
- `404` - User job role not found
- `409` - User-job role combination already exists

### 7. Delete User Job Role
**DELETE** `/api/user-job-roles/delete/:user_job_role_id`

Deletes a specific user job role association.

**Parameters:**
- `user_job_role_id` (path parameter) - The ID of the user job role to delete

**Response:**
```json
{
  "message": "User job role deleted successfully",
  "deletedUserJobRole": {
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
  }
}
```

**Error Responses:**
- `400` - Missing user_job_role_id parameter
- `404` - User job role not found

### 8. Delete Multiple User Job Roles
**DELETE** `/api/user-job-roles/delete-multiple`

Deletes multiple user job role associations.

**Request Body:**
```json
{
  "user_job_role_ids": ["UJR001", "UJR002", "UJR003"]
}
```

**Response:**
```json
{
  "message": "3 user job role(s) deleted"
}
```

**Error Responses:**
- `400` - Missing or invalid user_job_role_ids array

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `201` - Created successfully
- `400` - Bad request (missing or invalid parameters)
- `404` - Not found
- `409` - Conflict (duplicate entries)
- `500` - Internal server error

## Validation Rules

1. **Required Fields**: All three fields (`user_job_role_id`, `user_id`, `job_role_id`) are required for creation
2. **Unique Constraints**: 
   - `user_job_role_id` must be unique
   - Combination of `user_id` and `job_role_id` must be unique
3. **Update Restrictions**: Only `user_id` and `job_role_id` can be updated
4. **Data Types**: All fields are character_varying with maximum length of 20 characters

## Usage Examples

### Creating a User Job Role
```bash
curl -X POST http://localhost:5001/api/user-job-roles/create \
  -H "Content-Type: application/json" \
  -d '{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
  }'
```

### Getting All User Job Roles
```bash
curl -X GET http://localhost:5001/api/user-job-roles/get-all
```

### Updating a User Job Role
```bash
curl -X PUT http://localhost:5001/api/user-job-roles/update/UJR001 \
  -H "Content-Type: application/json" \
  -d '{
    "job_role_id": "JR002"
  }'
```

### Deleting a User Job Role
```bash
curl -X DELETE http://localhost:5001/api/user-job-roles/delete/UJR001
``` 