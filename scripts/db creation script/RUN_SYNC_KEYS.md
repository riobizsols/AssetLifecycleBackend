# How to Run Database Key Synchronization Script

## Prerequisites

1. **Set Environment Variables** in `.env` file:
   ```env
   GENERIC_URL=postgresql://username:password@host:port/generic_database
   DATABASE_URL=postgresql://username:password@host:port/target_database
   ```

2. **Navigate to Backend Directory**:
   ```bash
   cd AssetLifecycleBackend
   ```

## Running the Script

### Option 1: Normal Mode (with confirmation prompts)
```bash
node scripts/sync-database-keys.js
```
- Shows what will be changed
- Asks for confirmation before applying
- Safe for first-time use

### Option 2: Auto-Apply Mode (no prompts)
```bash
node scripts/sync-database-keys.js --apply
```
- Automatically applies all changes
- No confirmation prompts
- Use when you're confident about the changes

### Option 3: Dry Run Mode (preview only)
```bash
node scripts/sync-database-keys.js --dry-run
```
- Shows what would be changed
- Does NOT apply any changes
- Good for testing/preview

## What the Script Does

1. ✅ Connects to both databases (GENERIC_URL and DATABASE_URL)
2. ✅ Creates missing tables in target database
3. ✅ Analyzes all tables for missing primary keys and foreign keys
4. ✅ Fixes orphaned records (sets invalid foreign keys to NULL)
5. ✅ Applies missing constraints
6. ✅ Generates comprehensive report

## Output Files

After running, you'll find:

1. **Report File**: `migrations/sync_keys_report_[timestamp].txt`
   - Complete details of what was done
   - Statistics and recommendations

2. **SQL File**: `migrations/sync_keys_[timestamp].sql`
   - All SQL statements that were/would be executed
   - Can be reviewed or run manually

3. **Progress Log**: `sync_progress.log` (if run with Tee-Object)
   - Real-time progress log

## Example Commands

### Windows PowerShell:
```powershell
cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
node scripts/sync-database-keys.js --apply
```

### With Progress Logging:
```powershell
cd C:\Users\RIO\Desktop\work\AssetLifecycleBackend
node scripts/sync-database-keys.js --apply 2>&1 | Tee-Object -FilePath "sync_progress.log"
```

### Linux/Mac:
```bash
cd AssetLifecycleBackend
node scripts/sync-database-keys.js --apply
```

## Monitoring Progress

While the script runs, you'll see:
- Real-time logs with timestamps
- Table analysis progress: `[X/67] Analyzing table: tblXxx...`
- Foreign key validation status
- Orphaned record fixes
- Constraint application results

## Troubleshooting

### Error: "GENERIC_URL is not set"
- Make sure `.env` file exists in `AssetLifecycleBackend` directory
- Check that `GENERIC_URL` and `DATABASE_URL` are set correctly

### Error: "Connection failed"
- Verify database credentials
- Check network connectivity
- Ensure databases are accessible

### Script takes too long
- Normal for large databases (67 tables)
- Check `sync_progress.log` for current status
- Script processes tables sequentially for accuracy

## Quick Start

```bash
# 1. Navigate to backend
cd AssetLifecycleBackend

# 2. Run with auto-apply
node scripts/sync-database-keys.js --apply

# 3. Check the report when done
# Report will be in: migrations/sync_keys_report_[timestamp].txt
```
