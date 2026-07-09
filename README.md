# 🌐 SocialSphere — Social Media Platform

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express.js-green?style=for-the-badge&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Frontend-HTML%20CSS%20JS-orange?style=for-the-badge" alt="Frontend" />
  <img src="https://img.shields.io/badge/Status-Production%20Ready-brightgreen?style=for-the-badge" alt="Status" />
</p>

> A complete, modern, and fully responsive social media platform built as an Internship Project using **HTML5**, **CSS3**, **Vanilla JavaScript**, **Express.js**, and **Supabase (PostgreSQL)**.

---

## 📋 Project Overview

SocialSphere is a mini social media application where users can register, log in, create posts, interact with other users through comments and likes, and build a network via the follow system.

The backend is powered by **Express.js** and all data is stored in **Supabase** — a fully-managed cloud PostgreSQL database with built-in Auth. Images (avatars and post photos) are stored in **Supabase Storage**.

---

## ✨ Features

### 🔐 Authentication
- User Registration via Supabase Auth
- Secure Login (email + password)
- Express session stored in Supabase PostgreSQL
- Auto-redirect for authenticated/unauthenticated users

### 👤 User Profiles
- Display Name, Username, Bio
- Profile Picture (uploaded to Supabase Storage)
- Followers / Following / Posts count
- Edit Profile (name, bio, avatar)
- View any user's public profile

### 📝 Posts
- Create posts with optional image upload (Supabase Storage)
- Edit & Delete own posts
- Feed ordered by newest first

### 💬 Comments
- Add, delete comments on any post
- Real-time comment count update
- Modal-based comment viewing

### ❤️ Likes
- Like / Unlike posts with live counter update

### 👥 Follow System
- Follow / Unfollow users
- Followers & Following lists on profile page
- Discover People sidebar

### 📰 Feed
- Home feed with all posts
- Skeleton loading placeholders
- User search with live dropdown

---

## 🛠️ Technology Stack

| Layer        | Technology                          |
|--------------|-------------------------------------|
| Frontend     | HTML5, CSS3, Vanilla JS             |
| Backend      | Node.js + Express.js                |
| Database     | Supabase (PostgreSQL)               |
| Auth         | Supabase Auth                       |
| File Storage | Supabase Storage                    |
| Sessions     | express-session + connect-pg-simple |
| Validation   | express-validator                   |
| Image Upload | express-fileupload                  |

---

## 📁 Folder Structure

```
CodeAlpha_SocialMedia/
│
├── backend/
│   ├── config/
│   │   └── db.js               # Supabase client (service-role + anon)
│   ├── controllers/
│   │   ├── authController.js   # Register / Login via Supabase Auth
│   │   ├── userController.js
│   │   ├── postController.js
│   │   ├── commentController.js
│   │   ├── likeController.js
│   │   └── followController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── models/
│   │   ├── User.js             # Supabase queries — profiles table
│   │   ├── Post.js             # Supabase queries — posts table
│   │   ├── Comment.js
│   │   ├── Like.js
│   │   └── Follow.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── postRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── likeRoutes.js
│   │   └── followRoutes.js
│   ├── server.js
│   ├── package.json
│   ├── .env                    # Your actual keys (never commit)
│   └── .env.example            # Template — copy to .env
│
└── frontend/
    ├── css/
    │   ├── style.css
    │   ├── login.css
    │   ├── profile.css
    │   └── feed.css
    ├── js/
    │   ├── login.js
    │   ├── register.js
    │   ├── feed.js
    │   ├── profile.js
    │   └── post.js
    ├── index.html
    ├── login.html
    ├── register.html
    ├── feed.html
    ├── profile.html
    └── create-post.html
```

---

## 🗄️ Supabase Database Setup

### Step 1 — Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a name, password, and region → Create

### Step 2 — Run the SQL Script

Go to **SQL Editor** in your Supabase dashboard and run this entire script:

```sql
-- ── Profiles (extends Supabase Auth users) ──────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  username      TEXT        NOT NULL UNIQUE,
  profile_image TEXT        DEFAULT NULL,
  bio           TEXT        DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.posts (
  id         BIGSERIAL   PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  image      TEXT        DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id         BIGSERIAL   PRIMARY KEY,
  post_id    BIGINT      NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Likes ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  id         BIGSERIAL   PRIMARY KEY,
  post_id    BIGINT      NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (post_id, user_id)
);

-- ── Followers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.followers (
  id           BIGSERIAL   PRIMARY KEY,
  follower_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- ── Auto-update updated_at on posts ─────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Enable Row Level Security ────────────────────────────────
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies — Allow all (backend uses service-role key) ─
CREATE POLICY "Allow all" ON public.profiles  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.posts     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.comments  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.likes     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON public.followers FOR ALL USING (true) WITH CHECK (true);
```

### Step 3 — Create Storage Buckets

Go to **Storage** in your Supabase dashboard and create two **public** buckets:

| Bucket Name | Purpose              | Public |
|-------------|----------------------|--------|
| `avatars`   | Profile pictures     | ✅ Yes |
| `posts`     | Post images          | ✅ Yes |

> Set each bucket to **Public** so image URLs work without auth headers.

---

## 🚀 Installation Guide

### Prerequisites
- **Node.js** v18+ ([Download](https://nodejs.org/))
- A **Supabase** account and project (free tier works)

### Step 1 — Clone or Download

```bash
git clone https://github.com/your-username/CodeAlpha_SocialMedia.git
cd CodeAlpha_SocialMedia
```

### Step 2 — Install Backend Dependencies

```bash
cd backend
npm install
```

### Step 3 — Configure Environment Variables

Copy the example file:
```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Then open `.env` and fill in your Supabase credentials:

```env
PORT=5000
NODE_ENV=development
SESSION_SECRET=your_long_random_string_here

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_public_key
SUPABASE_SERVICE_KEY=your_service_role_secret_key

DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Step 4 — Start the Server

```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### Step 5 — Open the Application

```
http://localhost:5000
```

---

## ⚙️ Environment Variables Reference

| Variable             | Where to Find                                        | Required |
|----------------------|------------------------------------------------------|----------|
| `PORT`               | Any free port (default: 5000)                        | No       |
| `NODE_ENV`           | `development` or `production`                        | No       |
| `SESSION_SECRET`     | Any long random string                               | ✅ Yes   |
| `SUPABASE_URL`       | Dashboard → Project Settings → API → Project URL    | ✅ Yes   |
| `SUPABASE_ANON_KEY`  | Dashboard → Project Settings → API → anon key       | ✅ Yes   |
| `SUPABASE_SERVICE_KEY` | Dashboard → Project Settings → API → service_role | ✅ Yes   |
| `DATABASE_URL`       | Dashboard → Project Settings → Database → URI       | ✅ Yes   |

> ⚠️ **`SUPABASE_SERVICE_KEY`** must be kept secret — it bypasses all RLS policies.

---

## 📡 API Endpoints

### Authentication

| Method | Endpoint              | Description       |
|--------|-----------------------|-------------------|
| POST   | `/api/auth/register`  | Register new user |
| POST   | `/api/auth/login`     | Login             |
| POST   | `/api/auth/logout`    | Logout            |
| GET    | `/api/auth/me`        | Get current user  |

### Users

| Method | Endpoint         | Description        |
|--------|------------------|--------------------|
| GET    | `/api/users`     | List all users     |
| GET    | `/api/users/:id` | Get user profile   |
| PUT    | `/api/users/:id` | Update own profile |

### Posts

| Method | Endpoint                  | Description          |
|--------|---------------------------|----------------------|
| GET    | `/api/posts`              | All posts (feed)     |
| GET    | `/api/posts/user/:userId` | User's posts         |
| POST   | `/api/posts`              | Create post          |
| PUT    | `/api/posts/:id`          | Edit own post        |
| DELETE | `/api/posts/:id`          | Delete own post      |

### Comments

| Method | Endpoint                | Description           |
|--------|-------------------------|-----------------------|
| GET    | `/api/comments/:postId` | Get post's comments   |
| POST   | `/api/comments`         | Add comment           |
| PUT    | `/api/comments/:id`     | Edit own comment      |
| DELETE | `/api/comments/:id`     | Delete own comment    |

### Likes

| Method | Endpoint     | Description |
|--------|-------------|-------------|
| POST   | `/api/like` | Like post   |
| DELETE | `/api/like` | Unlike post |

### Follow

| Method | Endpoint                        | Description        |
|--------|---------------------------------|--------------------|
| POST   | `/api/follow`                   | Follow user        |
| DELETE | `/api/follow`                   | Unfollow user      |
| GET    | `/api/follow/followers/:userId` | Get followers list |
| GET    | `/api/follow/following/:userId` | Get following list |

---

## 🔮 Future Enhancements

- [ ] Real-time notifications (Supabase Realtime)
- [ ] Direct Messaging
- [ ] Post sharing / Repost
- [ ] Hashtag system & trending topics
- [ ] Dark mode toggle
- [ ] Email verification
- [ ] Password reset via email
- [ ] Admin dashboard
- [ ] Docker deployment

---

## 🧑‍💻 Author

**Built by:** [Your Name]
**Project:** CodeAlpha Internship — Social Media Platform
**Stack:** HTML5 · CSS3 · Vanilla JS · Express.js · Supabase

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">Made with ❤️ for the CodeAlpha Internship Program</p>
