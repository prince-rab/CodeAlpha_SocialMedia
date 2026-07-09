-- ============================================================
-- FILE: 01_schema.sql
-- PURPOSE: Create all tables, triggers, indexes, and storage
--          buckets for SocialSphere on Supabase.
--
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New Query
--   Paste this entire file → click "Run"
--
-- Run this file FIRST before 02_rls_policies.sql
-- ============================================================


-- ── SECTION 1: PROFILES ─────────────────────────────────────
-- Extends Supabase Auth (auth.users) with social profile data.
-- The id column is a UUID that matches auth.users(id).
-- A new row is created here automatically after user signs up
-- (handled by our Express backend on /api/auth/register).

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  username      TEXT        NOT NULL UNIQUE
                            CHECK (username ~ '^[a-zA-Z0-9_]{3,30}$'),
  profile_image TEXT        DEFAULT NULL,
  bio           TEXT        DEFAULT ''   CHECK (char_length(bio) <= 300),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast username lookups (login, search)
CREATE INDEX IF NOT EXISTS idx_profiles_username
  ON public.profiles (username);


-- ── SECTION 1b: BACKFILL ─────────────────────────────────────
-- If any users already exist in auth.users (registered before
-- this SQL was run), create their profile rows automatically.
-- Safe to run multiple times — uses INSERT ... ON CONFLICT DO NOTHING.

INSERT INTO public.profiles (id, name, username, created_at)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'name',
    split_part(au.email, '@', 1)
  ) AS name,
  -- Make username: take email prefix, replace special chars, add suffix if needed
  LOWER(
    REGEXP_REPLACE(
      SUBSTRING(COALESCE(au.raw_user_meta_data->>'username', split_part(au.email,'@',1)), 1, 25),
      '[^a-zA-Z0-9_]', '_', 'g'
    )
  ) || '_' || SUBSTRING(au.id::text, 1, 4) AS username,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO NOTHING;


-- ── SECTION 2: POSTS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.posts (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  image      TEXT        DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user-specific post queries (profile page feed)
CREATE INDEX IF NOT EXISTS idx_posts_user_id
  ON public.posts (user_id);

-- Index for sorting by newest first (home feed)
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON public.posts (created_at DESC);

-- ── Trigger: auto-update updated_at on post edits ───────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS posts_set_updated_at ON public.posts;
CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ── SECTION 3: COMMENTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id         BIGSERIAL   PRIMARY KEY,
  post_id    BIGINT      NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment    TEXT        NOT NULL CHECK (char_length(comment) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id
  ON public.comments (post_id);

CREATE INDEX IF NOT EXISTS idx_comments_user_id
  ON public.comments (user_id);


-- ── SECTION 4: LIKES ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.likes (
  id         BIGSERIAL   PRIMARY KEY,
  post_id    BIGINT      NOT NULL REFERENCES public.posts(id)    ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT likes_post_user_unique UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post_user
  ON public.likes (post_id, user_id);


-- ── SECTION 5: FOLLOWERS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.followers (
  id           BIGSERIAL   PRIMARY KEY,
  follower_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT followers_unique  UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow    CHECK  (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_following_id
  ON public.followers (following_id);

CREATE INDEX IF NOT EXISTS idx_followers_follower_id
  ON public.followers (follower_id);


-- ── SECTION 6: SESSION TABLE ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session (
  sid    TEXT          NOT NULL PRIMARY KEY,
  sess   JSONB         NOT NULL,
  expire TIMESTAMPTZ   NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire
  ON public.session (expire);


-- ── SECTION 7: STORAGE BUCKETS ──────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp']),
  ('posts',   'posts',   true, 5242880, ARRAY['image/jpeg','image/png','image/gif','image/webp'])
ON CONFLICT (id) DO NOTHING;


-- ── VERIFICATION ─────────────────────────────────────────────
-- After running, check that profiles were created:
SELECT id, name, username, created_at FROM public.profiles;

-- ── DONE ────────────────────────────────────────────────────
-- Next: run 02_rls_policies.sql
-- ============================================================
