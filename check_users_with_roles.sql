-- Query to find users with assigned roles
SELECT 
  u.emp_int_id,
  u.user_id,
  u.full_name,
  u.email,
  COUNT(ujr.job_role_id) as role_count,
  STRING_AGG(jr.text, ', ') as roles
FROM "tblUsers" u
LEFT JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
LEFT JOIN "tblJobRoles" jr ON ujr.job_role_id = jr.job_role_id
WHERE u.int_status = 1
GROUP BY u.emp_int_id, u.user_id, u.full_name, u.email
ORDER BY role_count DESC, u.full_name;

