
-- ── STEP 1: Enable RLS on every table ───────────────────────

ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session   ENABLE ROW LEVEL SECURITY;


-- ── STEP 2: Drop any pre-existing policies (safe re-run) ────

-- profiles
DROP POLICY IF EXISTS "profiles_select_all"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own"        ON public.profiles;

-- posts
DROP POLICY IF EXISTS "posts_select_all"           ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own"           ON public.posts;
DROP POLICY IF EXISTS "posts_update_own"           ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own"           ON public.posts;

-- comments
DROP POLICY IF EXISTS "comments_select_all"        ON public.comments;
DROP POLICY IF EXISTS "comments_insert_authenticated" ON public.comments;
DROP POLICY IF EXISTS "comments_update_own"        ON public.comments;
DROP POLICY IF EXISTS "comments_delete_own"        ON public.comments;

-- likes
DROP POLICY IF EXISTS "likes_select_all"           ON public.likes;
DROP POLICY IF EXISTS "likes_insert_own"           ON public.likes;
DROP POLICY IF EXISTS "likes_delete_own"           ON public.likes;

-- followers
DROP POLICY IF EXISTS "followers_select_all"       ON public.followers;
DROP POLICY IF EXISTS "followers_insert_own"       ON public.followers;
DROP POLICY IF EXISTS "followers_delete_own"       ON public.followers;

-- session (only the backend touches this)
DROP POLICY IF EXISTS "session_service_only"       ON public.session;


-- ════════════════════════════════════════════════════════════
-- ── PROFILES POLICIES ───────────────────────────────────────
-- ════════════════════════════════════════════════════════════

-- Anyone (even unauthenticated) can read all public profiles
CREATE POLICY "profiles_select_all"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Only the owner can insert their own profile row
-- (The id must match the logged-in Supabase Auth user UUID)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Only the owner can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING      (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only the owner can delete their own profile
CREATE POLICY "profiles_delete_own"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);


-- ════════════════════════════════════════════════════════════
-- ── POSTS POLICIES ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════

-- Anyone can read all posts
CREATE POLICY "posts_select_all"
  ON public.posts
  FOR SELECT
  USING (true);

-- Authenticated users can create posts (user_id must match their UUID)
CREATE POLICY "posts_insert_own"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authors can update only their own posts
CREATE POLICY "posts_update_own"
  ON public.posts
  FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authors can delete only their own posts
CREATE POLICY "posts_delete_own"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- ── COMMENTS POLICIES ───────────────────────────────────────
-- ════════════════════════════════════════════════════════════

-- Anyone can read all comments
CREATE POLICY "comments_select_all"
  ON public.comments
  FOR SELECT
  USING (true);

-- Any authenticated user can add a comment
-- (user_id must equal their own UUID)
CREATE POLICY "comments_insert_authenticated"
  ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authors can edit only their own comments
CREATE POLICY "comments_update_own"
  ON public.comments
  FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authors can delete only their own comments
CREATE POLICY "comments_delete_own"
  ON public.comments
  FOR DELETE
  USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- ── LIKES POLICIES ──────────────────────────────────────────
-- ════════════════════════════════════════════════════════════

-- Anyone can read all likes (for like counts / liked status)
CREATE POLICY "likes_select_all"
  ON public.likes
  FOR SELECT
  USING (true);

-- Authenticated users can like a post (their own user_id only)
CREATE POLICY "likes_insert_own"
  ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete) only their own likes
CREATE POLICY "likes_delete_own"
  ON public.likes
  FOR DELETE
  USING (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- ── FOLLOWERS POLICIES ──────────────────────────────────────
-- ════════════════════════════════════════════════════════════

-- Anyone can see all follow relationships
CREATE POLICY "followers_select_all"
  ON public.followers
  FOR SELECT
  USING (true);

-- Authenticated users can follow someone
-- (follower_id must equal their own UUID)
CREATE POLICY "followers_insert_own"
  ON public.followers
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can only unfollow relationships they created
CREATE POLICY "followers_delete_own"
  ON public.followers
  FOR DELETE
  USING (auth.uid() = follower_id);


-- ════════════════════════════════════════════════════════════
-- ── SESSION TABLE POLICY ────────────────────────────────────
-- The session table is only accessed by the Express backend
-- using the SERVICE ROLE key (which bypasses RLS).
-- We deny all direct client access as an extra safety measure.
-- ════════════════════════════════════════════════════════════

CREATE POLICY "session_service_only"
  ON public.session
  FOR ALL
  USING (false);   -- blocks anon + authenticated JWT access


-- ════════════════════════════════════════════════════════════
-- ── STORAGE BUCKET POLICIES ─────────────────────────────────
-- Controls who can upload/delete files in the Storage buckets.
-- ════════════════════════════════════════════════════════════

-- Drop existing storage policies (safe re-run)
DROP POLICY IF EXISTS "avatars_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_upload"    ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"   ON storage.objects;
DROP POLICY IF EXISTS "posts_public_read"      ON storage.objects;
DROP POLICY IF EXISTS "posts_auth_upload"      ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_delete"     ON storage.objects;

-- ── avatars bucket ──────────────────────────────────────────

-- Public: anyone can view avatars (needed for <img src> tags)
CREATE POLICY "avatars_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
-- File name must start with "avatar_{their UUID}_"
CREATE POLICY "avatars_auth_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.filename(name)) LIKE 'avatar_' || auth.uid()::text || '_%'
  );

-- Users can only delete their own avatar files
CREATE POLICY "avatars_owner_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── posts bucket ────────────────────────────────────────────

-- Public: anyone can view post images
CREATE POLICY "posts_public_read"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'posts');

-- Authenticated users can upload their own post images
CREATE POLICY "posts_auth_upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'posts'
    AND auth.role() = 'authenticated'
    AND (storage.filename(name)) LIKE 'post_' || auth.uid()::text || '_%'
  );

-- Users can only delete their own post images
CREATE POLICY "posts_owner_delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ════════════════════════════════════════════════════════════
-- ── GRANT PERMISSIONS ───────────────────────────────────────
-- Explicitly grant usage on the public schema and SELECT/
-- INSERT/UPDATE/DELETE on all tables to the authenticated
-- and anon roles. The service_role already has full access.
-- ════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT                         ON public.profiles  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles  TO authenticated;

GRANT SELECT                         ON public.posts     TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts     TO authenticated;

GRANT SELECT                         ON public.comments  TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments  TO authenticated;

GRANT SELECT                         ON public.likes     TO anon;
GRANT SELECT, INSERT,        DELETE  ON public.likes     TO authenticated;

GRANT SELECT                         ON public.followers TO anon;
GRANT SELECT, INSERT,        DELETE  ON public.followers TO authenticated;

-- Sequences (needed for BIGSERIAL inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

