# Database Primary Key and Foreign Key Setup Guide

This guide helps you establish proper primary key and foreign key relationships in your database.

## Overview

The database analysis tools have been created to:
1. **Analyze** your database schema
2. **Identify** missing primary keys and foreign keys
3. **Validate** that data won't violate constraints
4. **Apply** missing constraints safely

## Tools Available

### 1. `scripts/analyze_and_fix_keys.js`
Analyzes all tables in the database and generates:
- **Report**: Detailed analysis of each table (`migrations/database_keys_analysis_report.txt`)
- **SQL Script**: SQL commands to add missing constraints (`migrations/add_missing_keys.sql`)

**Usage:**
```bash
cd AssetLifecycleBackend
node scripts/analyze_and_fix_keys.js
```

### 2. `scripts/validate_and_apply_keys.js`
Validates constraints before applying them to ensure data integrity:
- Checks for NULL values in primary key columns
- Checks for duplicate values in primary key columns
- Checks for orphaned foreign key values

**Usage:**
```bash
# Dry run (validation only)
node scripts/validate_and_apply_keys.js --dry-run

# Apply valid constraints
node scripts/validate_and_apply_keys.js --apply
```

## Step-by-Step Process

### Step 1: Analyze Database

Run the analysis script to identify missing constraints:

```bash
cd AssetLifecycleBackend
node scripts/analyze_and_fix_keys.js
```

This will generate:
- `migrations/database_keys_analysis_report.txt` - Detailed report
- `migrations/add_missing_keys.sql` - SQL script with all constraints

### Step 2: Review Generated Files

**Review the analysis report:**
```bash
# On Windows
type migrations\database_keys_analysis_report.txt

# On Linux/Mac
cat migrations/database_keys_analysis_report.txt
```

**Review the SQL script:**
```bash
# On Windows
type migrations\add_missing_keys.sql

# On Linux/Mac
cat migrations/add_missing_keys.sql
```

### Step 3: Validate Constraints

Before applying constraints, validate that your data won't cause errors:

```bash
node scripts/validate_and_apply_keys.js --dry-run
```

This will:
- Check each constraint for data integrity issues
- Report any problems (NULLs, duplicates, orphaned values)
- Generate a validation report: `migrations/constraints_validation_report.txt`

### Step 4: Fix Data Issues (if any)

If validation finds issues, you'll need to fix them manually. Common issues:

**NULL values in primary key columns:**
```sql
-- Find NULLs
SELECT * FROM "tblYourTable" WHERE "primary_key_column" IS NULL;

-- Fix NULLs (assign unique values)
UPDATE "tblYourTable" 
SET "primary_key_column" = 'UNIQUE_VALUE_' || row_number() 
WHERE "primary_key_column" IS NULL;
```

**Duplicate values in primary key columns:**
```sql
-- Find duplicates
SELECT "primary_key_column", COUNT(*) 
FROM "tblYourTable" 
GROUP BY "primary_key_column" 
HAVING COUNT(*) > 1;

-- Fix duplicates (assign unique values)
-- You'll need to determine the correct strategy based on your data
```

**Orphaned foreign key values:**
```sql
-- Find orphaned values
SELECT DISTINCT t."foreign_key_column"
FROM "tblYourTable" t
WHERE t."foreign_key_column" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "tblReferencedTable" r
    WHERE r."referenced_column" = t."foreign_key_column"
  );

-- Fix orphaned values (either delete rows or update to valid values)
DELETE FROM "tblYourTable" 
WHERE "foreign_key_column" IN (/* orphaned values */);

-- OR

UPDATE "tblYourTable" 
SET "foreign_key_column" = NULL 
WHERE "foreign_key_column" IN (/* orphaned values */);
```

### Step 5: Apply Constraints

Once all data issues are resolved, apply the constraints:

```bash
node scripts/validate_and_apply_keys.js --apply
```

This will:
- Validate each constraint again
- Apply only valid constraints
- Report success/failure for each constraint

## Common Primary Key Patterns

Based on your database schema, common primary key patterns include:

- `tblAssets` → `asset_id`
- `tblEmployees` → `emp_int_id`
- `tblUsers` → `user_id`
- `tblDepartments` → `dept_id`
- `tblBranches` → `branch_id`
- `tblOrgs` → `org_id`
- `tblVendors` → `vendor_id`
- `tblAssetTypes` → `asset_type_id`

## Common Foreign Key Patterns

The script automatically identifies foreign keys based on naming conventions:

- `org_id` → references `tblOrgs.org_id`
- `asset_type_id` → references `tblAssetTypes.asset_type_id`
- `asset_id` → references `tblAssets.asset_id`
- `dept_id` → references `tblDepartments.dept_id`
- `branch_id` → references `tblBranches.branch_id`
- `emp_int_id` / `employee_int_id` → references `tblEmployees.emp_int_id`
- `user_id` → references `tblUsers.user_id`
- `vendor_id` → references `tblVendors.vendor_id`
- `job_role_id` → references `tblJobRoles.job_role_id`

## Manual SQL Application

If you prefer to apply constraints manually, you can:

1. **Review the generated SQL file:**
   ```bash
   # On Windows
   type migrations\add_missing_keys.sql
   ```

2. **Execute specific constraints:**
   ```sql
   -- Example: Add primary key
   ALTER TABLE "tblAssets"
   ADD CONSTRAINT "pk_tblassets" PRIMARY KEY ("asset_id");

   -- Example: Add foreign key
   ALTER TABLE "tblAssetDocs"
   ADD CONSTRAINT "fk_tblassetdocs_org_id"
   FOREIGN KEY ("org_id")
   REFERENCES "tblOrgs" ("org_id")
   ON DELETE SET NULL
   ON UPDATE CASCADE;
   ```

3. **Or execute the entire file:**
   ```bash
   # Using psql
   psql -U your_username -d your_database -f migrations/add_missing_keys.sql

   # Or using your database client (pgAdmin, DBeaver, etc.)
   # Copy and paste the SQL from the file
   ```

## Important Notes

⚠️ **WARNING:**
- Always backup your database before applying constraints
- Test on a development/staging database first
- Some constraints may take time to apply on large tables
- Foreign keys with `ON DELETE CASCADE` will delete related records automatically

✅ **Best Practices:**
- Review all generated SQL before applying
- Fix data issues before applying constraints
- Apply constraints during low-traffic periods
- Monitor database performance after applying constraints

## Troubleshooting

### Constraint Already Exists
If you get an error "constraint already exists", the constraint may have been added manually. You can safely skip it.

### Data Violates Constraint
If a constraint fails due to data violations:
1. Check the validation report for details
2. Fix the data issues (NULLs, duplicates, orphans)
3. Re-run validation
4. Apply constraints again

### Performance Issues
If applying constraints takes too long or locks tables:
- Apply constraints during maintenance windows
- Consider adding indexes first on foreign key columns
- For very large tables, consider batch processing

## Generated Files

All generated files are saved in `AssetLifecycleBackend/migrations/`:

- `database_keys_analysis_report.txt` - Full analysis report
- `add_missing_keys.sql` - SQL script with all constraints
- `constraints_validation_report.txt` - Validation results (after running validate script)

## Need Help?

If you encounter issues:
1. Check the validation report for specific error messages
2. Review the analysis report to understand table structure
3. Fix data issues before retrying
4. Consider applying constraints in smaller batches

## Summary

The process is:
1. ✅ Analyze → Generate report and SQL
2. ✅ Review → Check generated files
3. ✅ Validate → Check data integrity
4. ✅ Fix → Resolve data issues
5. ✅ Apply → Add constraints to database

This ensures your database has proper referential integrity and data consistency!

