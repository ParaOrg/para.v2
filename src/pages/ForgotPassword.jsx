import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../utils/supabase";
import AuthPageLayout from "../components/AuthPageLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!email.trim()) { setError("Enter your email."); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/change-password`,
      });
      if (error) throw error;
      setSuccess("Password reset link sent! Check your email.");
    } catch (err) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout variant="center">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Forgot Password</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send a reset link.</p>

        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
        {success && <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm">{success}</div>}

        <form onSubmit={handleResetRequest} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500">
          <Link to="/login" className="text-purple-800 font-semibold hover:underline">Back to login</Link>
        </p>
      </div>
    </AuthPageLayout>
  );
}
