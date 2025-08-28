# Reports Dropdown and Asset Report Implementation

## Overview

This implementation adds a new "Reports" dropdown to the sidebar navigation with an "Asset Report" item underneath it. The navigation is database-driven and supports different access levels for various job roles.

## What Was Implemented

### 1. Frontend Changes

#### New Asset Report Page
- **Location**: `AssetLifecycleManagementFrontend/src/pages/reports/AssetReport.jsx`
- **Features**:
  - Modern, responsive UI with Tailwind CSS
  - Asset statistics dashboard with cards
  - Advanced filtering capabilities (search, department, asset type, status, date range)
  - Data table with asset information
  - Export functionality (placeholder)
  - Loading states and error handling

#### Route Configuration
- **Route**: `/reports/asset-report`
- **File**: `AssetLifecycleManagementFrontend/src/routes/AppRoutes.jsx`
- **Protected**: Yes, requires authentication

#### Sidebar Integration
- **File**: `AssetLifecycleManagementFrontend/src/components/DatabaseSidebar.jsx`
- **Changes**:
  - Added `ASSETREPORT` to `appIdToPath` mapping
  - Added `FileText` icon for Asset Report
  - Supports database-driven navigation

### 2. Backend Changes

#### Database Navigation Items
- **Table**: `tblJobRoleNav`
- **Script**: `AssetLifecycleManagementBackend/add_reports_navigation.js`
- **SQL**: `AssetLifecycleManagementBackend/add_reports_navigation.sql`

#### Navigation Structure
```
Reports (Dropdown)
└── Asset Report
```

#### Job Role Access Levels
| Job Role | Reports Dropdown | Asset Report | Access Level |
|----------|------------------|--------------|--------------|
| JR001 (System Administrator) | ✅ | ✅ | Full Access (A) |
| JR002 (Department Manager) | ✅ | ✅ | Read-Only (D) |
| JR003 (Asset Manager) | ✅ | ✅ | Full Access (A) |
| JR004 (Maintenance Supervisor) | ✅ | ✅ | Read-Only (D) |
| JR005 (View Only User) | ✅ | ✅ | Read-Only (D) |

## Database Schema

The navigation items are stored in the `tblJobRoleNav` table with the following structure:

```sql
CREATE TABLE "tblJobRoleNav" (
    job_role_nav_id VARCHAR PRIMARY KEY,
    org_id VARCHAR,
    int_status INTEGER DEFAULT 1,
    job_role_id VARCHAR NOT NULL,
    parent_id VARCHAR,
    app_id VARCHAR NOT NULL,
    label VARCHAR NOT NULL,
    sub_menu VARCHAR,
    sequence INTEGER DEFAULT 10,
    access_level CHAR(1),
    is_group BOOLEAN DEFAULT FALSE,
    mob_desk CHAR(1) DEFAULT 'D'
);
```

### Key Fields Explained
- **`job_role_nav_id`**: Unique identifier for each navigation item
- **`parent_id`**: References another `job_role_nav_id` to create dropdown structure
- **`app_id`**: Maps to frontend routes (e.g., 'ASSETREPORT')
- **`is_group`**: TRUE for dropdown headers, FALSE for child items
- **`access_level`**: 'A' for full access, 'D' for read-only, NULL for no access
- **`sequence`**: Determines order in the sidebar

## Installation and Setup

### 1. Run the Navigation Setup Script

```bash
cd AssetLifecycleManagementBackend
node add_reports_navigation.js
```

### 2. Verify the Installation

The script will output a summary of all navigation items added and verify the database insertions.

### 3. Test the Implementation

1. Start the backend server
2. Start the frontend application
3. Log in with a user that has one of the supported job roles
4. Navigate to the sidebar and look for the "Reports" dropdown
5. Click on "Asset Report" to access the new page

## Features of the Asset Report Page

### Dashboard Statistics
- Total Assets count
- Active Assets count
- Maintenance Due count
- Expired Assets count

### Filtering Capabilities
- **Search**: Text search across asset names
- **Department**: Filter by department
- **Asset Type**: Filter by asset type
- **Status**: Filter by asset status (Active, Inactive, Maintenance)
- **Date Range**: Filter by purchase date range

### Data Table
- Asset Name
- Asset ID
- Type
- Department
- Assigned To
- Status (with color-coded badges)
- Purchase Date
- Value

### Export Functionality
- Export button (placeholder implementation)
- Can be extended to export filtered data to Excel/PDF

## Customization

### Adding More Report Types
To add more reports under the Reports dropdown:

1. Create a new page in `src/pages/reports/`
2. Add the route in `AppRoutes.jsx`
3. Add the `app_id` mapping in `DatabaseSidebar.jsx`
4. Add navigation items to the database using the same pattern

### Modifying Access Levels
Update the `access_level` field in the database:
- `'A'`: Full access (can view and edit)
- `'D'`: Read-only access (can view only)
- `NULL`: No access (hidden from user)

### Changing Icons
Modify the `getIconComponent` function in `DatabaseSidebar.jsx` to use different Lucide React icons.

## Troubleshooting

### Navigation Not Appearing
1. Check if the database script ran successfully
2. Verify user has the correct job role assigned
3. Check browser console for any JavaScript errors
4. Ensure the backend navigation API is working

### Page Not Loading
1. Verify the route is correctly added to `AppRoutes.jsx`
2. Check if the component import path is correct
3. Ensure all required dependencies are installed

### Database Errors
1. Verify the `tblJobRoleNav` table exists
2. Check database connection settings
3. Ensure proper permissions for the database user

## Future Enhancements

1. **Real-time Data**: Connect to actual asset APIs instead of mock data
2. **Advanced Export**: Implement Excel/PDF export functionality
3. **Charts and Graphs**: Add visual representations of asset data
4. **Scheduled Reports**: Allow users to schedule automated reports
5. **Email Notifications**: Send reports via email
6. **Report Templates**: Allow customization of report layouts
7. **Mobile Support**: Optimize for mobile devices

## Files Modified/Created

### Frontend
- `src/pages/reports/AssetReport.jsx` (NEW)
- `src/routes/AppRoutes.jsx` (MODIFIED)
- `src/components/DatabaseSidebar.jsx` (MODIFIED)

### Backend
- `add_reports_navigation.js` (NEW)
- `add_reports_navigation.sql` (NEW)
- `REPORTS_IMPLEMENTATION.md` (NEW)

## Support

For issues or questions regarding this implementation, please refer to the main project documentation or contact the development team.
