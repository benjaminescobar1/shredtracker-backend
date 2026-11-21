const { createUser } = require('../services/userService');

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Name, email, and password are required'
      });
    }

    // Validate input lengths
    if (
      name.length > 100 ||
      email.length > 255 ||
      password.length < 8 ||
      password.length > 72
    ) {
      return res.status(400).json({
        error: 'Invalid name, email, or password length'
      });
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Create the user in MySQL
    const user = await createUser(
      name.trim(),
      email.trim().toLowerCase(),
      password
    );

    return res.status(201).json({
      message: 'User registered successfully',
      user
    });

  } catch (error) {
    // Duplicate email address
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        error: 'Email is already registered'
      });
    }

    console.error('Registration error:', error);

    return res.status(500).json({
      error: 'Failed to register user'
    });
  }
};

module.exports = { registerUser };