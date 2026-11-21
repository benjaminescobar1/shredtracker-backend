const db = require('../db');
const bcrypt = require('bcrypt');

const authenticateUser = async (email, password) => {
  // Find the user by email
  const [rows] = await db.query(
    'SELECT user_id, name, email, password_hash FROM User WHERE email = ?',
    [email]
  );

  // Check whether the user exists
  if (rows.length === 0) {
    return null;
  }

  const user = rows[0];

  // Compare the entered password with the stored hash
  const passwordMatches = await bcrypt.compare(
    password,
    user.password_hash
  );

  // Reject incorrect passwords
  if (!passwordMatches) {
    return null;
  }

  // Return user information without the password hash
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email
  };
};

module.exports = { authenticateUser };