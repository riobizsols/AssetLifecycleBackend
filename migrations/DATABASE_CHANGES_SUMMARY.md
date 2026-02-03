# Database Changes Summary - Lifecycle to Hospitality

This document lists all database changes made to the lifecycle database that need to be applied to the hospitality database.

## Date: Recent Changes (Yesterday/Today)

---

## 1. Scrap Workflow Tables (NEW)

### Tables Created:
- **tblWFScrapSeq** - Workflow scrap sequences configuration
- **tblWFScrap_H** - Workflow scrap headers
- **tblWFScrap_D** - Workflow scrap details (approval steps)
- **tblAssetScrap** - Asset scrap records

### Purpose:
Implements a complete scrap maintenance workflow system similar to asset maintenance workflows, allowing assets to go through approval processes before being scrapped.

### Key Columns:
- `tblWFScrapSeq`: Links asset types to workflow steps
- `tblWFScrap_H`: Main workflow header with status tracking
- `tblWFScrap_D`: Individual approval steps with job roles and departments
- `tblAssetScrap`: Final scrap records linking assets to groups

---

## 2. Asset Types - Scrap Approval Flag

### Change:
Added `require_scrap_approval` column to `tblAssetTypes`

### Details:
- **Column**: `require_scrap_approval BOOLEAN NOT NULL DEFAULT true`
- **Purpose**: Controls whether assets of this type require workflow approval before scrapping
- **Default**: `true` (all existing asset types will require approval)

### Impact:
- If `require_scrap_approval = true`: Assets go through workflow
- If `require_scrap_approval = false`: Assets are scrapped directly without workflow

---

## 3. Assets - Scrap Metadata Columns

### Changes:
Added three columns to `tblAssets`:

1. **scrap_notes** (TEXT)
   - Notes about why the asset was scrapped

2. **scraped_on** (TIMESTAMP)
   - Date/time when the asset was scrapped

3. **scraped_by** (VARCHAR(50))
   - User ID who scrapped the asset

### Purpose:
Track scrap metadata for audit and reporting purposes.

---

## 4. Status Codes Table (NEW)

### Table Created:
- **tblStatusCodes** - Centralized status code definitions

### Structure:
- `id` (BIGSERIAL, PK)
- `status_code` (VARCHAR(3), UNIQUE) - Code like 'IN', 'CO', etc.
- `text` (VARCHAR(50)) - Human-readable text like 'Initiated', 'Completed'

### Default Status Codes Seeded:
- `IN` - Initiated
- `PEN` - Pending
- `IP` - In Progress
- `CO` - Completed
- `CA` - Cancelled

### Purpose:
Centralized status management for consistent display across the application.

---

## 5. Foreign Key Constraint Removal

### Change:
Dropped foreign key constraint `fk_wf_scrap_h_assetgroup` from `tblWFScrap_H.assetgroup_id`

### Reason:
Allows using internal/virtual group IDs (like `SCRAP_INDIVIDUAL_*`) for individual asset scraps that don't exist in `tblAssetGroup_H`.

### Impact:
- Individual asset scraps can use virtual group IDs
- Grouped asset scraps still use real group IDs
- No data integrity issues as the constraint was preventing valid use cases

---

## 6. ID Sequence Updates

### Changes:
Added entries to `tblIDSequences` (if table exists):

- `wfscrapseq` → Prefix: `WFSCQ`
- `wfscrap_h` → Prefix: `WFSCH`
- `wfscrap_d` → Prefix: `WFSCD`
- `asset_scrap` → Prefix: `ASCP`
- `asset_scrap_det` → Prefix: `ASD` (seeded from existing data if available)

### Purpose:
Enables automatic ID generation for new scrap workflow records.

---

## How to Apply Changes

### Option 1: Run SQL Script (Recommended)
```bash
# Connect to hospitality database and run:
psql -h <host> -U <user> -d <hospitality_db> -f migrations/apply_all_changes_to_hospitality.sql
```

### Option 2: Run Individual Migration Scripts
```bash
# Run each migration script in order:
node migrations/createWFScrapTablesStandalone.js
node migrations/addRequireScrapApprovalToAssetTypesStandalone.js
node migrations/addScrapColumnsToTblAssetsStandalone.js
node migrations/createStatusCodesTableStandalone.js
node migrations/dropWFScrapHAssetGroupFKStandalone.js
```

**Note**: Make sure to update `.env` file to point to hospitality database before running Node.js scripts.

---

## Verification

After applying changes, verify:

1. ✅ All 4 scrap workflow tables exist
2. ✅ `tblAssetTypes.require_scrap_approval` column exists (default: true)
3. ✅ `tblAssets` has `scrap_notes`, `scraped_on`, `scraped_by` columns
4. ✅ `tblStatusCodes` table exists with 5 default status codes
5. ✅ Foreign key constraint `fk_wf_scrap_h_assetgroup` is removed from `tblWFScrap_H`
6. ✅ `tblIDSequences` has entries for scrap workflow tables (if table exists)

---

## Rollback (if needed)

If you need to rollback these changes:

```sql
-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS "tblAssetScrap" CASCADE;
DROP TABLE IF EXISTS "tblWFScrap_D" CASCADE;
DROP TABLE IF EXISTS "tblWFScrap_H" CASCADE;
DROP TABLE IF EXISTS "tblWFScrapSeq" CASCADE;
DROP TABLE IF EXISTS "tblStatusCodes" CASCADE;

-- Remove columns
ALTER TABLE "tblAssets" DROP COLUMN IF EXISTS scrap_notes;
ALTER TABLE "tblAssets" DROP COLUMN IF EXISTS scraped_on;
ALTER TABLE "tblAssets" DROP COLUMN IF EXISTS scraped_by;
ALTER TABLE "tblAssetTypes" DROP COLUMN IF EXISTS require_scrap_approval;

-- Remove ID sequence entries (if needed)
DELETE FROM "tblIDSequences" WHERE table_key IN ('wfscrapseq', 'wfscrap_h', 'wfscrap_d', 'asset_scrap', 'asset_scrap_det');
```

---

## Notes

- All migrations are idempotent (safe to run multiple times)
- Foreign key constraints reference existing tables (tblAssetTypes, tblWFSteps, tblOrgs, etc.)
- Default values are set for all new columns
- Indexes are created for performance
- Status codes are seeded automatically
