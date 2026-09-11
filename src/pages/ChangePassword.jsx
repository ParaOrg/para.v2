import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabase";
import AuthPageLayout from "../components/AuthPageLayout";
import PasswordStrengthMeter, { EyeIcon } from "../components/PasswordStrengthMeter";
import { validatePassword, PW_MIN_LENGTH } from "../utils/passwordValidation";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!password) { setError("Enter a new password."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    // Same rules as signup — single source of truth in passwordValidation.js
    const { missing } = validatePassword(password);
    if (missing.length > 0) {
      setError(`Password needs: ${missing.join(", ")}.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setConfirm("");
      setSuccess("Password updated! Redirecting to home...");
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("same password") || msg.includes("should be different")) {
        setError("New password must be different from your current one.");
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else if (msg.includes("password")) {
        setError("Password does not meet security requirements. Try a stronger one.");
      } else {
        setError(err?.message || "Failed to change password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-center pr-12";

  return (
    <AuthPageLayout variant="center">
      <div className="text-center">
        <h2 className="text-2xl font-black text-gray-900 mb-2">Change Password</h2>
        <p className="text-gray-500 text-sm mb-6">Enter your new password below.</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm text-left">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-600 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3" autoComplete="off">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`New password (min ${PW_MIN_LENGTH} chars, symbol required)`}
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>

          {/* Live strength meter + rule checklist — same component as signup */}
          <PasswordStrengthMeter password={password} />

          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <EyeIcon open={showConfirm} />
            </button>
          </div>

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
