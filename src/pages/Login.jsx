import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthPageLayout from "../components/AuthPageLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Enter your email to continue."); return; }
    setLoading(true);
    try {
      await login(email, "");
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    setError("");
    if (!phone || phone.length < 10) { setError("Enter a valid phone number."); return; }
    setLoading(true);
    try {
      const pseudoEmail = `${phone}@phone.para.ph`;
      await login(pseudoEmail, "");
      navigate("/");
    } catch (err) {
      setError(err.message || "Login failed.");
    }
    setLoading(false);
  };

  return (
    <AuthPageLayout variant="center">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Welcome Back</h2>
        <p className="text-gray-500 text-sm mb-6">No password needed.</p>

        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}

        <form onSubmit={handleEmailLogin} className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center" />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors">
            {loading ? "Signing in…" : "Continue with Email"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <div className="flex gap-2">
          <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold">+63</span>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="9171234567" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <button onClick={handlePhoneLogin} disabled={loading}
          className="w-full mt-2 py-3 rounded-xl font-bold text-sm text-white bg-green-600 hover:bg-green-500 disabled:opacity-50">
          {loading ? "Signing in…" : "Continue with Phone"}
        </button>

        <p className="mt-4 text-sm text-gray-500">
          Don't have an account? <Link to="/signup" className="text-purple-800 font-semibold hover:underline">Sign Up</Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
