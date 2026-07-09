/**
 * controllers/followController.js
 * Follow / unfollow users.
 */

const Follow = require('../models/Follow');
const User   = require('../models/User');

const followController = {
  /**
   * POST /api/follow
   */
  async follow(req, res) {
    try {
      const { following_id } = req.body;
      if (!following_id) return res.status(400).json({ success: false, message: 'following_id is required.' });
      if (following_id === req.session.userId) {
        return res.status(400).json({ success: false, message: 'You cannot follow yourself.' });
      }

      const target = await User.findById(following_id);
      if (!target) return res.status(404).json({ success: false, message: 'User not found.' });

      await Follow.create(req.session.userId, following_id);
      const followers_count = await User.getFollowersCount(following_id);
      return res.json({ success: true, following: true, followers_count });
    } catch (err) {
      console.error('[Follow] follow:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * DELETE /api/follow
   */
  async unfollow(req, res) {
    try {
      const { following_id } = req.body;
      if (!following_id) return res.status(400).json({ success: false, message: 'following_id is required.' });

      await Follow.delete(req.session.userId, following_id);
      const followers_count = await User.getFollowersCount(following_id);
      return res.json({ success: true, following: false, followers_count });
    } catch (err) {
      console.error('[Follow] unfollow:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * GET /api/follow/followers/:userId
   */
  async getFollowers(req, res) {
    try {
      const followers = await Follow.getFollowers(req.params.userId);
      return res.json({ success: true, followers });
    } catch (err) {
      console.error('[Follow] getFollowers:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * GET /api/follow/following/:userId
   */
  async getFollowing(req, res) {
    try {
      const following = await Follow.getFollowing(req.params.userId);
      return res.json({ success: true, following });
    } catch (err) {
      console.error('[Follow] getFollowing:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = followController;
