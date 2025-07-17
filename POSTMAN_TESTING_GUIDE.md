# Postman Testing Guide for User Job Roles APIs

## 🚀 Quick Start

### Step 1: Import the Collection
1. Open Postman
2. Click "Import" button
3. Select the file: `UserJobRoles_Postman_Collection.json`
4. The collection will be imported with all 12 test requests

### Step 2: Set Environment Variable
1. In Postman, go to "Environments" tab
2. Create a new environment called "User Job Roles API"
3. Add variable:
   - **Variable**: `base_url`
   - **Initial Value**: `http://localhost:5001`
   - **Current Value**: `http://localhost:5001`
4. Select this environment from the dropdown

### Step 3: Start Your Server
Make sure your backend server is running:
```bash
cd AssetLifecycleBackend
npm start
```

## 📋 Testing Sequence

### 🔍 **1. Test Table Exists**
**Request**: `GET {{base_url}}/api/user-job-roles/test-table`

**Purpose**: Check if the `tblUserJobRoles` table exists in your database

**Expected Response**:
```json
{
  "message": "Table exists",
  "tableExists": true,
  "recordCount": 0
}
```

**If table doesn't exist**:
```json
{
  "message": "Table does not exist",
  "tableExists": false,
  "suggestion": "Run the SQL script create_tblUserJobRoles.sql to create the table"
}
```

### 📊 **2. Get All User Job Roles**
**Request**: `GET {{base_url}}/api/user-job-roles/get-all`

**Purpose**: Retrieve all user job role associations

**Expected Response** (initially empty):
```json
[]
```

### ➕ **3. Create User Job Role**
**Request**: `POST {{base_url}}/api/user-job-roles/create`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
}
```

**Expected Response**:
```json
{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
}
```

### ➕ **4. Create Another User Job Role**
**Request**: `POST {{base_url}}/api/user-job-roles/create`

**Body**:
```json
{
    "user_job_role_id": "UJR002",
    "user_id": "USR002",
    "job_role_id": "JR002"
}
```

### 🔍 **5. Get User Job Role by ID**
**Request**: `GET {{base_url}}/api/user-job-roles/get-by-id/UJR001`

**Expected Response**:
```json
{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
}
```

### 👤 **6. Get User Job Roles by User ID**
**Request**: `GET {{base_url}}/api/user-job-roles/get-by-user/USR001`

**Expected Response**:
```json
[
    {
        "user_job_role_id": "UJR001",
        "user_id": "USR001",
        "job_role_id": "JR001"
    }
]
```

### 🏢 **7. Get User Job Roles by Job Role ID**
**Request**: `GET {{base_url}}/api/user-job-roles/get-by-job-role/JR001`

**Expected Response**:
```json
[
    {
        "user_job_role_id": "UJR001",
        "user_id": "USR001",
        "job_role_id": "JR001"
    }
]
```

### ✏️ **8. Update User Job Role**
**Request**: `PUT {{base_url}}/api/user-job-roles/update/UJR001`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
    "job_role_id": "JR003"
}
```

**Expected Response**:
```json
{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR003"
}
```

### 🗑️ **9. Delete User Job Role**
**Request**: `DELETE {{base_url}}/api/user-job-roles/delete/UJR002`

**Expected Response**:
```json
{
    "message": "User job role deleted successfully",
    "deletedUserJobRole": {
        "user_job_role_id": "UJR002",
        "user_id": "USR002",
        "job_role_id": "JR002"
    }
}
```

### 🗑️ **10. Delete Multiple User Job Roles**
**Request**: `DELETE {{base_url}}/api/user-job-roles/delete-multiple`

**Headers**:
```
Content-Type: application/json
```

**Body**:
```json
{
    "user_job_role_ids": ["UJR001", "UJR002"]
}
```

**Expected Response**:
```json
{
    "message": "2 user job role(s) deleted"
}
```

## 🧪 Error Testing

### ❌ **11. Test Error - Create Duplicate**
**Request**: `POST {{base_url}}/api/user-job-roles/create`

**Body**:
```json
{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
}
```

**Expected Response** (409 Conflict):
```json
{
    "error": "User job role already exists"
}
```

### ❌ **12. Test Error - Get Non-existent ID**
**Request**: `GET {{base_url}}/api/user-job-roles/get-by-id/NONEXISTENT`

**Expected Response** (404 Not Found):
```json
{
    "error": "User job role not found"
}
```

## 🔧 Manual Testing (Alternative to Collection)

If you prefer to test manually, here are the individual requests:

### Base URL
```
http://localhost:5001
```

### 1. Test Table Exists
```
GET http://localhost:5001/api/user-job-roles/test-table
```

### 2. Get All
```
GET http://localhost:5001/api/user-job-roles/get-all
```

### 3. Create
```
POST http://localhost:5001/api/user-job-roles/create
Content-Type: application/json

{
    "user_job_role_id": "UJR001",
    "user_id": "USR001",
    "job_role_id": "JR001"
}
```

### 4. Get by ID
```
GET http://localhost:5001/api/user-job-roles/get-by-id/UJR001
```

### 5. Update
```
PUT http://localhost:5001/api/user-job-roles/update/UJR001
Content-Type: application/json

{
    "job_role_id": "JR003"
}
```

### 6. Delete
```
DELETE http://localhost:5001/api/user-job-roles/delete/UJR001
```

## 🚨 Troubleshooting

### Common Issues:

1. **Server not running**
   - Error: "Could not get any response"
   - Solution: Start the server with `npm start`

2. **Table doesn't exist**
   - Error: "relation 'tblUserJobRoles' does not exist"
   - Solution: Create the table using the SQL script

3. **Database connection issues**
   - Error: "connection refused"
   - Solution: Check your `.env` file and database connection

4. **CORS issues**
   - Error: "CORS policy" errors
   - Solution: The server should handle CORS, but check if the server is running

### Expected HTTP Status Codes:
- `200` - Success
- `201` - Created successfully
- `400` - Bad request (missing parameters)
- `404` - Not found
- `409` - Conflict (duplicate entries)
- `500` - Internal server error

## 📝 Notes

- All IDs are case-sensitive
- The `user_job_role_id` must be unique
- The combination of `user_id` and `job_role_id` must be unique
- Only `user_id` and `job_role_id` can be updated (not the primary key)
- All fields are limited to 20 characters maximum 