/**
 * models/User.js
 * All database operations related to users (profiles table).
 * Supabase stores auth credentials in auth.users; our app data lives in
 * public.profiles which references auth.users(id) via UUID.
 */

const { supabase, assertOk } = require('../config/db');

const User = {
  /**
   * Find a profile by UUID id.
   * @param {string} id - UUID
   */
  async findById(id) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, username, profile_image, bio, created_at')
        .eq('id', id)
        .single();
      if (error) {
        // Log table-not-found errors clearly
        if (error.code === '42P01') {
          console.error('[User.findById] Table "profiles" does not exist. Run backend/database/01_schema.sql in Supabase SQL Editor.');
        }
        return null;
      }
      return data;
    } catch (e) {
      console.error('[User.findById] Unexpected error:', e.message);
      return null;
    }
  },

  /**
   * Find a profile by username.
   * @param {string} username
   */
  async findByUsername(username) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();
      if (error) return null;
      return data;
    } catch (e) {
      return null;
    }
  },

  /**
   * Create a new profile row after Supabase Auth registration.
   * @param {object} data - { id (UUID), name, username }
   */
  async create({ id, name, username }) {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{ id, name, username }])
      .select()
      .single();
    if (error) {
      if (error.code === '42P01') {
        throw new Error('Table "profiles" does not exist. Please run backend/database/01_schema.sql in your Supabase SQL Editor first.');
      }
      throw new Error(error.message);
    }
    return data;
  },

  /**
   * Update a user's profile fields.
   * @param {string} id - UUID
   * @param {object} fields - { name, bio, profile_image }
   */
  async update(id, { name, bio, profile_image }) {
    const updates = {};
    if (name          !== undefined) updates.name          = name;
    if (bio           !== undefined) updates.bio           = bio;
    if (profile_image !== undefined) updates.profile_image = profile_image;

    const result = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    assertOk(result, 'User.update');
    return result.data;
  },

  /**
   * Get all profiles except the given user (for discover / search).
   * Enriches each profile with follower stats and following status.
   * @param {string} excludeId - UUID of the logged-in user
   */
  async getAll(excludeId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, username, profile_image, bio')
      .neq('id', excludeId);
    if (error) throw new Error(error.message);

    // Enrich each user with counts and follow status
    const followingRes = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', excludeId);
    const followingIds = (followingRes.data || []).map(r => r.following_id);

    const enriched = await Promise.all((data || []).map(async u => {
      const [postCount, followerCount, followingCount] = await Promise.all([
        User.getPostCount(u.id),
        User.getFollowersCount(u.id),
        User.getFollowingCount(u.id),
      ]);
      return {
        ...u,
        is_following:    followingIds.includes(u.id),
        posts_count:     postCount,
        followers_count: followerCount,
        following_count: followingCount,
      };
    }));
    return enriched;
  },

  /**
   * Count posts by a user.
   * @param {string} userId - UUID
   */
  async getPostCount(userId) {
    const { count } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    return count || 0;
  },

  /**
   * Count followers of a user.
   * @param {string} userId - UUID
   */
  async getFollowersCount(userId) {
    const { count } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', userId);
    return count || 0;
  },

  /**
   * Count users the given user is following.
   * @param {string} userId - UUID
   */
  async getFollowingCount(userId) {
    const { count } = await supabase
      .from('followers')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', userId);
    return count || 0;
  },

  /**
   * Delete a user — removes the profile row and deletes from Supabase Auth.
   * Cascades will clean up posts, comments, likes, follows via FK ON DELETE CASCADE.
   * @param {string} userId - UUID
   */
  async delete(userId) {
    // Delete profile row first (cascade handles related rows)
    const { error: profileErr } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    if (profileErr) throw new Error(profileErr.message);

    // Delete from Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
    if (authErr) throw new Error(authErr.message);
  },
};

module.exports = User;
