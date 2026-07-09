/**
 * controllers/postController.js
 * CRUD for posts. Images are uploaded to Supabase Storage bucket "posts".
 */

const path = require('path');
const { validationResult } = require('express-validator');
const { supabase } = require('../config/db');
const Post = require('../models/Post');
const Like = require('../models/Like');

const POST_BUCKET = 'posts';

const postController = {
  /**
   * GET /api/posts
   */
  async getAll(req, res) {
    try {
      const posts   = await Post.getAll();
      const likedIds = await Like.getLikedPostIds(req.session.userId);
      const enriched = posts.map(p => ({ ...p, liked_by_me: likedIds.includes(p.id) }));
      return res.json({ success: true, posts: enriched });
    } catch (err) {
      console.error('[Posts] getAll:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * GET /api/posts/user/:userId
   */
  async getByUser(req, res) {
    try {
      const posts    = await Post.getByUser(req.params.userId);
      const likedIds = await Like.getLikedPostIds(req.session.userId);
      const enriched = posts.map(p => ({ ...p, liked_by_me: likedIds.includes(p.id) }));
      return res.json({ success: true, posts: enriched });
    } catch (err) {
      console.error('[Posts] getByUser:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * POST /api/posts
   */
  async create(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { content } = req.body;
      let image = null;

      // Upload post image to Supabase Storage
      if (req.files && req.files.image) {
        const file    = req.files.image;
        const ext     = path.extname(file.name).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!allowed.includes(ext)) {
          return res.status(400).json({ success: false, message: 'Invalid image type.' });
        }

        const filename    = `post_${req.session.userId}_${Date.now()}${ext}`;
        const { error: upErr } = await supabase.storage
          .from(POST_BUCKET)
          .upload(filename, file.data, { contentType: file.mimetype });

        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from(POST_BUCKET)
            .getPublicUrl(filename);
          image = urlData.publicUrl;
        } else {
          console.error('[Posts] Storage upload error:', upErr.message);
        }
      }

      const newPost = await Post.create({ user_id: req.session.userId, content, image });
      const full    = await Post.findById(newPost.id);
      return res.status(201).json({ success: true, message: 'Post created.', post: { ...full, liked_by_me: false } });
    } catch (err) {
      console.error('[Posts] create:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * PUT /api/posts/:id
   */
  async update(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
      if (post.user_id !== req.session.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      const updated = await Post.update(req.params.id, req.body.content);
      return res.json({ success: true, message: 'Post updated.', post: updated });
    } catch (err) {
      console.error('[Posts] update:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * DELETE /api/posts/:id
   */
  async delete(req, res) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
      if (post.user_id !== req.session.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
      await Post.delete(req.params.id);
      return res.json({ success: true, message: 'Post deleted.' });
    } catch (err) {
      console.error('[Posts] delete:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = postController;
