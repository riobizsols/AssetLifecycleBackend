-- ============================================================
-- KILL IDLE CONNECTIONS - Run this in DBeaver
-- ============================================================

-- 1. First, check current connections
SELECT 
  pid,
  usename,
  application_name,
  state,
  state_change,
  NOW() - state_change as idle_duration,
  LEFT(query, 100) as last_query
FROM pg_stat_activity
WHERE datname = current_database()
AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
AND pid != pg_backend_pid()
ORDER BY state_change ASC;

-- 2. Check connection statistics
SELECT 
  count(*) as total_connections,
  count(*) FILTER (WHERE state = 'active') as active,
  count(*) FILTER (WHERE state = 'idle') as idle,
  count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_trans,
  count(*) FILTER (WHERE state = 'idle in transaction (aborted)') as idle_aborted
FROM pg_stat_activity
WHERE datname = current_database();

-- 3. Kill ALL idle connections (be careful!)
-- Uncomment the line below to execute:
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
-- AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
-- AND pid != pg_backend_pid();

-- 4. Kill only idle connections older than 5 minutes (safer)
-- Uncomment the lines below to execute:
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
-- AND state IN ('idle', 'idle in transaction', 'idle in transaction (aborted)')
-- AND pid != pg_backend_pid()
-- AND state_change < NOW() - INTERVAL '5 minutes';

-- 5. Kill only aborted transactions (safest - these should always be killed)
-- Uncomment the line below to execute:
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
-- AND state = 'idle in transaction (aborted)'
-- AND pid != pg_backend_pid();

-- 6. Kill connections from specific application (e.g., DBeaver)
-- Replace 'DBeaver' with the application name you want to kill
-- Uncomment and modify the lines below:
-- SELECT pg_terminate_backend(pid)
-- FROM pg_stat_activity
-- WHERE datname = current_database()
-- AND application_name LIKE '%DBeaver%'
-- AND state IN ('idle', 'idle in transaction')
-- AND pid != pg_backend_pid();

-- 7. Check max_connections setting
SHOW max_connections;

-- 8. Check current connection count vs max
SELECT 
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as current_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') - 
  (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) as available_connections;
