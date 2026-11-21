const db = require('../db');
const bcrypt = require('bcrypt');

const createUser = async (name, email, password) => {
  // Hash the password before saving it
  const passwordHash = await bcrypt.hash(password, 12);

  // Save the user to MySQL
  const [result] = await db.query(
    'INSERT INTO User (name, email, password_hash) VALUES (?, ?, ?)',
    [name, email, passwordHash]
  );

  // Return user information without the password
  return {
    user_id: result.insertId,
    name,
    email
  };
};

module.exports = { createUser };