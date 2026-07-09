/**
 * Post Routes
 * GET  /api/posts
 * GET  /api/posts/user/:userId
 * POST /api/posts
 * PUT  /api/posts/:id
 * DELETE /api/posts/:id
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const postController = require('../controllers/postController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', requireAuth, postController.getAll);
router.get('/user/:userId', requireAuth, postController.getByUser);

router.post(
  '/',
  requireAuth,
  [body('content').trim().notEmpty().withMessage('Post content is required.').isLength({ max: 2000 })],
  postController.create
);

router.put(
  '/:id',
  requireAuth,
  [body('content').trim().notEmpty().withMessage('Content is required.').isLength({ max: 2000 })],
  postController.update
);

router.delete('/:id', requireAuth, postController.delete);

module.exports = router;
