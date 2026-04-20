# Database Key Synchronization Guide

This guide explains how to use the `sync-database-keys.js` script to synchronize primary key and foreign key constraints from a generic database to other databases.

## Overview

The script compares the primary keys and foreign keys in your `GENERIC_URL` database (source) with your `DATABASE_URL` database (target) and applies any missing constraints to the target database.

## Prerequisites

1. **Environment Variables**: Set the following in your `.env` file:
   - `GENERIC_URL`: The source database URL with correct keys
   - `DATABASE_URL`: The target database URL that needs keys

2. **Database Access**: Ensure you have read access to `GENERIC_URL` and read/write access to `DATABASE_URL`.

3. **Node.js**: The script requires Node.js and the `pg` package (already included in the project).

## Usage

### Basic Usage

```bash
# Navigate to the backend directory
cd AssetLifecycleBackend

# Run the script
node scripts/sync-database-keys.js
```

### Dry Run Mode

To see what changes would be made without applying them:

```bash
node scripts/sync-database-keys.js --dry-run
```

### Auto-Apply Mode

To automatically apply changes without confirmation prompt:

```bash
node scripts/sync-database-keys.js --apply
```

## How It Works

1. **Connection**: Connects to both `GENERIC_URL` (source) and `DATABASE_URL` (target) databases.

2. **Analysis**: 
   - Extracts all primary keys and foreign keys from the source database
   - Compares with the target database to find missing constraints

3. **Validation**:
   - Checks for NULL values in primary key columns
   - Checks for duplicate values in primary key columns
   - Checks for orphaned records in foreign key columns
   - Validates that referenced tables and columns exist

4. **SQL Generation**: Generates SQL statements for missing constraints and saves them to a file in the `migrations/` directory.

5. **Application**: 
   - If not in dry-run mode, prompts for confirmation (unless `--apply` flag is used)
   - Applies the constraints to the target database
   - Reports success/failure for each constraint

## Output

The script provides:

1. **Console Output**:
   - Connection status
   - Analysis progress
   - Summary of missing constraints
   - Validation errors (if any)
   - Application results

2. **SQL File**: 
   - Saved to `migrations/sync_keys_[timestamp].sql`
   - Contains all SQL statements wrapped in a transaction
   - Can be reviewed and applied manually if needed

## Example Output

```
================================================================================
DATABASE KEY SYNCHRONIZATION SCRIPT
================================================================================

📡 Connecting to databases...
  ✅ Connected to GENERIC_URL (source database)
  ✅ Connected to DATABASE_URL (target database)

📋 Analyzing database schemas...
  Source (GENERIC_URL): 66 tables
  Target (DATABASE_URL): 66 tables

📊 Found 66 common tables to analyze

🔍 Analyzing table: tblAssets...
🔍 Analyzing table: tblVendors...
...

================================================================================
SYNCHRONIZATION SUMMARY
================================================================================
Missing Primary Keys: 2
Missing Foreign Keys: 15
Validation Errors: 0
================================================================================

📝 Generating PRIMARY KEY constraints...
  - tblAssetDocs: a_d_id
  - tblVendorDocs: vd_id

📝 Generating FOREIGN KEY constraints...
  - tblAssetDocs.org_id -> tblOrgs.org_id
  - tblVendorDocs.vendor_id -> tblVendors.vendor_id
...

💾 SQL script saved to: migrations/sync_keys_1234567890.sql

⚠️  Ready to apply changes to target database.
Do you want to apply these changes? (y/n): y

🚀 Applying changes to target database...

  ✅ Applying: PRIMARY KEY on tblAssetDocs (a_d_id)
  ✅ Applying: FOREIGN KEY tblAssetDocs.org_id -> tblOrgs.org_id
  ...

================================================================================
APPLICATION RESULTS
================================================================================
✅ Successful: 17
❌ Failed: 0
================================================================================
```

## Validation Errors

If the script finds validation errors, it will:

1. **Report them** in the console output
2. **Skip those constraints** (they won't be added)
3. **Require manual intervention** to fix data issues

Common validation errors:

- **NULL values in primary key columns**: Remove NULL values or update them
- **Duplicate values in primary key columns**: Remove duplicates or update them
- **Orphaned foreign key records**: Update or delete records that reference non-existent values

## Using for Multiple Databases

To sync keys to multiple databases:

1. **Update `.env`**: Change `DATABASE_URL` to point to the next target database
2. **Run the script**: Execute `node scripts/sync-database-keys.js`
3. **Repeat**: For each additional database

Example workflow:

```bash
# Database 1
export DATABASE_URL=postgresql://user:pass@host:5432/db1
node scripts/sync-database-keys.js --apply

# Database 2
export DATABASE_URL=postgresql://user:pass@host:5432/db2
node scripts/sync-database-keys.js --apply

# Database 3
export DATABASE_URL=postgresql://user:pass@host:5432/db3
node scripts/sync-database-keys.js --apply
```

## Safety Features

1. **Transaction Wrapping**: SQL statements are wrapped in a transaction (in the generated file)
2. **Validation**: Data is validated before constraints are added
3. **Dry Run**: Test without making changes using `--dry-run`
4. **Confirmation Prompt**: Requires user confirmation before applying (unless `--apply` is used)
5. **Error Handling**: Failed constraints are reported but don't stop the script
6. **SQL File**: Always generates a SQL file for manual review/application

## Troubleshooting

### Connection Errors

- **Check `.env` file**: Ensure `GENERIC_URL` and `DATABASE_URL` are set correctly
- **Check database credentials**: Verify username, password, host, and port
- **Check network access**: Ensure the databases are accessible from your machine

### Validation Errors

- **Fix data issues**: Update or delete records that violate constraints
- **Review orphaned records**: Check foreign key references and update them
- **Remove NULLs**: Update NULL values in primary key columns

### Constraint Application Failures

- **Check SQL file**: Review the generated SQL file for syntax errors
- **Check permissions**: Ensure the database user has ALTER TABLE permissions
- **Check existing constraints**: Some constraints might already exist with different names

## Best Practices

1. **Backup First**: Always backup your target database before running the script
2. **Test on Development**: Test the script on a development database first
3. **Review SQL File**: Always review the generated SQL file before applying
4. **Use Dry Run**: Use `--dry-run` first to see what will change
5. **Fix Validation Errors**: Address data issues before applying constraints
6. **Monitor Application**: Watch the console output for any failures

## Notes

- The script only processes tables that start with `tbl` (your table naming convention)
- Constraints are applied in the order they are found (primary keys first, then foreign keys)
- The script preserves constraint names from the source database when possible
- Foreign key rules (ON DELETE, ON UPDATE) are copied from the source database
