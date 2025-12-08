# How to Create the tblVendorRenewal Table

## ❌ Issue with Automated Scripts

The automated migration scripts are not showing output in your environment. This is a Windows PowerShell output buffering issue.

## ✅ Solution: Create Table Manually (2 Minutes)

### Option 1: Using pgAdmin, DBeaver, or any PostgreSQL Client

1. **Open your database client** (pgAdmin, DBeaver, etc.)

2. **Connect to your database** using the credentials from your `.env` file

3. **Open the SQL file**: `CREATE_VENDOR_RENEWAL_TABLE.sql`

4. **Execute the entire script** - It will:
   - Create the `tblVendorRenewal` table
   - Create 4 indexes for performance
   - Verify the table was created
   - Show you the table structure

5. **Done!** ✅ The table is now ready

### Option 2: Using psql Command Line

```bash
# Navigate to backend directory
cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend

# Run the SQL file
psql -U your_username -d your_database -f CREATE_VENDOR_RENEWAL_TABLE.sql
```

### Option 3: Copy-Paste SQL Directly

Open your database client and run this SQL:

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
    changed_on TIMESTAMP
);

CREATE INDEX idx_vendor_renewal_vendor_id ON "tblVendorRenewal" (vendor_id);
CREATE INDEX idx_vendor_renewal_wfamsh_id ON "tblVendorRenewal" (wfamsh_id);
CREATE INDEX idx_vendor_renewal_org_id ON "tblVendorRenewal" (org_id);
CREATE INDEX idx_vendor_renewal_renewal_date ON "tblVendorRenewal" (renewal_date);
```

## Verify Table Was Created

Run this query to confirm:

```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'tblVendorRenewal';
```

If you get a result, the table exists! ✅

## What Happens Next?

Once the table is created:

1. ✅ **Your server is already running** (no restart needed - routes are registered)
2. ✅ **The integration code is active** - When you approve a vendor contract renewal (MT005), a record will automatically be created
3. ✅ **API endpoints are ready** at `/api/vendor-renewals`

## Test the Feature

### Test 1: Check API is working

Visit in your browser or use Postman:
```
GET http://localhost:5000/api/vendor-renewals
```

You should get a response like:
```json
{
  "success": true,
  "count": 0,
  "data": []
}
```

### Test 2: Approve a Vendor Contract Renewal

1. Create or find a vendor contract renewal workflow (MT005)
2. Approve it through all approval steps
3. Once status = 'CO', check the table:

```sql
SELECT * FROM "tblVendorRenewal" ORDER BY renewal_date DESC;
```

You should see the new renewal record! ✅

## Troubleshooting

### Table already exists error?
✅ **This is fine!** The table was already created. Skip to the verification step.

### Foreign key constraint error?
✅ **Comment out the foreign key constraints** in the SQL file (they're optional)

### Can't connect to database?
✅ **Check your `.env` file** for correct `DATABASE_URL`

## Need Help?

Check these files:
- `QUICK_START.md` - Quick reference
- `docs/VENDOR_RENEWAL_SETUP.md` - Detailed setup guide
- `docs/VENDOR_RENEWAL_FEATURE.md` - Complete documentation

---

**Status**: ⏳ Awaiting table creation  
**Next Step**: Run the SQL script in your database client  
**Time Required**: 2 minutes
