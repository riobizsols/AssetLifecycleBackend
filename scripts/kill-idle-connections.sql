-- Script to kill idle connections and free up database connections
-- Run this in DBeaver or psql when you can connect

-- 1. Check current connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    state_change,
    now() - state_change as idle_duration,
    LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE datname = current_database()
ORDER BY state_change;

-- 2. Kill idle connections (older than 5 minutes)
-- WARNING: This will disconnect users! Only run if necessary
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
AND state = 'idle'
AND state_change < now() - interval '5 minutes'
AND pid != pg_backend_pid(); -- Don't kill your own connection

-- 3. Kill idle in transaction connections (potential leaks)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
AND state = 'idle in transaction'
AND state_change < now() - interval '2 minutes'
AND pid != pg_backend_pid();

-- 4. Check max_connections setting
SHOW max_connections;

-- 5. Increase max_connections (requires superuser and restart)
-- ALTER SYSTEM SET max_connections = 200;
-- Then restart PostgreSQL service


