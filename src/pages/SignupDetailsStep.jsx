import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthPageLayout from '../components/AuthPageLayout';
import { useAuth } from '../context/AuthContext';

const ROLE_OPTIONS = [
  { value: 'commuter', label: 'Commuter', desc: 'Naghahanap ng ruta' },
  { value: 'driver', label: 'Driver', desc: 'Nag-aalok ng sakay' },
];

const inputClass = `w-full px-4 py-2.5 rounded-lg text-gray-900 text-sm placeholder-gray-400
  bg-gray-50 border border-gray-200
  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all`;

export default function SignupDetailsStep({ onSuccess }) {
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [coopName, setCoopName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showPassword, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState('commuter');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Enter your email.'); return; }
    if (!password) { setError('Enter a password.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const result = await signup(email.trim(), password, name || email.split('@')[0]);

      if (result?.user?.id) {
        onSuccess({
          uid: result.user.id,
          email: result.user.email,
          needsConfirmation: result.needsConfirmation,
        });
      } else {
        setError('Registration did not return a user. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout variant="split">
      <h2 className="text-xl font-black text-gray-900 text-center mb-1">Gumawa ng Account</h2>
      <p className="text-gray-500 text-sm text-center mb-4">Sumali sa komunidad ng mga commuter</p>

      {error && (
        <div className="mb-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          autoComplete="name" placeholder="Buong pangalan" required className={inputClass}
        />
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          autoComplete="email" placeholder="you@example.com" required className={inputClass}
        />

        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" placeholder="Password (min 6 characters)" required className={inputClass}
          />
          <button type="button" onClick={() => setShowPw(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>

        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword} onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password" placeholder="Confirm password" required className={inputClass}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
            {showConfirm ? '🙈' : '👁️'}
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold select-none whitespace-nowrap">+63</div>
          <input
            type="tel" value={contact} onChange={(e) => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
            autoComplete="tel" placeholder="9XXXXXXXXX" required inputMode="numeric"
            className={`flex-1 px-4 py-2.5 rounded-lg text-gray-900 text-sm placeholder-gray-400 bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(({ value, label, desc }) => {
            const active = role === value;
            return (
              <button
                key={value} type="button" onClick={() => setRole(value)}
                className={`p-2.5 rounded-lg border-2 text-center transition-all ${active ? 'border-purple-700 bg-purple-50' : 'border-gray-200 bg-white'}`}
              >
                <span className={`block text-sm font-bold ${active ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
                <span className={`text-xs ${active ? 'text-purple-700' : 'text-gray-400'}`}>{desc}</span>
              </button>
            );
          })}
        </div>

        {role === 'driver' && (
          <div className="space-y-2">
            <input
              type="text" value={coopName} onChange={(e) => setCoopName(e.target.value)}
              placeholder="Kooperatiba" className={inputClass}
            />
            <input
              type="text" value={affiliation} onChange={(e) => setAffiliation(e.target.value)}
              placeholder="Grupo (hal. MANIBELA, PISTON)" className={inputClass}
            />
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 rounded-lg font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Gumagawa…' : 'Gumawa ng Account'}
        </button>
      </form>

      <p className="mt-3 text-center text-sm text-gray-500">
        May account na? <Link to="/login" className="text-purple-800 font-semibold hover:underline">Mag-login</Link>
      </p>
    </AuthPageLayout>
  );
}
