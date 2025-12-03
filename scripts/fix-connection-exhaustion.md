# Fix: "Too Many Clients Already" Error in DBeaver

## Immediate Solutions

### Option 1: Close Unused Database Tools (Easiest)
1. **Close all DBeaver windows/tabs** you're not using
2. **Close pgAdmin** if it's open
3. **Disconnect unused connections** in DBeaver:
   - Right-click on database connection → Disconnect
   - Or close DBeaver completely and reopen

### Option 2: Kill Idle Connections (If you can connect)
If you can still connect to the database (even with one connection):

1. **Run this query in DBeaver:**
```sql
-- Kill idle connections older than 5 minutes
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
AND state = 'idle'
AND state_change < now() - interval '5 minutes'
AND pid != pg_backend_pid();
```

2. **Kill idle in transaction connections:**
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
AND state = 'idle in transaction'
AND state_change < now() - interval '2 minutes'
AND pid != pg_backend_pid();
```

### Option 3: Increase PostgreSQL max_connections (Permanent Fix)

**For Windows (if you have admin access):**

1. **Find PostgreSQL config file:**
   - Usually at: `C:\Program Files\PostgreSQL\[version]\data\postgresql.conf`
   - Or check: `SHOW config_file;` in psql

2. **Edit postgresql.conf:**
   ```
   max_connections = 200  # Change from 100 to 200
   ```

3. **Restart PostgreSQL service:**
   ```powershell
   # Run as Administrator
   net stop postgresql-x64-[version]
   net start postgresql-x64-[version]
   ```

**Or using SQL (requires superuser):**
```sql
ALTER SYSTEM SET max_connections = 200;
-- Then restart PostgreSQL service
```

### Option 4: Reduce Application Pool Size

Edit `.env` file:
```env
DB_POOL_MAX=20  # Reduce from 30 to 20
```

Then restart your Node.js server.

### Option 5: Restart PostgreSQL Service

**Windows:**
```powershell
# Run as Administrator
net stop postgresql-x64-[version]
net start postgresql-x64-[version]
```

This will disconnect ALL connections and reset the connection count.

## Why This Happens

- **PostgreSQL max_connections**: 100 (default)
- **Your application pool**: 30 connections
- **DBeaver**: 2-4 connections per open connection
- **pgAdmin**: 1-3 connections per open connection
- **Total**: Can easily exceed 100

## Prevention

1. **Close unused database tools** when not actively using them
2. **Use connection pooling** in DBeaver (Settings → Connections → Connection pooling)
3. **Increase max_connections** to 200 if you frequently use multiple tools
4. **Monitor connections** regularly

## Quick Check

After applying fixes, run:
```sql
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'idle') as idle,
       count(*) FILTER (WHERE state = 'active') as active
FROM pg_stat_activity
WHERE datname = current_database();
```

You should see connections drop after closing tools or killing idle connections.


