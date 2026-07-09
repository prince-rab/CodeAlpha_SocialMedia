/**
 * controllers/commentController.js
 * CRUD for comments.
 */

const { validationResult } = require('express-validator');
const Comment = require('../models/Comment');
const Post    = require('../models/Post');

const commentController = {
  /**
   * GET /api/comments/:postId
   */
  async getByPost(req, res) {
    try {
      const comments = await Comment.getByPost(req.params.postId);
      return res.json({ success: true, comments });
    } catch (err) {
      console.error('[Comments] getByPost:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * POST /api/comments
   */
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { post_id, comment } = req.body;

      const post = await Post.findById(post_id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

      await Comment.create({ post_id, user_id: req.session.userId, comment });

      // Return the full list so the client can re-render cleanly
      const comments = await Comment.getByPost(post_id);
      const latest   = comments[comments.length - 1];

      return res.status(201).json({ success: true, message: 'Comment added.', comment: latest });
    } catch (err) {
      console.error('[Comments] create:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * PUT /api/comments/:id
   */
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const c = await Comment.findById(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Comment not found.' });
      if (c.user_id !== req.session.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      await Comment.update(req.params.id, req.body.comment);
      return res.json({ success: true, message: 'Comment updated.' });
    } catch (err) {
      console.error('[Comments] update:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * DELETE /api/comments/:id
   */
  async delete(req, res) {
    try {
      const c = await Comment.findById(req.params.id);
      if (!c) return res.status(404).json({ success: false, message: 'Comment not found.' });
      if (c.user_id !== req.session.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      await Comment.delete(req.params.id);
      return res.json({ success: true, message: 'Comment deleted.' });
    } catch (err) {
      console.error('[Comments] delete:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = commentController;
