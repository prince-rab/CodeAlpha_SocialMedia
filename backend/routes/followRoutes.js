/**
 * Follow Routes
 * POST   /api/follow                    — follow a user
 * DELETE /api/follow                    — unfollow a user
 * GET    /api/follow/followers/:userId  — get followers list
 * GET    /api/follow/following/:userId  — get following list
 */

const express = require('express');
const router = express.Router();
const followController = require('../controllers/followController');
const { requireAuth } = require('../middleware/authMiddleware');

router.post('/', requireAuth, followController.follow);
router.delete('/', requireAuth, followController.unfollow);
router.get('/followers/:userId', requireAuth, followController.getFollowers);
router.get('/following/:userId', requireAuth, followController.getFollowing);

module.exports = router;
