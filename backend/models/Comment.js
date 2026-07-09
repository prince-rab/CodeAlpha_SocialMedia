/**
 * models/Comment.js
 * All database operations related to comments.
 */

const { supabase, assertOk } = require('../config/db');

const Comment = {
  /**
   * Get all comments for a post, with author profile, oldest first.
   * @param {number|string} postId
   */
  async getByPost(postId) {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, post_id, user_id, comment, created_at,
        profiles!comments_user_id_fkey ( name, username, profile_image )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    return (data || []).map(c => ({
      id:            c.id,
      post_id:       c.post_id,
      user_id:       c.user_id,
      comment:       c.comment,
      created_at:    c.created_at,
      name:          c.profiles?.name          || '',
      username:      c.profiles?.username      || '',
      profile_image: c.profiles?.profile_image || null,
    }));
  },

  /**
   * Find a single comment by id.
   * @param {number|string} id
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  /**
   * Create a new comment.
   * @param {object} data - { post_id, user_id, comment }
   */
  async create({ post_id, user_id, comment }) {
    const result = await supabase
      .from('comments')
      .insert([{ post_id, user_id, comment }])
      .select()
      .single();
    assertOk(result, 'Comment.create');
    return result.data;
  },

  /**
   * Update comment text.
   * @param {number|string} id
   * @param {string} comment
   */
  async update(id, comment) {
    const result = await supabase
      .from('comments')
      .update({ comment })
      .eq('id', id)
      .select()
      .single();
    assertOk(result, 'Comment.update');
    return result.data;
  },

  /**
   * Delete a comment.
   * @param {number|string} id
   */
  async delete(id) {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};

module.exports = Comment;
