/**
 * models/Like.js
 * All database operations related to post likes.
 */

const { supabase } = require('../config/db');

const Like = {
  /**
   * Check if a user has liked a post.
   * @param {number|string} post_id
   * @param {string} user_id - UUID
   */
  async exists(post_id, user_id) {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('post_id', post_id)
      .eq('user_id', user_id)
      .maybeSingle();
    return data || null;
  },

  /**
   * Like a post (upsert — safe to call even if already liked).
   * @param {number|string} post_id
   * @param {string} user_id - UUID
   */
  async create(post_id, user_id) {
    await supabase
      .from('likes')
      .upsert([{ post_id, user_id }], { onConflict: 'post_id,user_id' });
  },

  /**
   * Unlike a post.
   * @param {number|string} post_id
   * @param {string} user_id - UUID
   */
  async delete(post_id, user_id) {
    await supabase
      .from('likes')
      .delete()
      .eq('post_id', post_id)
      .eq('user_id', user_id);
  },

  /**
   * Count likes on a post.
   * @param {number|string} post_id
   */
  async countByPost(post_id) {
    const { count } = await supabase
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post_id);
    return count || 0;
  },

  /**
   * Get all post IDs liked by a user.
   * @param {string} user_id - UUID
   */
  async getLikedPostIds(user_id) {
    const { data } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user_id);
    return (data || []).map(r => r.post_id);
  },
};

module.exports = Like;
