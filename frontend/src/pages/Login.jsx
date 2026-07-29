import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import AuthPageLayout from '../components/AuthPageLayout';

const FIREBASE_ERROR_MESSAGES = {
  'auth/invalid-credential':                    'Invalid email or password.',
  'auth/user-not-found':                        'Invalid email or password.',
  'auth/wrong-password':                        'Invalid email or password.',
  'auth/user-disabled':                         'This account has been disabled. Contact support.',
  'auth/too-many-requests':                     'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':                'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user':                  'Sign-in was cancelled. Try again if you want to continue.',
  'auth/popup-blocked':                         'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/cancelled-popup-request':               'Another sign-in popup is already open.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email using a different sign-in method. Sign in that way first, or use another Google account.',
  'auth/unauthorized-domain':                 'This domain is not authorized for sign-in. Contact support.',
  'auth/invalid-api-key':                     'Firebase is misconfigured: replace placeholder values in .env.frontend.dev with your project\u2019s web config from Firebase Console.',
};

function EyeIcon({ open }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function Login() {
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [info, setInfo]                 = useState('');
  const [loading, setLoading]           = useState(false);

  const { login, loginWithGoogle, requestPasswordReset } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      await login(normalizedEmail, password);
      navigate('/');
    } catch (err) {
      const isCredentialError = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(err.code);

      if (isCredentialError && normalizedEmail) {
        try {
          const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
          if (methods.includes('google.com') && !methods.includes('password')) {
            setError('This account uses Google sign-in. Please tap "Continue with Google" below.');
          } else if (methods.length === 0) {
            setError('No account found for this email. Create an account first.');
          } else {
            setError('Invalid email or password.');
          }
        } catch {
          setError('Invalid email or password.');
        }
      } else {
        setError(FIREBASE_ERROR_MESSAGES[err.code] ?? 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err) {
      setError(FIREBASE_ERROR_MESSAGES[err.code] ?? 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    setError('');
    setInfo('');

    if (!normalizedEmail) {
      setError('Enter your email first, then tap "Forgot password?"');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(normalizedEmail);
      setInfo('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(FIREBASE_ERROR_MESSAGES[err.code] ?? 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout>
      <div className="text-center mb-10">
        <h2 className="text-4xl md:text-[2.25rem] font-black text-gray-900 mb-3">Welcome Back!</h2>
        <p className="text-gray-600 text-lg md:text-xl leading-snug">Help shape simpler commutes across Metro Manila</p>
      </div>

      {error && (
        <div className="mb-5 px-5 py-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-base">
          {error}
        </div>
      )}

      {info && (
        <div className="mb-5 px-5 py-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-base">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Email */}
        <div>
          <label className="block text-base font-bold text-gray-800 mb-2">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            className="w-full px-5 py-4 rounded-xl text-gray-900 text-lg placeholder-gray-400
                       bg-gray-50 border-2 border-gray-200
                       focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-base font-bold text-gray-800 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              className="w-full px-5 py-4 pr-12 rounded-xl text-gray-900 text-lg placeholder-gray-400
                         bg-gray-50 border-2 border-gray-200
                         focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={loading}
            className="text-sm font-semibold text-purple-900 hover:text-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-6 py-5 rounded-full font-black text-lg md:text-xl text-white
                     bg-purple-900 hover:bg-pink-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200
                     shadow-lg shadow-purple-500/20"
        >
          {loading ? 'Signing in\u2026' : "Let's Go!"}
        </button>
      </form>

      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm uppercase tracking-wider">
          <span className="px-5 py-1.5 rounded-full text-gray-500 bg-white font-bold">Or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-4 rounded-full font-bold text-base md:text-lg
                   bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-200
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-sm"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      <div className="mt-8 text-center space-y-3">
        <p className="text-base md:text-lg text-gray-600">
          New to Para?{' '}
          <Link
            to="/signup"
            className="text-purple-800 hover:text-purple-900 font-bold transition-colors"
          >
            Join the community
          </Link>
        </p>
        <p className="text-sm text-gray-500">
          Helping commuters find their way since 2026
        </p>
      </div>
    </AuthPageLayout>
  );
}
