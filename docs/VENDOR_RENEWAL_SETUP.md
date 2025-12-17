# Vendor Contract Renewal Feature - Quick Setup Guide

## Quick Start

Follow these steps to set up the vendor contract renewal tracking feature:

### Step 1: Create the Database Table

Choose one of the following methods:

#### Option A: Run Migration Script (Recommended)
```bash
cd AssetLifecycleBackend
node migrations/createVendorRenewalTable.js
```

#### Option B: API Endpoint
Make a POST request to:
```
POST http://localhost:5000/api/vendor-renewals/initialize
Authorization: Bearer <your-token>
```

#### Option C: SQL Script
Run this SQL directly in your PostgreSQL database:
```sql
CREATE TABLE IF NOT EXISTS "tblVendorRenewal" (
  vr_id VARCHAR(50) PRIMARY KEY,
  wfamsh_id VARCHAR(50) NOT NULL,
  vendor_id VARCHAR(50) NOT NULL,
  vendor_name VARCHAR(255),
  contract_start_date DATE,
  contract_end_date DATE,
  previous_contract_end_date DATE,
  renewal_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  renewal_approved_by VARCHAR(50),
  renewal_notes TEXT,
  status VARCHAR(10) DEFAULT 'CO',
  org_id VARCHAR(50) NOT NULL,
  branch_code VARCHAR(50),
  created_by VARCHAR(50),
  created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(50),
  changed_on TIMESTAMP,
  CONSTRAINT fk_vendor 
    FOREIGN KEY (vendor_id) 
    REFERENCES "tblVendors" (vendor_id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_workflow 
    FOREIGN KEY (wfamsh_id) 
    REFERENCES "tblWFAssetMaintSch_H" (wfamsh_id) 
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id);
CREATE INDEX IF NOT EXISTS idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id);
CREATE INDEX IF NOT EXISTS idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date);
```

### Step 2: Verify Installation

Check if the table was created:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'tblVendorRenewal';
```

### Step 3: Restart Server

If your server was running, restart it to load the new routes:
```bash
npm run dev
# or
npm start
```

### Step 4: Test the Feature

#### Test 1: Check API Endpoints
```bash
# Get all vendor renewals (should return empty array initially)
GET http://localhost:5000/api/vendor-renewals
```

#### Test 2: Create a Test Vendor Contract Renewal Workflow
1. Create or select a vendor with contract dates
2. Wait for the cron job to create a renewal workflow (or create manually)
3. Approve the workflow through all approval steps
4. Check that a record was created in tblVendorRenewal

#### Test 3: Query the Database
```sql
SELECT * FROM "tblVendorRenewal" ORDER BY renewal_date DESC;
```

## How It Works

### Automatic Process Flow

1. **Cron Job Detection**: System detects vendor contracts nearing expiration
2. **Workflow Creation**: Creates MT005 (Vendor Contract Renewal) workflow
3. **Approval Process**: Workflow goes through role-based approval steps
4. **Status Update**: Once all approvers approve, status changes to "CO"
5. **Record Creation**: System automatically creates entry in `tblVendorRenewal`

### What Gets Stored

For each approved vendor contract renewal:
- Unique renewal ID (VR001, VR002, etc.)
- Workflow reference (wfamsh_id)
- Vendor information (ID, name)
- Contract dates (start, end, previous end)
- Approval metadata (who approved, when, notes)
- Organization and branch information

## Files Modified/Created

### New Files
```
✅ models/vendorRenewalModel.js          - Database model
✅ controllers/vendorRenewalController.js - API controller
✅ routes/vendorRenewalRoutes.js         - API routes
✅ migrations/createVendorRenewalTable.js - Migration script
✅ docs/VENDOR_RENEWAL_FEATURE.md        - Full documentation
✅ docs/VENDOR_RENEWAL_SETUP.md          - Setup guide (this file)
```

### Modified Files
```
✅ models/approvalDetailModel.js         - Added vendor renewal creation logic
✅ server.js                             - Registered vendor renewal routes
```

## API Endpoints Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendor-renewals` | Get all vendor renewals |
| GET | `/api/vendor-renewals/:vrId` | Get specific renewal by ID |
| GET | `/api/vendor-renewals/vendor/:vendorId` | Get renewals for a vendor |
| POST | `/api/vendor-renewals/initialize` | Create table (admin) |

## Common Issues & Solutions

### Issue: Table already exists error
**Solution**: Table was already created. This is fine - you can proceed with testing.

### Issue: Foreign key constraint error
**Solution**: Ensure the referenced tables exist:
- `tblVendors` - for vendor_id foreign key
- `tblWFAssetMaintSch_H` - for wfamsh_id foreign key

### Issue: Records not being created automatically
**Checklist**:
- ✅ Table exists in database
- ✅ Server has been restarted
- ✅ Workflow type is exactly 'MT005'
- ✅ All approvers have approved
- ✅ Workflow status is 'CO'
- ✅ Check server logs for errors

### Issue: Permission denied
**Solution**: Ensure database user has proper permissions:
```sql
GRANT CREATE, SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_db_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_db_user;
```

## Testing Checklist

- [ ] Table created successfully
- [ ] Server restarted without errors
- [ ] API endpoint `/api/vendor-renewals` is accessible
- [ ] Can fetch vendor renewals (even if empty)
- [ ] Vendor contract renewal workflow (MT005) creates record when approved
- [ ] Record contains correct vendor information
- [ ] Record contains correct workflow reference
- [ ] Record contains approval metadata

## Next Steps

After successful setup:

1. **Monitor**: Watch the first few vendor contract renewals to ensure records are created
2. **Report**: Create reports/dashboards using the new data
3. **Integrate**: Connect to frontend to display renewal history
4. **Notify**: Set up notifications for renewal completions (optional)
5. **Document**: Train users on the new tracking functionality

## Support

For technical assistance:
- Check server logs: `tail -f logs/server.log`
- Review database logs
- Contact development team with error details

## Rollback (If Needed)

If you need to remove this feature:

```sql
-- Drop the table
DROP TABLE IF EXISTS "tblVendorRenewal" CASCADE;
```

Then revert the code changes in:
- `models/approvalDetailModel.js`
- `server.js`

And remove the new files.

---

**Feature Status**: ✅ Ready for Production  
**Last Updated**: 2025-12-08  
**Version**: 1.0.0
