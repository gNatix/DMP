import { useState, useEffect, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { AuthContext } from './AuthContext';
import type { Profile } from './types';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile from database
  const fetchProfile = async (userId: string) => {
    try {
      console.log('[AUTH] fetchProfile called for userId:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AUTH] Error fetching profile:', error);
        return null;
      }

      console.log('[AUTH] Profile data:', data);
      return data as Profile;
    } catch (error) {
      console.error('[AUTH] Error in fetchProfile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    console.log('[AUTH] AuthProvider initializing...');

    const initializeAuth = async () => {
      try {
        console.log('[AUTH] Getting session...');
        // Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        console.log('[AUTH] Session retrieved:', initialSession?.user?.email || 'No user');

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);

          if (initialSession?.user) {
            console.log('[AUTH] Fetching profile for user:', initialSession.user.id);
            const userProfile = await fetchProfile(initialSession.user.id);
            console.log('[AUTH] Profile fetched:', userProfile?.username || 'No profile');
            setProfile(userProfile);
          }

          setIsLoading(false);
          console.log('[AUTH] Initialization complete, isLoading set to false');
        }
      } catch (error) {
        console.error('[AUTH] Error initializing auth:', error);
        console.warn('[AUTH] Auth features will be disabled due to initialization error');
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      console.log('[AUTH] State change:', _event, currentSession?.user?.email);

      if (mounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        // Set loading to false immediately - don't wait for profile fetch
        setIsLoading(false);

        // Fetch profile in background if user exists
        if (currentSession?.user) {
          console.log('[AUTH] Fetching profile in background...');
          const userProfile = await fetchProfile(currentSession.user.id);
          console.log('[AUTH] Background profile fetch complete:', userProfile?.username);
          if (mounted) {
            setProfile(userProfile);
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
        console.error('Signup error:', error);
        return { error };
      }

      console.log('[AUTH] Signup successful:', data.user?.email);
      return { error: null };
    } catch (error) {
      console.error('Signup exception:', error);
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
        console.error('Signin error:', error);
        return { error };
      }

      console.log('[AUTH] Signin successful:', data.user?.email);
      return { error: null };
    } catch (error) {
      console.error('Signin exception:', error);
      return { error: error as Error };
    }
  };

  // Sign in with Google OAuth
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
        },
      });

      if (error) {
        console.error('Google signin error:', error);
        return { error };
      }

      console.log('[AUTH] Google signin initiated');
      return { error: null };
    } catch (error) {
      console.error('Google signin exception:', error);
      return { error: error as Error };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Signout error:', error);
        throw error;
      }

      console.log('[AUTH] Signout successful');
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error('Signout exception:', error);
      throw error;
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) {
        return { error: new Error('No user logged in') };
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Update profile error:', error);
        return { error };
      }

      setProfile(data as Profile);
      console.log('[AUTH] Profile updated:', data);
      return { error: null };
    } catch (error) {
      console.error('Update profile exception:', error);
      return { error: error as Error };
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
