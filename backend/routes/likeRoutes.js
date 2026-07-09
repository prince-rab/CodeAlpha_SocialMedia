/**
 * Like Routes
 * POST   /api/like   — like a post
 * DELETE /api/like   — unlike a post
 */

const express = require('express');
const router = express.Router();
const likeController = require('../controllers/likeController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, likeController.like);
router.delete('/', requireAuth, likeController.unlike);

module.exports = router;
