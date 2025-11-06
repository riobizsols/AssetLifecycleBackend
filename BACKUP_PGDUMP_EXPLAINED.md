# How pg_dump is Used in the Backup Script

## 🎯 Overview

`pg_dump` is PostgreSQL's native backup utility that creates a complete dump of your database. This document explains exactly how it's used in our backup script.

---

## 📍 Location in Code

The `pg_dump` command is executed in the `createBackup()` function in `scripts/backup-database.js` (lines 192-276).

---

## 🔧 Step-by-Step Process

### Step 1: Find pg_dump Executable

**Function:** `findPgDump()` (lines 111-158)

```javascript
// First checks if pg_dump is in system PATH
// If not found, searches common PostgreSQL installation locations:
// Windows: C:\Program Files\PostgreSQL\18\bin\pg_dump.exe
// Linux: /usr/bin/pg_dump or /usr/local/bin/pg_dump
```

**Result:** Returns full path to `pg_dump` executable

### Step 2: Parse Database Connection Details

**From:** `DATABASE_URL` environment variable

```javascript
// Example: postgresql://user:password@host:port/database
// Parsed into:
{
  user: 'postgres',
  password: 'password123',
  host: '103.73.190.251',
  port: '5432',
  database: 'assetLifecycle'
}
```

### Step 3: Build pg_dump Command

**Command Construction (lines 217-222):**

```javascript
// Default command (with compression - custom format)
let dumpCommand = `"${pgDumpPath}" -h ${host} -p ${port} -U ${user} -d ${database} -F c -f "${outputFile}"`;

// Example actual command:
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 103.73.190.251 -p 5432 -U postgres -d assetLifecycle -F c -f "backups\postgresql\assetLifecycle_2025-11-05_14-29-47.sql"
```

### Step 4: Set Environment Variables

**Password Handling (lines 203-206):**

```javascript
// Set PGPASSWORD environment variable (pg_dump uses this for authentication)
const env = {
  ...process.env,
  PGPASSWORD: config.dbConfig.password,  // Password never exposed in command line
};
```

**Why?** Password is never visible in command line (security best practice)

### Step 5: Execute pg_dump

**Execution (line 227):**

```javascript
const { stdout, stderr } = await execAsync(dumpCommand, { env });
```

---

## 📝 pg_dump Command Parameters Explained

### Full Command Breakdown:

```bash
pg_dump [OPTIONS] DATABASE_NAME
```

### Our Command Parameters:

| Parameter | Value | Explanation |
|-----------|-------|-------------|
| `-h` | `103.73.190.251` | **Host:** Database server hostname/IP |
| `-p` | `5432` | **Port:** PostgreSQL port number |
| `-U` | `postgres` | **User:** Database username |
| `-d` | `assetLifecycle` | **Database:** Database name to backup |
| `-F c` | (custom format) | **Format:** Creates compressed binary format |
| `-f` | `"backup.sql"` | **File:** Output file path |

### Format Options:

#### **`-F c` (Custom Format - Default in our script):**
```bash
-F c  # Custom format (compressed, binary)
```
- ✅ **Compressed** by default (saves space)
- ✅ **Faster** restore with `pg_restore`
- ✅ **Selective restore** (can restore specific tables)
- ✅ **Binary format** (not human-readable)

#### **`-F p` (Plain SQL Format - if compression disabled):**
```bash
-F p  # Plain SQL text format
```
- ✅ **Human-readable** SQL text
- ✅ **Can be edited** before restore
- ❌ **Not compressed** (larger files)
- ❌ **Slower** restore

---

## 🔐 Security Features

### Password Handling:

```javascript
// ❌ BAD (password in command line - visible in process list)
pg_dump -h host -U user -W password -d database

// ✅ GOOD (password via environment variable)
process.env.PGPASSWORD = 'password';
pg_dump -h host -U user -d database
```

**Our Implementation:**
```javascript
const env = {
  ...process.env,
  PGPASSWORD: config.dbConfig.password,  // Secure
};
await execAsync(dumpCommand, { env });
```

### Command Line Security:

```javascript
// Log command with password hidden
log(`Executing: ${dumpCommand.replace(config.dbConfig.password, '***')}`);
```

---

## 📊 Actual Command Example

### What Gets Executed:

**Windows:**
```powershell
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" `
  -h 103.73.190.251 `
  -p 5432 `
  -U postgres `
  -d assetLifecycle `
  -F c `
  -f "backups\postgresql\assetLifecycle_2025-11-05_14-29-47.sql"
```

**Linux/Ubuntu:**
```bash
/usr/bin/pg_dump \
  -h 103.73.190.251 \
  -p 5432 \
  -U postgres \
  -d assetLifecycle \
  -F c \
  -f "/var/backups/postgresql/assetLifecycle_2025-11-05_02-00-00.sql"
```

### Environment Variable:
```bash
PGPASSWORD=your_secure_password_here
```

---

## 🔄 Complete Flow Diagram

```
1. Script Starts
   ↓
2. Parse DATABASE_URL
   → Extract: user, password, host, port, database
   ↓
3. Find pg_dump Executable
   → Search PATH
   → Search common locations
   → Return full path
   ↓
4. Build Command
   → pg_dump -h host -p port -U user -d database -F c -f output.sql
   ↓
5. Set PGPASSWORD Environment Variable
   → process.env.PGPASSWORD = password
   ↓
6. Execute pg_dump
   → child_process.execAsync(command, { env })
   ↓
7. pg_dump Connects to Database
   → Uses provided credentials
   → Reads all tables, data, schema
   ↓
8. pg_dump Creates Backup File
   → Compressed binary format
   → Contains complete database dump
   ↓
9. Script Continues
   → Calculate checksum
   → Upload to remote server (if enabled)
   → Cleanup old backups
```

---

## 📦 What pg_dump Creates

### Backup File Contents:

1. **Schema (Structure):**
   - All tables with columns
   - Indexes
   - Constraints (primary keys, foreign keys)
   - Triggers
   - Functions
   - Views
   - Sequences

2. **Data:**
   - All rows from all tables
   - Complete data (not incremental)

3. **Metadata:**
   - Database encoding
   - Extensions
   - Permissions
   - Comments

### File Format (Custom Format):

```
Custom Format Backup File Structure:
├── Header (database info, version)
├── Table of Contents (TOC)
│   ├── Table 1 structure
│   ├── Table 1 data
│   ├── Table 2 structure
│   ├── Table 2 data
│   └── ...
└── Footer (checksums)
```

---

## 🎛️ Configuration Options

### Current Configuration:

```javascript
// From .env or defaults
config.compression = true   // Uses -F c (custom, compressed)
config.dbConfig = {
  host: '103.73.190.251',
  port: '5432',
  user: 'postgres',
  database: 'assetLifecycle'
}
```

### Command Variations:

**With Compression (Default):**
```bash
pg_dump -h host -p port -U user -d database -F c -f backup.sql
# Result: Compressed binary file
```

**Without Compression:**
```bash
pg_dump -h host -p port -U user -d database -F p -f backup.sql
# Result: Plain SQL text file
```

**With Custom Compression Level:**
```bash
# Note: pg_dump custom format (-F c) always compresses
# Additional compression happens after with gzip (if enabled)
```

---

## 🔍 Verification

### Check Backup Contents:

```bash
# List what's in the backup
pg_restore --list backup.sql

# Example output:
# ; Archive created at 2025-11-05 14:29:47
# ;     dbname: assetLifecycle
# ;     TOC Entries: 371
# ;     Compression: gzip
# ;     Format: CUSTOM
# ...
```

### Verify Backup Integrity:

```bash
# Try to list backup contents (will fail if corrupted)
pg_restore --list backup.sql

# If successful, backup is valid
```

---

## 🚀 Performance

### Backup Speed:

- **Small DB (<1GB):** ~30 seconds
- **Medium DB (1-10GB):** ~2-5 minutes
- **Large DB (>10GB):** Depends on hardware

### Factors Affecting Speed:

1. **Database Size:** More data = longer backup
2. **Network Latency:** Remote database = slower
3. **Disk I/O:** Faster disk = faster backup
4. **Compression:** Custom format compresses on-the-fly

---

## 📚 Additional pg_dump Options (Not Used, But Available)

### Could Add These Options:

```bash
# Backup only schema (no data)
pg_dump -s ...

# Backup only data (no schema)
pg_dump -a ...

# Backup specific tables only
pg_dump -t table1 -t table2 ...

# Exclude specific tables
pg_dump -T table1 ...

# Verbose output
pg_dump -v ...

# Show progress
pg_dump --verbose --progress ...
```

---

## 🔗 How It Connects

### Connection Flow:

```
1. pg_dump reads connection parameters
   ↓
2. Connects to PostgreSQL server
   ↓
3. Authenticates using username + PGPASSWORD
   ↓
4. Reads database catalog
   ↓
5. Reads all tables and data
   ↓
6. Writes to output file
   ↓
7. Closes connection
```

### Connection String Equivalent:

```javascript
// Our pg_dump command is equivalent to:
// postgresql://postgres:password@103.73.190.251:5432/assetLifecycle

// But pg_dump doesn't support connection strings directly,
// so we use individual parameters: -h, -p, -U, -d
```

---

## ✅ Summary

**pg_dump is used to:**
1. ✅ Connect to PostgreSQL database
2. ✅ Read complete database structure
3. ✅ Read all data from all tables
4. ✅ Create compressed backup file
5. ✅ Include all metadata (indexes, constraints, etc.)

**Our Implementation:**
- ✅ Automatically finds `pg_dump` executable
- ✅ Securely handles passwords (via environment variable)
- ✅ Uses custom format (compressed, efficient)
- ✅ Logs all operations
- ✅ Handles errors gracefully

**The backup file contains:**
- ✅ Complete database structure
- ✅ All data from all tables
- ✅ Indexes, constraints, triggers
- ✅ Functions and stored procedures
- ✅ Everything needed for full restore


