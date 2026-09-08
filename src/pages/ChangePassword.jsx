import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import AuthPageLayout from "../components/AuthPageLayout";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password) { setError("Enter a new password."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess("Password updated! Redirecting to home...");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setError(err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageLayout variant="center">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Change Password</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>

        {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
        {success && <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm">{success}</div>}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </AuthPageLayout>
  );
}
