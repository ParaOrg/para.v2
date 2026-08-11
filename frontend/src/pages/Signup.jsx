import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import paralogo from "../assets/images/Para1P.png";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signup, login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Please enter your name."); return; }
    if (!email.trim()) { setError("Please enter your email."); return; }

    setLoading(true);
    try {
      if (signup) {
        await signup(email, name);
      } else {
        await login(email);
      }
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={paralogo} alt="Para PH" className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-[#381D65]">
            {success ? "Welcome to Para PH!" : "Create your account"}
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            {success
              ? "You're all set. Redirecting..."
              : "Join the community. No passwords needed."}
          </p>
        </div>

        {!success && (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#7A4BC8] focus:ring-2 focus:ring-[#7A4BC8]/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@example.com"
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#7A4BC8] focus:ring-2 focus:ring-[#7A4BC8]/10 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm hover:bg-[#6a3cb8] transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>

            <p className="text-center text-xs text-gray-400">
              Already have an account?{" "}
              <Link to="/login" className="text-[#7A4BC8] font-semibold hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
