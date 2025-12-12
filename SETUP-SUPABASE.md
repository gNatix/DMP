# Supabase Setup Guide

This guide will help you set up Supabase authentication for DM Planner.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: `dm-planner` (or your choice)
   - **Database Password**: Generate a strong password (SAVE THIS!)
   - **Region**: Choose closest to your users (e.g., Europe West)
   - **Pricing Plan**: Free tier is perfect to start
4. Wait 2-3 minutes for project creation

## Step 2: Get API Credentials

1. Go to **Settings** (⚙️) → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: Long string starting with `eyJhbG...`
3. Add to your `.env` file:
   ```env
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbG...
   ```

## Step 3: Run Database Setup SQL

1. Go to **SQL Editor** in Supabase dashboard
2. Click **New Query**
3. Copy and paste this SQL:

```sql
-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- GENERISK updated_at-FUNKTION
-- ============================================
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PROFILES (bruger-metadata)
-- ============================================
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  display_name text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS ON
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- updated_at trigger
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();


-- ============================================
-- SCENES (dine maps/sessions)
-- ============================================
CREATE TABLE public.scenes (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                text NOT NULL,
  background_map_url  text,
  background_map_name text,
  collection_id       text,
  elements            jsonb NOT NULL DEFAULT '[]'::jsonb,
  terrain_tiles       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX scenes_user_id_idx       ON public.scenes(user_id);
CREATE INDEX scenes_created_at_idx    ON public.scenes(created_at DESC);
CREATE INDEX scenes_elements_gin_idx  ON public.scenes USING GIN (elements);
CREATE INDEX scenes_terrain_gin_idx   ON public.scenes USING GIN (terrain_tiles);

-- RLS ON
ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own scenes"
  ON public.scenes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenes"
  ON public.scenes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenes"
  ON public.scenes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenes"
  ON public.scenes
  FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER set_scenes_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();


-- ============================================
-- AUTO-CREATE PROFILE PÅ SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username  text;
  final_username text;
  suffix         int := 0;
BEGIN
  -- 1) Prøv raw_user_meta_data.username (hvis du en dag vil sætte det via client)
  IF NEW.raw_user_meta_data ? 'username' THEN
    base_username := NEW.raw_user_meta_data->>'username';

  -- 2) Ellers brug email-prefix
  ELSIF NEW.email IS NOT NULL THEN
    base_username := split_part(NEW.email, '@', 1);

  -- 3) Fallback hvis ingen email (fx nogle social logins)
  ELSE
    base_username := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  final_username := base_username;

  -- Sørg for at username er unikt
  WHILE EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.username = final_username
  ) LOOP
    suffix := suffix + 1;
    final_username := base_username || '_' || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger på auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

4. Click **RUN** (or Ctrl+Enter)
5. You should see "Success. No rows returned" ✅

## Step 4: Enable Authentication Providers

### Email/Password (Enabled by default)
1. Go to **Authentication** → **Providers**
2. **Email** should be ON by default
3. ✅ Keep "Confirm email" enabled for security

### Google OAuth (Recommended)
1. Click **Google** provider
2. Toggle **Enable Sign in with Google**
3. You'll need Google OAuth credentials:

   **Get Google credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create a new project (or select existing)
   - Enable Google+ API
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**

4. Paste credentials in Supabase Google provider settings
5. Click **Save**

### Discord OAuth (Optional for D&D community)
Similar process - create Discord application and add credentials.

## Step 5: Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your redirect URLs:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`

## Step 6: Test Authentication

1. Start your app: `npm run dev`
2. Go to Settings tab (⚙️)
3. Try signing up with email/password
4. Check your email for confirmation link
5. Click confirm, then log in
6. Or click "Continue with Google" to test OAuth

## Troubleshooting

### "Invalid login credentials"
- Check your email is confirmed
- Password must be at least 6 characters

### Google OAuth not working
- Check redirect URI matches exactly
- Ensure Google+ API is enabled
- Check Client ID/Secret are correct

### Profile not created
- Check SQL ran successfully
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

### RLS blocking queries
- Make sure you're logged in
- Check policies with: `SELECT * FROM pg_policies WHERE tablename = 'profiles';`

## Security Notes

⚠️ **NEVER commit your `.env` file to git!**
- `.env` is in `.gitignore` 
- Only commit `.env.example` (template without secrets)
- Use environment variables in production hosting

🔒 **Row Level Security (RLS):**
- Users can ONLY see/edit their own data
- Enforced at database level
- Cannot be bypassed from client

## Next Steps

After setup:
1. ✅ Authentication working
2. 🚀 Implement scene sync to Supabase (localStorage → cloud)
3. 🛍️ Build shop with Stripe integration
4. 👥 Add multiplayer features (shared scenes)
