const requireAuth = (req, res, next) => {
  // Check whether the user has an active login session
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  // User is authenticated, so continue to the endpoint
  next();
};

module.exports = requireAuth;