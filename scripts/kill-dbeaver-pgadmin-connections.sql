-- ============================================================
-- KILL IDLE DBEAVER AND PGADMIN CONNECTIONS
-- Run this in DBeaver to free up connections
-- ============================================================

-- 1. First, see what will be killed (preview)
SELECT 
  pid,
  usename,
  application_name,
  state,
  state_change,
  NOW() - state_change as idle_duration
FROM pg_stat_activity
WHERE datname = current_database()
AND (
  application_name LIKE '%DBeaver%' 
  OR application_name LIKE '%pgAdmin%'
)
AND state IN ('idle', 'idle in transaction')
AND pid != pg_backend_pid()
ORDER BY state_change ASC;

-- 2. Kill all idle DBeaver and pgAdmin connections
-- This will free up connections immediately
SELECT 
  pid,
  application_name,
  pg_terminate_backend(pid) as terminated
FROM pg_stat_activity
WHERE datname = current_database()
AND (
  application_name LIKE '%DBeaver%' 
  OR application_name LIKE '%pgAdmin%'
)
AND state IN ('idle', 'idle in transaction')
AND pid != pg_backend_pid();

-- 3. Verify connections were killed
SELECT 
  count(*) as remaining_idle_connections
FROM pg_stat_activity
WHERE datname = current_database()
AND (
  application_name LIKE '%DBeaver%' 
  OR application_name LIKE '%pgAdmin%'
)
AND state IN ('idle', 'idle in transaction')
AND pid != pg_backend_pid();

-- 4. Check total connections now
SELECT 
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as current_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') - 
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as available_connections;

