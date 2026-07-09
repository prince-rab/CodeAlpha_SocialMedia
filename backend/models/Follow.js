/**
 * models/Follow.js
 * All database operations related to the follow system.
 */

const { supabase } = require('../config/db');

const Follow = {
  /**
   * Check if follower_id is following following_id.
   * @param {string} follower_id  - UUID
   * @param {string} following_id - UUID
   */
  async exists(follower_id, following_id) {
    const { data } = await supabase
      .from('followers')
      .select('id')
      .eq('follower_id', follower_id)
      .eq('following_id', following_id)
      .maybeSingle();
    return data || null;
  },

  /**
   * Create a follow relationship (upsert — idempotent).
   * @param {string} follower_id
   * @param {string} following_id
   */
  async create(follower_id, following_id) {
    await supabase
      .from('followers')
      .upsert([{ follower_id, following_id }], { onConflict: 'follower_id,following_id' });
  },

  /**
   * Remove a follow relationship.
   * @param {string} follower_id
   * @param {string} following_id
   */
  async delete(follower_id, following_id) {
    await supabase
      .from('followers')
      .delete()
      .eq('follower_id', follower_id)
      .eq('following_id', following_id);
  },

  /**
   * Get list of users who follow userId.
   * @param {string} userId - UUID
   */
  async getFollowers(userId) {
    const { data, error } = await supabase
      .from('followers')
      .select(`
        follower_id,
        profiles!followers_follower_id_fkey ( id, name, username, profile_image )
      `)
      .eq('following_id', userId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.profiles).filter(Boolean);
  },

  /**
   * Get list of users userId is following.
   * @param {string} userId - UUID
   */
  async getFollowing(userId) {
    const { data, error } = await supabase
      .from('followers')
      .select(`
        following_id,
        profiles!followers_following_id_fkey ( id, name, username, profile_image )
      `)
      .eq('follower_id', userId);
    if (error) throw new Error(error.message);
    return (data || []).map(r => r.profiles).filter(Boolean);
  },

  /**
   * Get IDs of all users that userId is following.
   * @param {string} userId - UUID
   */
  async getFollowingIds(userId) {
    const { data } = await supabase
      .from('followers')
      .select('following_id')
      .eq('follower_id', userId);
    return (data || []).map(r => r.following_id);
  },
};

module.exports = Follow;
