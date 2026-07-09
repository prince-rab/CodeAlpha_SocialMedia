/**
 * models/Post.js
 * All database operations related to posts.
 */

const { supabase, assertOk } = require('../config/db');

const Post = {
  /**
   * Get all posts newest-first, with author profile and counts.
   */
  async getAll() {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, user_id, content, image, created_at, updated_at,
        profiles!posts_user_id_fkey ( name, username, profile_image )
      `)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return await Post._enrichPosts(data || []);
  },

  /**
   * Get all posts by a specific user.
   * @param {string} userId - UUID
   */
  async getByUser(userId) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, user_id, content, image, created_at, updated_at,
        profiles!posts_user_id_fkey ( name, username, profile_image )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return await Post._enrichPosts(data || []);
  },

  /**
   * Get a single post by id.
   * @param {number|string} id
   */
  async findById(id) {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, user_id, content, image, created_at, updated_at,
        profiles!posts_user_id_fkey ( name, username, profile_image )
      `)
      .eq('id', id)
      .single();
    if (error) return null;
    const enriched = await Post._enrichPosts([data]);
    return enriched[0] || null;
  },

  /**
   * Create a new post.
   * @param {object} data - { user_id, content, image }
   */
  async create({ user_id, content, image }) {
    const result = await supabase
      .from('posts')
      .insert([{ user_id, content, image: image || null }])
      .select()
      .single();
    assertOk(result, 'Post.create');
    return result.data;
  },

  /**
   * Update post content.
   * @param {number|string} id
   * @param {string} content
   */
  async update(id, content) {
    const result = await supabase
      .from('posts')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    assertOk(result, 'Post.update');
    return result.data;
  },

  /**
   * Delete a post.
   * @param {number|string} id
   */
  async delete(id) {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /**
   * Internal helper — adds like_count, comment_count, and flattens
   * the nested profiles join into top-level fields.
   * @param {Array} posts
   */
  async _enrichPosts(posts) {
    return Promise.all(posts.map(async p => {
      const [likeRes, commentRes] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', p.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', p.id),
      ]);
      const profile = p.profiles || {};
      return {
        id:            p.id,
        user_id:       p.user_id,
        content:       p.content,
        image:         p.image,
        created_at:    p.created_at,
        updated_at:    p.updated_at,
        name:          profile.name          || '',
        username:      profile.username      || '',
        profile_image: profile.profile_image || null,
        like_count:    likeRes.count    || 0,
        comment_count: commentRes.count || 0,
      };
    }));
  },
};

module.exports = Post;
