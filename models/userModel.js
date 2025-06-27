const db = require('../config/db');

//  Find user by email (used for login)
const findUserByEmail = async (email) => {
    const result = await db.query(
        'SELECT * FROM tblUsers WHERE email = $1',
        [email]
    );
    return result.rows[0];
};

// Create user — called by super_admin
const createUser = async ({
    ext_id,
    org_id,
    user_id,
    full_name,
    email,
    phone,
    job_role_id,
    password,
    created_by,
    time_zone
}) => {
    const result = await db.query(
        `INSERT INTO tblUsers (
            ext_id, org_id, user_id,
            full_name, email, phone,
            job_role_id, password,
            created_by, created_on,
            changed_by, changed_on,
            time_zone
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6,
            $7, $8,
            $9, CURRENT_DATE,
            $9, CURRENT_DATE,
            $10
        ) RETURNING *`,
        [
            ext_id,      
            org_id,     
            user_id,    
            full_name,    
            email,        
            phone,        
            job_role_id,  
            password,     
            created_by,   
            time_zone || 'IST' 
        ]
    );

    return result.rows[0];
};



// Set reset token for password reset
const setResetToken = async (email, token, expiry) => {
    await db.query(
        `UPDATE tblUsers
         SET reset_token = $1, reset_token_expiry = $2
         WHERE email = $3`,
        [token, expiry, email]
    );
};

// Find user by valid reset token
const findUserByResetToken = async (token) => {
    const result = await db.query(
        `SELECT * FROM tblUsers
         WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
        [token]
    );
    return result.rows[0];
};

// Update user password after reset
const updatePassword = async ({ ext_id, org_id, user_id }, hashedPassword, changed_by) => {
    await db.query(
        `UPDATE tblUsers
         SET password = $1,
             reset_token = NULL,
             reset_token_expiry = NULL,
             changed_by = $2,
             changed_on = CURRENT_DATE
         WHERE ext_id = $3 AND org_id = $4 AND user_id = $5`,
        [hashedPassword, changed_by, ext_id, org_id, user_id]
    );
};


module.exports = {
    findUserByEmail,
    createUser,
    setResetToken,
    findUserByResetToken,
    updatePassword,
};














