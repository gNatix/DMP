/**
 * Simple Auth Types - Clean Reset
 * 
 * DESIGN PRINCIPLES:
 * 1. ONE user type (AuthUser) - no confusion
 * 2. Minimal state - just what we need
 * 3. Simple API - easy to understand
 */

export type AuthProvider = 'google' | 'discord' | 'email';

/**
 * The user object - combines auth data with profile data
 * This is the ONLY user type you need to use
 */
export interface AuthUser {
  id: string;              // UUID from Supabase auth
  email: string;           // Email from auth (may be empty for Discord)
  displayName?: string;    // From profile or OAuth
  avatarUrl?: string;      // From profile or OAuth
  authProvider: AuthProvider; // Which login method was used
  handle: string;          // Best identifier: email for google/email, username for discord
}

/**
 * Auth context - what's available to components
 */
export interface AuthContextType {
  // The current user (null = not logged in)
  user: AuthUser | null;
  
  // True while checking auth on app start
  loading: boolean;
  
  // Auth actions
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithDiscord: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}
