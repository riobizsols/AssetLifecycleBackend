const pool = require('./config/db');

async function checkUsers() {
  try {
    const result = await pool.query(`
      SELECT 
        u.emp_int_id,
        u.full_name,
        u.email,
        COUNT(ujr.job_role_id) as role_count
      FROM "tblUsers" u
      LEFT JOIN "tblUserJobRoles" ujr ON u.user_id = ujr.user_id
      WHERE u.int_status = 1
      GROUP BY u.emp_int_id, u.full_name, u.email
      ORDER BY role_count DESC, u.full_name
      LIMIT 10
    `);
    
    console.log('Available users:');
    result.rows.forEach(user => {
      console.log(`- ${user.emp_int_id}: ${user.full_name} (${user.role_count} roles)`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

checkUsers();
