import { useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthContext';
import type { AuthUser, AuthProvider as AuthProviderType } from './types';

/**
 * AuthProvider - Clean Reset
 * 
 * DESIGN PRINCIPLES:
 * 1. Minimal state (just user + loading)
 * 2. Single source of truth (onAuthStateChange)
 * 3. No complex logic, no race conditions
 * 4. Works reliably every time
 */

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Determine auth provider from Supabase user
 */
function getAuthProvider(supabaseUser: { app_metadata?: Record<string, unknown> }): AuthProviderType {
  const provider = supabaseUser.app_metadata?.provider as string;
  if (provider === 'google') return 'google';
  if (provider === 'discord') return 'discord';
  return 'email';
}

/**
 * Get best handle for user (email or username)
 */
function getUserHandle(supabaseUser: { email?: string; user_metadata?: Record<string, unknown> }, provider: AuthProviderType): string {
  if (provider === 'discord') {
    // Discord: use username if email not available
    const metadata = supabaseUser.user_metadata || {};
    return supabaseUser.email || (metadata.full_name as string) || (metadata.name as string) || 'discord_user';
  }
  // Google/Email: always has email
  return supabaseUser.email || '';
}

/**
 * Generate a fallback username from email (part before @)
 */
function generateUsernameFromEmail(email: string): string {
  if (!email) return 'User';
  const localPart = email.split('@')[0];
  // Clean up: remove dots and plus suffixes, capitalize first letter
  const cleaned = localPart
    .replace(/\+.*$/, '') // Remove +suffix (like user+test@email.com)
    .replace(/\./g, '') // Remove dots
    .toLowerCase();
  return cleaned || 'User';
}

/**
 * Convert Supabase user to our simple AuthUser
 */
function toAuthUser(supabaseUser: { 
  id: string; 
  email?: string; 
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}): AuthUser {
  const metadata = supabaseUser.user_metadata || {};
  const authProvider = getAuthProvider(supabaseUser);
  
  // Get display name from OAuth or fallback to email username
  const oAuthName = (metadata.full_name as string) || (metadata.name as string);
  const fallbackName = generateUsernameFromEmail(supabaseUser.email || '');
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    displayName: oAuthName || fallbackName,
    avatarUrl: (metadata.avatar_url as string) || (metadata.picture as string) || undefined,
    authProvider,
    handle: getUserHandle(supabaseUser, authProvider),
  };
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(toAuthUser(session.user));
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toAuthUser(session.user));
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  // Sign up with email/password
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error as Error | null };
  };

  // Sign in with Google (redirect)
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  // Sign in with Discord (redirect)
  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { 
        redirectTo: window.location.origin,
      },
    });
    return { error: error as Error | null };
  };

  // Sign out
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signInWithDiscord, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
