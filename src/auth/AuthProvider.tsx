import { useState, useEffect, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthContext';
import type { Profile } from './types';

interface AuthProviderProps {
  children: ReactNode;
}

// Merged user type combining auth user and profile
export interface MergedUser {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * CRITICAL: Get authenticated user with profile merged
   * ALWAYS fetches fresh data from Supabase - never uses cached/stale data
   * This ensures user.id is ALWAYS a valid UUID
   */
  const getAuthenticatedUser = async (): Promise<MergedUser | null> => {
    try {
      // ALWAYS fetch fresh user from Supabase - DO NOT use cached user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.error('[AUTH] getAuthenticatedUser - no auth user:', authError?.message);
        return null;
      }

      // CRITICAL: Validate user.id is a valid UUID string
      if (!authUser.id || typeof authUser.id !== 'string' || authUser.id.length < 36) {
        console.error('[AUTH] ❌ CRITICAL: user.id is INVALID:', typeof authUser.id, authUser.id);
        console.error('[AUTH] Full user object:', authUser);
        return null;
      }

      console.log('[AUTH] ✅ Valid user.id:', authUser.id);

      // Fetch profile from database
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        console.warn('[AUTH] Profile fetch failed, using auth user only:', profileError.message);
      }

      // Merge auth user + profile into single object
      const mergedUser: MergedUser = {
        id: authUser.id, // GUARANTEED to be valid UUID
        email: authUser.email || '',
        username: profileData?.username,
        display_name: profileData?.display_name,
        avatar_url: profileData?.avatar_url,
      };

      console.log('[AUTH] Merged user ready:', { id: mergedUser.id, email: mergedUser.email, username: mergedUser.username });
      return mergedUser;
    } catch (error) {
      console.error('[AUTH] getAuthenticatedUser exception:', error);
      return null;
    }
  };

  // Fetch profile only (internal helper)
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AUTH] Profile fetch error:', error.message);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('[AUTH] fetchProfile exception:', error);
      return null;
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Initializing...');
        
        // CRITICAL: Use getUser() NOT getSession() for user data
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (error) {
          console.error('[AUTH] Init error:', error.message);
          if (mounted) {
            setIsLoading(false);
          }
          return;
        }

        if (mounted) {
          setUser(authUser);

          if (authUser) {
            // CRITICAL: Validate user.id before using it
            if (!authUser.id || typeof authUser.id !== 'string') {
              console.error('[AUTH] ❌ CRITICAL: Invalid user.id on init:', authUser.id);
              setUser(null);
              setProfile(null);
              setIsLoading(false);
              return;
            }

            console.log('[AUTH] User authenticated:', authUser.id);

            // Fetch profile
            const profileData = await fetchProfile(authUser.id);
            if (mounted) {
              setProfile(profileData);
            }
          }

          setIsLoading(false);
        }
      } catch (error) {
        console.error('[AUTH] Init exception:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[AUTH] State change:', event);

      if (mounted) {
        setSession(currentSession);
        
        // CRITICAL: ALWAYS re-fetch user using getUser() to ensure fresh, valid data
        // DO NOT use session.user - it may be stale
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        
        // Validate before setting
        if (freshUser && (!freshUser.id || typeof freshUser.id !== 'string')) {
          console.error('[AUTH] ❌ CRITICAL: Invalid user.id from auth state change:', freshUser.id);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setUser(freshUser);
        setIsLoading(false);

        // Fetch profile in background
        if (freshUser?.id) {
          const profileData = await fetchProfile(freshUser.id);
          if (mounted) {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('[AUTH] Signup error:', error.message);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[AUTH] Signup exception:', error);
      return { error: error as Error };
    }
  };

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[AUTH] Signin error:', error.message);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[AUTH] Signin exception:', error);
      return { error: error as Error };
    }
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error('[AUTH] Google signin error:', error.message);
        return { error };
      }

      return { error: null };
    } catch (error) {
      console.error('[AUTH] Google signin exception:', error);
      return { error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[AUTH] Signout error:', error.message);
        throw error;
      }

      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('[AUTH] Signout exception:', error);
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user?.id) {
        throw new Error('No user logged in');
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('[AUTH] Profile update error:', error.message);
        throw error;
      }

      // Refresh profile
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
    } catch (error) {
      console.error('[AUTH] Profile update exception:', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    profile,
    isLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    getAuthenticatedUser, // CRITICAL: Export this function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
