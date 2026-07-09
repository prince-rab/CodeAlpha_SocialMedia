/**
 * controllers/userController.js
 * User profile retrieval and updates.
 * Profile images are uploaded to Supabase Storage bucket "avatars".
 */

const path = require('path');
const { validationResult } = require('express-validator');
const { supabase } = require('../config/db');
const User   = require('../models/User');
const Follow = require('../models/Follow');

// Supabase Storage bucket name for profile images
const AVATAR_BUCKET = 'avatars';
// Supabase Storage bucket name for post images
const POST_BUCKET   = 'posts';

const userController = {
  /**
   * GET /api/users
   */
  async getAll(req, res) {
    try {
      const users = await User.getAll(req.session.userId);
      return res.json({ success: true, users });
    } catch (err) {
      console.error('[Users] getAll:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * GET /api/users/:id
   */
  async getById(req, res) {
    try {
      const sessionUserId = req.session?.userId;
      if (!sessionUserId) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

      const [followingIds, followers, following] = await Promise.all([
        Follow.getFollowingIds(sessionUserId),
        Follow.getFollowers(user.id),
        Follow.getFollowing(user.id),
      ]);
      const [followers_count, following_count, posts_count] = await Promise.all([
        User.getFollowersCount(user.id),
        User.getFollowingCount(user.id),
        User.getPostCount(user.id),
      ]);

      return res.json({
        success: true,
        user: {
          ...user,
          is_following:    followingIds.includes(user.id),
          followers_count,
          following_count,
          posts_count,
          followers,
          following,
        },
      });
    } catch (err) {
      console.error('[Users] getById:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },

  /**
   * PUT /api/users/:id
   * Supports multipart/form-data (profile image upload to Supabase Storage).
   */
  async update(req, res) {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    if (req.params.id !== sessionUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const current = await User.findById(sessionUserId);
      let profile_image = current.profile_image;

      // Upload avatar to Supabase Storage if a new file was provided
      if (req.files && req.files.profile_image) {
        const file   = req.files.profile_image;
        const ext    = path.extname(file.name).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!allowed.includes(ext)) {
          return res.status(400).json({ success: false, message: 'Invalid image type.' });
        }

        const filename    = `avatar_${sessionUserId}_${Date.now()}${ext}`;
        const { error: upErr } = await supabase.storage
          .from(AVATAR_BUCKET)
          .upload(filename, file.data, {
            contentType: file.mimetype,
            upsert: true,
          });

        if (upErr) {
          console.error('[Users] Storage upload error:', upErr.message);
          // Fall back to keeping current image rather than failing the whole update
        } else {
          const { data: urlData } = supabase.storage
            .from(AVATAR_BUCKET)
            .getPublicUrl(filename);
          profile_image = urlData.publicUrl;
        }
      }

      const { name, bio } = req.body;
      const updated = await User.update(sessionUserId, {
        name:          name || current.name,
        bio:           bio  !== undefined ? bio : current.bio,
        profile_image,
      });

      return res.json({ success: true, message: 'Profile updated.', user: updated });
    } catch (err) {
      console.error('[Users] update:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
  /**
   * DELETE /api/users/:id
   * Removes a user completely (profile + Supabase Auth).
   * Only the user themselves or an admin (service-role session) may call this.
   */
  async delete(req, res) {
    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.params.id !== sessionUserId) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    try {
      await User.delete(req.params.id);
      // Destroy the session
      req.session.destroy(() => {});
      return res.json({ success: true, message: 'Account deleted.' });
    } catch (err) {
      console.error('[Users] delete:', err);
      return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  },
};

module.exports = userController;
