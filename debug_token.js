const jwt = require('jsonwebtoken');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiJPUkcwMDEiLCJ1c2VyX2lkIjoiVVNSMDAzIiwiZW1haWwiOiJuaXZldGhha2FsaXlhcHBhbkBnbWFpbC5jb20iLCJqb2Jfcm9sZV9pZCI6ImFkbWluL0RQVDIwMiIsImVtcF9pbnRfaWQiOiJFTVBfSU5UXzAwMDMiLCJ1c2VfZGVmYXVsdF9kYiI6dHJ1ZSwiaWF0IjoxNzY2MjIzMzg5LCJleHAiOjE3NjY4MjgxODl9.TGzHGsfbE9XkKIKCAxYB_njZKgroivfdpa1k93rLuIw';

try {
  const decoded = jwt.decode(token);
  console.log('Decoded Token:');
  console.log(JSON.stringify(decoded, null, 2));
  console.log('\nUser Context:');
  console.log('org_id:', decoded.org_id);
  console.log('emp_int_id:', decoded.emp_int_id);
  console.log('dept_id:', decoded.job_role_id?.split('/')[1] || 'Not found');
} catch (e) {
  console.log('Error:', e.message);
}

