const bcrypt = require('bcrypt');

const plainPassword = 'Admin@123'; // replace this with the real password
const saltRounds = 10;

bcrypt.hash(plainPassword, saltRounds, function(err, hash) {
    if (err) throw err;
    console.log('Hashed password:', hash);
});