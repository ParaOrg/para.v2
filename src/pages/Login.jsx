import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthPageLayout from "../components/AuthPageLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email to continue."); return; }
    if (!password) { setError("Enter your password."); return; }
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout variant="center">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-gray-500 text-sm mb-6">Sign in with your email and password.</p>

        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center" />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500">
          Don't have an account? <Link to="/signup" className="text-purple-800 font-semibold hover:underline">Sign Up</Link>
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Forgot password? <Link to="/signup" className="text-purple-800 font-semibold hover:underline">Reset here</Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
