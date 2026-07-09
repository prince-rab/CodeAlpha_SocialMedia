/**
 * controllers/likeController.js
 * Like / unlike posts.
 */

const Like = require('../models/Like');
const Post = require('../models/Post');

const likeController = {
  /**
   * POST /api/like
   */
  async like(req, res) {
    try {
      const { post_id } = req.body;
      if (!post_id) return res.status(400).json({ success: false, message: 'post_id is required.' });

      const post = await Post.findById(post_id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

      await Like.create(post_id, req.session.userId);
      const like_count = await Like.countByPost(post_id);
      return res.json({ success: true, liked: true, like_count });
    } catch (err) {
      console.error('[Likes] like:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * DELETE /api/like
   */
  async unlike(req, res) {
    try {
      const { post_id } = req.body;
      if (!post_id) return res.status(400).json({ success: false, message: 'post_id is required.' });

      await Like.delete(post_id, req.session.userId);
      const like_count = await Like.countByPost(post_id);
      return res.json({ success: true, liked: false, like_count });
    } catch (err) {
      console.error('[Likes] unlike:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = likeController;
