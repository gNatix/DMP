import { useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthContext';
import type { Profile, MergedUser } from './types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mergedUser, setMergedUser] = useState<MergedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Fetch profile from database (internal helper)
   * This is "best effort" - failure should not block functionality
   */
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('[AUTH] Profile fetch warning:', error.message);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.warn('[AUTH] Profile fetch exception:', error);
      return null;
    }
  }, []);

  /**
   * Build merged user from auth user + optional profile
   * CRITICAL: This ALWAYS returns a valid MergedUser if authUser is valid
   * Profile data is "best effort" - missing profile should NOT block functionality
   */
  const buildMergedUser = useCallback((authUser: User, profileData: Profile | null): MergedUser => {
    return {
      id: authUser.id, // GUARANTEED to be valid UUID from Supabase
      email: authUser.email || '',
      username: profileData?.username,
      display_name: profileData?.display_name ?? undefined,
      avatar_url: profileData?.avatar_url ?? undefined,
    };
  }, []);

  /**
   * CRITICAL: Get authenticated user with fresh data
   * - ALWAYS fetches fresh auth user from Supabase
   * - Enriches with profile data (best effort)
   * - NEVER returns null just because profile fetch fails
   * - Returns null ONLY if auth user is missing
   */
  const getAuthenticatedUser = useCallback(async (): Promise<MergedUser | null> => {
    try {
      // ALWAYS fetch fresh user from Supabase - never use cached data
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        console.log('[AUTH] getAuthenticatedUser - no auth user');
        return null;
      }

      // Validate user.id is a valid UUID string
      if (!authUser.id || typeof authUser.id !== 'string' || authUser.id.length < 36) {
        console.error('[AUTH] CRITICAL: Invalid user.id:', authUser.id);
        return null;
      }

      console.log('[AUTH] Valid user.id:', authUser.id);

      // Fetch profile (best effort - failure should NOT return null)
      const profileData = await fetchProfile(authUser.id);

      // Build and return merged user - ALWAYS succeeds if authUser is valid
      const merged = buildMergedUser(authUser, profileData);
      console.log('[AUTH] Merged user ready:', { id: merged.id, email: merged.email });
      return merged;
    } catch (error) {
      console.error('[AUTH] getAuthenticatedUser exception:', error);
      return null;
    }
  }, [fetchProfile, buildMergedUser]);

  /**
   * Update local state with user data
   */
  const updateUserState = useCallback(async (authUser: User | null) => {
    console.log('[AUTH] updateUserState called with:', authUser?.id || 'null');
    setUser(authUser);
    
    if (!authUser) {
      console.log('[AUTH] No authUser - clearing state');
      setProfile(null);
      setMergedUser(null);
      return;
    }

    // Validate user.id
    if (!authUser.id || typeof authUser.id !== 'string' || authUser.id.length < 36) {
      console.error('[AUTH] CRITICAL: Invalid user.id on state update:', authUser.id);
      setUser(null);
      setProfile(null);
      setMergedUser(null);
      return;
    }

    console.log('[AUTH] Valid user, fetching profile...');
    
    // Fetch profile (best effort)
    const profileData = await fetchProfile(authUser.id);
    setProfile(profileData);

    // Build merged user - ALWAYS succeeds if authUser is valid
    const merged = buildMergedUser(authUser, profileData);
    setMergedUser(merged);
    
    console.log('[AUTH] State updated - mergedUser set:', { id: merged.id, email: merged.email });
  }, [fetchProfile, buildMergedUser]);

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;
    let initialized = false;

    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Initializing with getSession()...');
        
        // Use getSession() first - it's fast (from localStorage)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.log('[AUTH] Session error:', sessionError.message);
          if (mounted) setIsLoading(false);
          initialized = true;
          return;
        }

        // If no session, user is not logged in
        if (!session || !session.user) {
          console.log('[AUTH] No session - not logged in');
          if (mounted) setIsLoading(false);
          initialized = true;
          return;
        }

        console.log('[AUTH] Session found, user:', session.user.id);
        
        // Use session.user directly for faster init
        if (mounted) {
          await updateUserState(session.user);
          setSession(session);
          setIsLoading(false);
          initialized = true;
        }
      } catch (error) {
        console.error('[AUTH] Init exception:', error);
        if (mounted) {
          setIsLoading(false);
          initialized = true;
        }
      }
    };

    // Safety timeout - never stay loading more than 3 seconds
    const timeout = setTimeout(() => {
      if (mounted && !initialized) {
        console.warn('[AUTH] Init timeout - forcing ready state');
        setIsLoading(false);
      }
    }, 3000);

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('[AUTH] State change event:', event, 'session:', currentSession ? 'exists' : 'null');

      if (!mounted) {
        console.log('[AUTH] Not mounted, ignoring state change');
        return;
      }

      setSession(currentSession);

      // Use session.user directly - it's provided by Supabase
      const sessionUser = currentSession?.user || null;
      console.log('[AUTH] Session user:', sessionUser?.id || 'null');
      
      await updateUserState(sessionUser);
      setIsLoading(false);
      
      console.log('[AUTH] State change handling complete');
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [updateUserState]);

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        options: { redirectTo: window.location.origin },
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

  /**
   * STABLE LOGOUT - Guaranteed to work
   * 1. Call supabase.auth.signOut()
   * 2. Clear ALL local state
   * 3. Hard reload the page to ensure no stale state remains
   */
  const signOut = async () => {
    try {
      console.log('[AUTH] Signing out...');
      
      // Call Supabase signout
      await supabase.auth.signOut();
      
      // Clear all local state
      setUser(null);
      setSession(null);
      setProfile(null);
      setMergedUser(null);
      setIsLoading(false);
      
      console.log('[AUTH] Signed out - reloading page');
      
      // CRITICAL: Hard reload to clear ALL stale state
      window.location.reload();
    } catch (error) {
      console.error('[AUTH] Signout error:', error);
      // Even on error, force reload to clear state
      window.location.reload();
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user?.id) {
        return { error: new Error('No user logged in') };
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.error('[AUTH] Profile update error:', error.message);
        return { error };
      }

      // Refresh profile and merged user
      const updatedProfile = await fetchProfile(user.id);
      setProfile(updatedProfile);
      setMergedUser(buildMergedUser(user, updatedProfile));
      
      return { error: null };
    } catch (error) {
      console.error('[AUTH] Profile update exception:', error);
      return { error: error as Error };
    }
  };

  const value = {
    user,
    session,
    profile,
    mergedUser,
    isLoading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    getAuthenticatedUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
