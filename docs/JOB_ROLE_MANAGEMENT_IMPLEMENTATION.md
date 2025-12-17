# Job Role Management - Full Implementation

## ✅ Overview

A complete Job Role Creation and Management system with two-tab interface:
1. **Tab 1: Role Details** - Create/Edit job role basic information
2. **Tab 2: Navigation Access** - Assign APP IDs with display/auth access levels

## 📊 Database Tables

### 1. `tblJobRoles` - Job Role Master
Stores job role information:
```sql
- job_role_id (PK)      VARCHAR(50)    - Unique role ID (e.g., JR001)
- org_id                VARCHAR(50)    - Organization ID
- text                  VARCHAR(255)   - Role name/description
- job_function          TEXT           - Job function description
- int_status            INTEGER        - Status (1=active, 0=inactive)
- created_by            VARCHAR(50)    - Creator user ID
- created_on            TIMESTAMP      - Creation timestamp
- changed_by            VARCHAR(50)    - Last modifier user ID
- changed_on            TIMESTAMP      - Last modified timestamp
```

### 2. `tblJobRoleNav` - Job Role Navigation Access
Stores navigation/app access for each role:
```sql
- job_role_nav_id (PK)  VARCHAR(50)    - Unique nav ID (e.g., JRN001)
- job_role_id (FK)      VARCHAR(50)    - Links to tblJobRoles
- app_id (FK)           VARCHAR(50)    - Links to tblAppId
- access_level          VARCHAR(20)    - 'display' or 'auth' (edit access)
- mob_desk              VARCHAR(1)     - Platform: 'D'=Desktop, 'M'=Mobile, 'B'=Both
- sequence              INTEGER        - Display order
- org_id                VARCHAR(50)    - Organization ID
- int_status            INTEGER        - Status (1=active, 0=inactive)
- created_by            VARCHAR(50)    - Creator user ID
- created_on            TIMESTAMP      - Creation timestamp
```

### 3. `tblAppId` - Application/Navigation Master
Master table of available navigation items:
```sql
- app_id (PK)           VARCHAR(50)    - Unique app ID
- label                 VARCHAR(255)   - Display name
- is_group              BOOLEAN        - Is parent menu item
- parent_id             VARCHAR(50)    - Parent app_id (if submenu)
- sequence              INTEGER        - Display order
- icon                  VARCHAR(100)   - Icon identifier
- url                   VARCHAR(500)   - Navigation URL
- int_status            INTEGER        - Status
```

## 🔌 Backend API Endpoints

### 1. Get All Job Roles
```http
GET /api/job-roles
Authorization: Bearer <token>
```

**Response:**
```json
{
  "roles": [
    {
      "job_role_id": "JR001",
      "text": "System Administrator",
      "job_function": "Manages system settings and users",
      "int_status": 1,
      "created_on": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Get Available App IDs
```http
GET /api/job-roles/available-app-ids
Authorization: Bearer <token>
```

**Response:**
```json
{
  "appIds": [
    {
      "app_id": "APP001",
      "label": "Dashboard",
      "is_group": false,
      "parent_id": null,
      "sequence": 1,
      "icon": "FaDashboard",
      "url": "/dashboard"
    }
  ]
}
```

### 3. Get Specific Job Role
```http
GET /api/job-roles/:jobRoleId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "role": {
    "job_role_id": "JR001",
    "text": "System Administrator",
    "job_function": "Manages system",
    "org_id": "ORG001"
  }
}
```

### 4. Get Job Role Navigation
```http
GET /api/job-roles/:jobRoleId/navigation
Authorization: Bearer <token>
```

**Response:**
```json
{
  "navigation": [
    {
      "job_role_nav_id": "JRN001",
      "job_role_id": "JR001",
      "app_id": "APP001",
      "access_level": "auth",
      "mob_desk": "D",
      "sequence": 1,
      "label": "Dashboard"
    }
  ]
}
```

### 5. Create New Job Role
```http
POST /api/job-roles
Authorization: Bearer <token>
Content-Type: application/json

{
  "job_role_id": "JR010",
  "text": "Asset Manager",
  "job_function": "Manages all assets",
  "navigationItems": [
    {
      "app_id": "APP001",
      "access_level": "auth",
      "mob_desk": "D",
      "sequence": 1
    },
    {
      "app_id": "APP002",
      "access_level": "display",
      "mob_desk": "B",
      "sequence": 2
    }
  ]
}
```

**Response:**
```json
{
  "message": "Job role created successfully",
  "role": {
    "job_role_id": "JR010",
    "text": "Asset Manager",
    "org_id": "ORG001"
  }
}
```

### 6. Update Job Role
```http
PUT /api/job-roles/:jobRoleId
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Senior Asset Manager",
  "job_function": "Manages all assets and teams",
  "navigationItems": [
    {
      "app_id": "APP001",
      "access_level": "auth",
      "mob_desk": "D",
      "sequence": 1
    }
  ]
}
```

**Response:**
```json
{
  "message": "Job role updated successfully",
  "role": {
    "job_role_id": "JR010",
    "text": "Senior Asset Manager"
  }
}
```

## 🎨 Frontend UI Features

### Main Screen
- **Table View**: Lists all existing job roles
- **Edit Icon**: Click to edit any job role
- **+ Button**: Top-right corner to create new role
- **Filters**: Search and filter job roles
- **Export**: Export data to Excel

### Create/Edit Modal

#### Tab 1: Role Details
Fields:
- **Job Role ID*** (Required, disabled when editing)
  - Format: JR001, JR002, etc.
- **Role Name*** (Required)
  - Example: "System Administrator"
- **Job Function** (Optional)
  - Description of the role's responsibilities

#### Tab 2: Navigation Access
Features:
- **Checkbox Selection**: Select/deselect navigation items
- **Access Level Dropdown**: 
  - `Display Only` - View access only
  - `Full Access (Edit)` - Edit permissions
- **Platform Dropdown**:
  - `Desktop` (D) - Desktop only
  - `Mobile` (M) - Mobile only
  - `Both` (B) - Both platforms
- **Visual Feedback**: Selected items highlighted in blue

### Save Button
- Validates required fields
- Creates/updates record in `tblJobRoles`
- Creates/updates records in `tblJobRoleNav`
- Shows success/error toast notifications
- Refreshes the table

## 🔄 Data Flow

### Creating a New Job Role

```
User Action: Click "+ Add New Role"
    ↓
Frontend: Opens modal, Tab 1 active
    ↓
User: Fills in Job Role ID, Name, Function
    ↓
User: Switches to Tab 2
    ↓
Frontend: Fetches available app IDs
    GET /api/job-roles/available-app-ids
    ↓
User: Selects navigation items, sets access levels
    ↓
User: Clicks "Save"
    ↓
Frontend: Sends POST request
    POST /api/job-roles
    Body: { job_role_id, text, job_function, navigationItems[] }
    ↓
Backend Controller: Validates data
    ↓
Backend Model: 
    1. INSERT into tblJobRoles
    2. INSERT multiple rows into tblJobRoleNav
    ↓
Response: Success message
    ↓
Frontend: Shows toast, closes modal, refreshes table
```

### Editing an Existing Job Role

```
User Action: Click edit icon on a role
    ↓
Frontend: Opens modal with existing data
    GET /api/job-roles/:jobRoleId
    GET /api/job-roles/:jobRoleId/navigation
    ↓
User: Modifies role details or navigation items
    ↓
User: Clicks "Save"
    ↓
Frontend: Sends PUT request
    PUT /api/job-roles/:jobRoleId
    Body: { text, job_function, navigationItems[] }
    ↓
Backend Controller: Validates data
    ↓
Backend Model:
    1. UPDATE tblJobRoles
    2. DELETE existing tblJobRoleNav records
    3. INSERT new tblJobRoleNav records
    ↓
Response: Success message
    ↓
Frontend: Shows toast, closes modal, refreshes table
```

## 📝 Implementation Files

### Backend Files
```
✅ routes/jobRoleRoutes.js              - API routes
✅ controllers/jobRoleController.js     - Request handlers
✅ models/jobRoleModel.js               - Database operations
```

### Frontend Files
```
✅ pages/masterData/JobRoles.jsx        - Main UI component
```

### Key Functions in Model

1. **`createJobRole(data)`**
   - Inserts into `tblJobRoles`
   - Returns created role

2. **`updateJobRoleById(job_role_id, data, org_id)`**
   - Updates `tblJobRoles`
   - Returns updated role

3. **`insertNavigationForJobRole(job_role_id, org_id, navigationItems, created_by)`**
   - Generates sequential JRN IDs
   - Inserts multiple records into `tblJobRoleNav`

4. **`deleteNavigationByJobRole(job_role_id, org_id)`**
   - Removes all navigation items for a role
   - Used before updating navigation

5. **`getNavigationByJobRole(job_role_id, org_id)`**
   - Fetches assigned navigation items
   - Joins with `tblAppId` for labels

6. **`getAllAppIds()`**
   - Fetches all available navigation items
   - Used in dropdown for assignment

## 🔒 Access Control

The system respects user permissions:
- **Display Access**: User can view the navigation item
- **Auth Access** (Edit): User can edit/modify data in that section
- Frontend checks: `hasEditAccess('JOB_ROLES')` before showing create/edit buttons

## 🧪 Testing

### Test Case 1: Create New Job Role
1. Click "+ Add New Role"
2. Enter:
   - Job Role ID: JR999
   - Role Name: Test Manager
   - Job Function: Testing role creation
3. Switch to "Navigation Access" tab
4. Select 2-3 navigation items
5. Set different access levels
6. Click "Save"
7. **Expected**: Success toast, role appears in table

### Test Case 2: Edit Job Role
1. Click edit icon on existing role
2. Modify role name
3. Switch to "Navigation Access" tab
4. Add/remove navigation items
5. Change access levels
6. Click "Save"
7. **Expected**: Success toast, changes reflected in table

### Test Case 3: Database Verification
```sql
-- Check job role was created
SELECT * FROM "tblJobRoles" WHERE job_role_id = 'JR999';

-- Check navigation items were created
SELECT * FROM "tblJobRoleNav" WHERE job_role_id = 'JR999';

-- Check navigation with app details
SELECT 
  jrn.*,
  a.label,
  a.url
FROM "tblJobRoleNav" jrn
INNER JOIN "tblAppId" a ON jrn.app_id = a.app_id
WHERE jrn.job_role_id = 'JR999';
```

## 🚀 Deployment Checklist

- [x] Backend routes registered
- [x] Backend controller implemented
- [x] Backend model functions created
- [x] Frontend UI component completed
- [x] Database tables exist
- [x] Access control implemented
- [x] Error handling added
- [x] Toast notifications working
- [x] Documentation created

## 📊 Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| List Job Roles | ✅ | Display all job roles in table |
| Create New Role | ✅ | Add new job role with navigation |
| Edit Role | ✅ | Modify existing role and navigation |
| Two-Tab Interface | ✅ | Details & Navigation tabs |
| App ID Assignment | ✅ | Select from available app IDs |
| Access Level Control | ✅ | Display vs Auth access |
| Platform Selection | ✅ | Desktop/Mobile/Both |
| Save to tblJobRoles | ✅ | Creates/updates role record |
| Save to tblJobRoleNav | ✅ | Creates/updates navigation records |
| Validation | ✅ | Required field checks |
| Error Handling | ✅ | Graceful error messages |
| Toast Notifications | ✅ | Success/error feedback |
| Responsive Design | ✅ | Works on all screen sizes |

## 🎉 Status: COMPLETE

The Job Role Management system is fully implemented and ready to use!

---

**Version**: 1.0.0  
**Last Updated**: 2025-12-08  
**Implementation**: Complete

