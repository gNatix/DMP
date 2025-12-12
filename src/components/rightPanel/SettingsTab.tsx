import { User, LogOut, Mail, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../auth/supabaseClient';

interface SettingsTabProps {
  // Future props for user data, logout, etc.
}

const SettingsTab = ({}: SettingsTabProps) => {
  // Use mergedUser for display - it's the stable, merged user object
  const { mergedUser, isLoading, signIn, signUp, signInWithGoogle, signOut } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debug: Log auth state on every render
  console.log('[SettingsTab] Render - isLoading:', isLoading, 'mergedUser:', mergedUser?.id || 'null');

  // Test Supabase connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const startTime = Date.now();
        
        const { error } = await supabase
          .from('profiles')
          .select('count')
          .limit(1)
          .single();
        
        const elapsed = Date.now() - startTime;
        console.log(`[Supabase] Connection test: ${elapsed}ms`, error ? 'FAILED' : 'OK');
      } catch (err) {
        console.error('[Supabase] Connection test failed:', err);
      }
    };
    
    testConnection();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccessMessage('Account created! Check your email to confirm.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          setSuccessMessage('Successfully logged in!');
          setEmail('');
          setPassword('');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSuccessMessage('Successfully logged out');
    } catch (err) {
      setError('Failed to log out');
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
        setIsSubmitting(false);
      }
      // Don't set isSubmitting false on success - user will be redirected
    } catch (err) {
      setError('Failed to sign in with Google');
      setIsSubmitting(false);
      console.error(err);
    }
  };

  // Only show loading if we're loading AND have a user (checking session)
  // If no user, always show login form
  if (isLoading && mergedUser) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Account Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Account
        </h3>
        
        {/* Avatar & User Info */}
        <div className="bg-dm-dark rounded-lg p-4 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-dm-panel flex items-center justify-center border-2 border-dm-border">
              {mergedUser?.avatar_url ? (
                <img src={mergedUser.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              {mergedUser ? (
                <>
                  <p className="text-sm font-medium text-gray-200">
                    {mergedUser.display_name || mergedUser.username || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{mergedUser.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">Not logged in</p>
                  <p className="text-xs text-gray-500 mt-1">Sign in to sync your data</p>
                </>
              )}
            </div>
          </div>

          {/* Auth Form or Logout */}
          {mergedUser ? (
            <button
              onClick={handleSignOut}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email Input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full bg-dm-panel border border-dm-border rounded py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-dm-panel border border-dm-border rounded py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                  />
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                  {successMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-dm-highlight hover:bg-dm-highlight/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
              >
                {isSubmitting ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dm-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-dm-dark text-gray-500">OR</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isSubmitting ? 'Redirecting...' : `Continue with Google`}
              </button>

              {/* Toggle Sign Up / Sign In */}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-xs text-dm-highlight hover:text-dm-highlight/80 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </form>
          )}
        </div>

        {/* Account Settings (only show when logged in) */}
        {mergedUser && (
          <div className="bg-dm-dark rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Settings
            </h4>
            <div className="space-y-2">
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Profile Settings
              </button>
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Privacy
              </button>
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Data & Storage
              </button>
            </div>
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="border-t border-dm-border pt-4">
        <div className="text-xs text-gray-500 space-y-1">
          <p>DM Planner v1.0.0</p>
          <p>© 2025 All rights reserved</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
