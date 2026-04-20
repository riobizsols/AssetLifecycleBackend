# Database Creation Scripts

This folder contains scripts for database synchronization and table creation.

## Scripts

### 1. `sync-database-keys.js`
**Purpose**: Synchronizes primary and foreign key relationships from a source database (GENERIC_URL) to a target database (DATABASE_URL).

**Features**:
- Creates missing tables in the target database
- Identifies and applies missing primary keys
- Identifies and applies missing foreign keys
- Automatically fixes orphaned records (sets invalid foreign key values to NULL)
- Generates comprehensive reports

**Usage**:
```bash
# Dry run (preview changes)
node scripts/db\ creation\ script/sync-database-keys.js

# Apply changes automatically
node scripts/db\ creation\ script/sync-database-keys.js --apply
```

**Environment Variables Required**:
- `GENERIC_URL`: Connection string for the source database
- `DATABASE_URL`: Connection string for the target database

### 2. `sync-tblApps-data.js`
**Purpose**: Synchronizes data in the `tblApps` table from the source database to the target database.

**Features**:
- Compares `tblApps` data between source and target
- Inserts missing rows from source to target
- Uses primary key (`app_id`) to identify missing rows

**Usage**:
```bash
node scripts/db\ creation\ script/sync-tblApps-data.js
```

**Environment Variables Required**:
- `GENERIC_URL`: Connection string for the source database
- `DATABASE_URL`: Connection string for the target database

### 3. `check-tables.js`
**Purpose**: Compares tables between source and target databases to identify missing tables.

**Usage**:
```bash
node scripts/db\ creation\ script/check-tables.js
```

### 4. `create-missing-tables.js`
**Purpose**: Creates specific missing tables in the target database (utility script).

**Usage**:
```bash
node scripts/db\ creation\ script/create-missing-tables.js
```

## Workflow

1. **Check for missing tables**: Run `check-tables.js` to see what tables are missing
2. **Sync database keys**: Run `sync-database-keys.js --apply` to:
   - Create all missing tables
   - Apply all primary keys
   - Apply all foreign keys
3. **Sync tblApps data**: Run `sync-tblApps-data.js` to ensure all app entries are present

## Reports

The `sync-database-keys.js` script generates comprehensive reports in the `migrations/` folder with the naming pattern:
- `sync_keys_report_[timestamp].txt`

Reports include:
- Executive summary
- Table creation results
- Primary key application results
- Foreign key application results
- Orphaned record fixes
- Detailed error information

## Notes

- Always run in dry-run mode first to preview changes
- Ensure both databases are accessible before running scripts
- Backup your target database before applying changes
- The scripts handle data inconsistencies automatically (orphaned records are set to NULL)
