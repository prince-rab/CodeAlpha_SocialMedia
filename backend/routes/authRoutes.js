/**
 * Authentication Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

// Register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required.').isLength({ max: 100 }),
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isAlphanumeric('en-US', { ignore: '_' }).withMessage('Username may only contain letters, numbers and underscores.')
      .isLength({ min: 3, max: 30 }),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
  ],
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required.'),
  ],
  authController.login
);

// Logout
router.post('/logout', requireAuth, authController.logout);

// Current user
router.get('/me', requireAuth, authController.me);

module.exports = router;
