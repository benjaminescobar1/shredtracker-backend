const express = require('express');
const router = express.Router();

const { loginUser } = require('../controllers/sessionController');

// Login endpoint
router.post('/', loginUser);

// Check whether a user is logged in
router.get('/', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Not authenticated'
    });
  }

  return res.status(200).json({
    message: 'Session is active',
    user_id: req.session.userId
  });
});

// Log out the current user
router.delete('/', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        error: 'Failed to log out'
      });
    }

    res.clearCookie('shredtracker.sid');

    return res.status(200).json({
      message: 'Logout successful'
    });
  });
});

module.exports = router;