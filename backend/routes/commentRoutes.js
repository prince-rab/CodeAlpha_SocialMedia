/**
 * Comment Routes
 * GET    /api/comments/:postId
 * POST   /api/comments
 * PUT    /api/comments/:id
 * DELETE /api/comments/:id
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const commentController = require('../controllers/commentController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/:postId', requireAuth, commentController.getByPost);

router.post(
  '/',
  requireAuth,
  [
    body('post_id').notEmpty().withMessage('post_id is required.').isInt(),
    body('comment').trim().notEmpty().withMessage('Comment cannot be empty.').isLength({ max: 500 }),
  ],
  commentController.create
);

router.put(
  '/:id',
  requireAuth,
  [body('comment').trim().notEmpty().withMessage('Comment cannot be empty.').isLength({ max: 500 })],
  commentController.update
);

router.delete('/:id', requireAuth, commentController.delete);

module.exports = router;
