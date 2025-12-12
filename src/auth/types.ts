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

// Merged user type combining auth user and profile
// This is the PRIMARY type to use in UI components
export interface MergedUser {
  id: string; // ALWAYS a valid UUID - guaranteed by getAuthenticatedUser()
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

// Auth context types
export interface AuthContextType {
  // Raw Supabase user - avoid using directly in UI
  user: User | null;
  session: Session | null;
  
  // Profile data from profiles table
  profile: Profile | null;
  
  // MERGED USER - use this in UI components for display
  mergedUser: MergedUser | null;
  
  // Loading state
  isLoading: boolean;
  
  // Auth methods
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  
  // Get fresh authenticated user with profile - for save/load operations
  getAuthenticatedUser: () => Promise<MergedUser | null>;
}
