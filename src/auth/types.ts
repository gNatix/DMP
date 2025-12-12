import type { User, Session } from '@supabase/supabase-js';

// Profile type (simplified)
export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Auth context types
export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

// Database types (for reference, not enforced by Supabase client)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Profile>;
      };
      scenes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          background_map_url: string | null;
          background_map_name: string | null;
          collection_id: string | null;
          elements: any; // JSONB
          terrain_tiles: any; // JSONB
          created_at: string;
          updated_at: string;
        };
        Insert: any;
        Update: any;
      };
    };
  };
}
