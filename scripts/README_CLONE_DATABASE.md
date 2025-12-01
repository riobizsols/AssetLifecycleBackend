# Clone Database for Hospital

This script clones your source database and creates a new database with only `tblUsers` and `tblEmployees` data.

## Usage

```bash
node scripts/cloneDatabaseForHospital.js <hospital-name>
```

## Example

```bash
node scripts/cloneDatabaseForHospital.js "apollo-hospital"
```

This will create a database named `apollo_hospital` (sanitized).

## What it does

1. **Creates a new database** with the hospital name
2. **Copies all table structures** from the source database
3. **Copies data** from `tblUsers` and `tblEmployees` only
4. **Leaves other tables empty** (structure only)

## Requirements

- PostgreSQL database access
- `DATABASE_URL` configured in `.env` file
- Source database must exist and be accessible

## Output

The script will:
- Show progress for each step
- Display the new database URL at the end
- Ask for confirmation if database already exists

## New Database URL Format

```
postgresql://user:password@host:port/hospital_name
```

## Notes

- The hospital name will be sanitized (lowercase, underscores instead of spaces/special chars)
- If the database already exists, you'll be prompted to drop and recreate it
- All sequences are reset to start from 1
- Primary keys and constraints are copied

