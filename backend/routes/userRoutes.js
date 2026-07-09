/**
 * User Routes
 * GET /api/users
 * GET /api/users/:id
 * PUT /api/users/:id
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, userController.getAll);
router.get('/:id', requireAuth, userController.getById);
router.put(
  '/:id',
  requireAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.').isLength({ max: 100 }),
    body('bio').optional().isLength({ max: 300 }).withMessage('Bio cannot exceed 300 characters.'),
  ],
  userController.update
);
router.delete('/:id', requireAuth, userController.delete);

module.exports = router;
