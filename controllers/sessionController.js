const { authenticateUser } = require('../services/sessionService');

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    // Validate login information
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    // Verify credentials using the service
    const user = await authenticateUser(
      email.trim().toLowerCase(),
      password
    );

    // Reject invalid credentials
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

// Regenerate the session after successful login
req.session.regenerate((error) => {
  if (error) {
    console.error('Session error:', error);
    return res.status(500).json({
      error: 'Failed to create session'
    });
  }

  // Store the authenticated user's ID
  req.session.userId = user.user_id;

  // Save the session before responding
  req.session.save((error) => {
    if (error) {
      console.error('Session save error:', error);
      return res.status(500).json({
        error: 'Failed to save session'
      });
    }

    return res.status(200).json({
      message: 'Login successful',
      user
    });
  });
});

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      error: 'Failed to log in'
    });
  }
};

module.exports = { loginUser };