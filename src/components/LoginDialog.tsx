import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Mail, Lock, Scroll, Sparkles, LogIn } from 'lucide-react';

const LoginDialog = () => {
  const { signIn, signUp, signInWithGoogle, signInWithDiscord } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
      }
      // Don't set isSubmitting - popup handles the flow
    } catch (err) {
      setError('Failed to sign in with Google');
      console.error(err);
    }
  };

  const handleDiscordSignIn = async () => {
    setError(null);
    try {
      const { error: discordError } = await signInWithDiscord();
      if (discordError) {
        setError(discordError.message);
      }
      // Don't set isSubmitting - popup handles the flow
    } catch (err) {
      setError('Failed to sign in with Discord');
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-dm-dark via-dm-panel to-dm-dark flex items-center justify-center">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* Main container */}
      <div className="relative w-full max-w-6xl mx-4 bg-dm-dark/90 backdrop-blur-sm rounded-2xl border border-dm-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="text-center py-8 border-b border-dm-border bg-gradient-to-r from-dm-highlight/10 via-purple-500/10 to-dm-highlight/10">
          <h1 className="text-4xl font-bold text-white mb-2">
            Welcome to <span className="text-dm-highlight">DungeonPlan</span>
          </h1>
          <p className="text-gray-400 text-lg">A better way to plan your RPG campaigns</p>
        </div>

        {/* Three columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-dm-border">
          
          {/* Column 1: News */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-semibold text-white">News</h2>
            </div>
            <div className="space-y-4">
              <div className="bg-dm-panel rounded-lg p-4 border border-dm-border">
                <p className="text-sm text-dm-highlight font-medium mb-1">December 2025</p>
                <h3 className="text-white font-medium mb-2">🎉 Beta Launch!</h3>
                <p className="text-gray-400 text-sm">
                  DungeonPlan is now in open beta! Create maps, manage tokens, 
                  and plan your campaigns with our intuitive tools.
                </p>
              </div>
              <div className="bg-dm-panel rounded-lg p-4 border border-dm-border">
                <p className="text-sm text-dm-highlight font-medium mb-1">Coming Soon</p>
                <h3 className="text-white font-medium mb-2">🗺️ Map Sharing</h3>
                <p className="text-gray-400 text-sm">
                  Share your maps with other DMs and collaborate on campaigns together.
                </p>
              </div>
              <div className="bg-dm-panel rounded-lg p-4 border border-dm-border">
                <p className="text-sm text-dm-highlight font-medium mb-1">Coming Soon</p>
                <h3 className="text-white font-medium mb-2">🎭 NPC Generator</h3>
                <p className="text-gray-400 text-sm">
                  AI-powered NPC generation with personalities, backstories, and stat blocks.
                </p>
              </div>
            </div>
          </div>

          {/* Column 2: Changelog */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Scroll className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-white">Changelog</h2>
            </div>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-dm-border">
              <div className="border-l-2 border-green-500 pl-3">
                <p className="text-xs text-gray-500">v1.0.0</p>
                <p className="text-sm text-gray-300">Initial release with core features</p>
              </div>
              <div className="border-l-2 border-dm-highlight pl-3">
                <p className="text-xs text-gray-500">Features</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Canvas with pan & zoom</li>
                  <li>• Token management</li>
                  <li>• Room builder tools</li>
                  <li>• Terrain painting</li>
                  <li>• Scene management</li>
                  <li>• Cloud sync</li>
                </ul>
              </div>
              <div className="border-l-2 border-blue-500 pl-3">
                <p className="text-xs text-gray-500">Authentication</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Google OAuth</li>
                  <li>• Discord OAuth</li>
                  <li>• Email/Password</li>
                </ul>
              </div>
              <div className="border-l-2 border-purple-500 pl-3">
                <p className="text-xs text-gray-500">Tools</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Annotation system</li>
                  <li>• Widgets & info boxes</li>
                  <li>• Stat blocks</li>
                  <li>• Encounter tables</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Column 3: Login */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <LogIn className="w-5 h-5 text-dm-highlight" />
              <h2 className="text-lg font-semibold text-white">
                {isSignUp ? 'Create Account' : 'Sign In'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
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
                    className="w-full bg-dm-panel border border-dm-border rounded-lg py-2.5 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
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
                    className="w-full bg-dm-panel border border-dm-border rounded-lg py-2.5 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight transition-colors"
                  />
                </div>
              </div>

              {/* Error/Success */}
              {error && (
                <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-2">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded-lg p-2">
                  {successMessage}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-dm-highlight hover:bg-dm-highlight/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg transition-colors font-medium"
              >
                {isSubmitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dm-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-dm-dark text-gray-500">OR CONTINUE WITH</span>
                </div>
              </div>

              {/* OAuth Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* Google */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                  className="bg-white hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>

                {/* Discord */}
                <button
                  type="button"
                  onClick={handleDiscordSignIn}
                  disabled={isSubmitting}
                  className="bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                  </svg>
                  Discord
                </button>
              </div>

              {/* Toggle Sign Up / Sign In */}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-sm text-dm-highlight hover:text-dm-highlight/80 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4 border-t border-dm-border bg-dm-panel/50">
          <p className="text-xs text-gray-500">
            DungeonPlan © 2025 • Made with ❤️ for Dungeon Masters
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginDialog;
