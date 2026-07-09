/**
 * middleware/authMiddleware.js
 * Protects routes that require an authenticated session.
 * The session stores { userId, userEmail } set by authController on login.
 */

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  next();
}

module.exports = { requireAuth };
