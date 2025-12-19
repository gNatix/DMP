# DM Planner - Database Schema

> Last updated: December 19, 2025

## Tables Overview

| Table | Description |
|-------|-------------|
| `profiles` | User profile information (synced from auth) |
| `scenes` | Battle maps, elements, terrain data |
| `user_settings` | User preferences (collections, toolbar settings) |

---

## Table: `profiles`

User profile information, created automatically when users sign up.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | - | NO | Primary key (matches auth.users.id) |
| `username` | text | - | NO | Unique username |
| `display_name` | text | - | YES | Display name shown in UI |
| `avatar_url` | text | - | YES | URL to profile avatar |
| `user_handle` | text | - | YES | Best identifier (email or Discord username) |
| `auth_provider` | text | - | YES | 'google', 'discord', or 'email' |
| `created_at` | timestamptz | now() | NO | When profile was created |
| `updated_at` | timestamptz | now() | NO | Last update timestamp |

---

## Table: `scenes`

Battle map scenes with all elements, terrain, and modular room data.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | uuid_generate_v4() | NO | Primary key |
| `user_id` | uuid | - | NO | Owner (references auth.users) |
| `name` | text | - | NO | Scene name |
| `background_map_url` | text | - | YES | URL to background map image |
| `background_map_name` | text | - | YES | Display name of map |
| `collection_id` | text | - | YES | Which collection this scene belongs to |
| `elements` | jsonb | '[]' | NO | Array of MapElement objects |
| `terrain_tiles` | jsonb | '{}' | NO | Terrain brush tile data |
| `modular_rooms_state` | jsonb | '{"doors":[],"wallGroups":[]}' | YES | Modular room doors and wall groups |
| `viewport` | jsonb | - | YES | Scene-specific viewport position |
| `width` | integer | 5000 | YES | Canvas width (for infinite canvas) |
| `height` | integer | 5000 | YES | Canvas height (for infinite canvas) |
| `user_handle` | text | - | YES | Cached user identifier |
| `auth_provider` | text | - | YES | Cached auth provider |
| `created_at` | timestamptz | now() | NO | When scene was created |
| `updated_at` | timestamptz | now() | NO | Last update timestamp |

### Elements JSONB Structure
```typescript
interface MapElement {
  id: string;
  type: 'token' | 'room' | 'wall' | 'modularRoom' | 'text' | 'drawing';
  x: number;
  y: number;
  // ... type-specific properties
}
```

### Modular Rooms State JSONB Structure
```typescript
interface ModularRoomsState {
  doors: Door[];
  wallGroups: WallGroup[];
}
```

---

## Table: `user_settings`

User preferences that persist across sessions.

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `id` | uuid | gen_random_uuid() | NO | Primary key |
| `user_id` | uuid | - | NO | Owner (references auth.users, UNIQUE) |
| `user_handle` | text | - | YES | Cached user identifier |
| `auth_provider` | text | - | YES | Cached auth provider |
| `collections` | jsonb | '[]' | YES | Array of Collection objects |
| `active_scene_id` | text | - | YES | Last active scene ID |
| `viewport` | jsonb | '{"x":0,"y":0,"zoom":1}' | YES | Default viewport (not currently used) |
| `hidden_toolbar_buttons` | jsonb | '[]' | YES | Array of button IDs hidden in toolbar |
| `created_at` | timestamptz | now() | YES | When settings were created |
| `updated_at` | timestamptz | now() | YES | Last update timestamp |

### Collections JSONB Structure
```typescript
interface Collection {
  id: string;
  name: string;
  appearance?: {
    gradient?: string;
    icon?: string;
  };
}
```

### Hidden Toolbar Buttons JSONB Structure
```typescript
// Array of button IDs that should be hidden
// Example: ["pan", "zoom", "undo", "redo"]
string[]
```

---

## Row Level Security (RLS)

All tables have RLS enabled. Users can only:
- **SELECT** their own data
- **INSERT** their own data
- **UPDATE** their own data
- **DELETE** their own data

---

## Indexes

| Table | Index | Columns |
|-------|-------|---------|
| user_settings | idx_user_settings_user_id | user_id |
| user_settings | idx_user_settings_handle | user_handle |
| user_settings | idx_user_settings_provider | auth_provider |
| scenes | idx_scenes_handle | user_handle |
| scenes | idx_scenes_provider | auth_provider |
| profiles | idx_profiles_handle | user_handle |
| profiles | idx_profiles_provider | auth_provider |

---

## Triggers

### `update_updated_at_column()`
Automatically updates `updated_at` timestamp on row update.

Applied to:
- `user_settings`

---

## Migration History

| Date | Change | Status |
|------|--------|--------|
| 2025-12-XX | Initial schema (profiles, scenes) | ✅ Applied |
| 2025-12-XX | Added user_settings table | ✅ Applied |
| 2025-12-XX | Added modular_rooms_state to scenes | ✅ Applied |
| 2025-12-19 | Added hidden_toolbar_buttons to user_settings | ✅ Applied |
| 2025-12-19 | Added viewport to user_settings | ✅ Applied |
