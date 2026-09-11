import { useState } from "react";
import { Link } from "react-router-dom";
import AuthPageLayout from "../components/AuthPageLayout";
import PasswordStrengthMeter, { EyeIcon } from "../components/PasswordStrengthMeter";
import { validatePassword, PW_MIN_LENGTH } from "../utils/passwordValidation";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../utils/supabase";

const ROLE_OPTIONS = [
  { value: "commuter", label: "Commuter", desc: "Naghahanap ng ruta" },
  { value: "driver", label: "Driver", desc: "Nag-aalok ng sakay" },
];

const inputClass = `w-full px-4 py-2.5 rounded-lg text-gray-900 text-sm placeholder-gray-400
  bg-gray-50 border border-gray-200
  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all`;

export default function SignupDetailsStep({ onSuccess }) {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [coopName, setCoopName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [showPassword, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [role, setRole] = useState("commuter");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) { setError("Enter your email."); return; }
    if (!password) { setError("Enter a password."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    // Shared password validation — same rules as ChangePassword
    const { missing } = validatePassword(password);
    if (missing.length > 0) {
      setError(`Password needs: ${missing.join(", ")}.`);
      return;
    }

    // PH mobile validation
    const digits = (contact || "").replace(/\D/g, "");
    if (digits.length !== 10 || !digits.startsWith("9")) {
      setError("Enter a valid PH mobile number (10 digits starting with 9).");
      return;
    }
    const contactE164 = `+63${digits}`;

    setLoading(true);
    try {
      // Pre-flight duplicate email check via RPC.
      // Supabase returns HTTP 200 with a fake user for duplicate signups
      // (anti-enumeration), so we must check BEFORE calling signUp.
      const { data: exists, error: rpcError } = await supabase.rpc("email_exists", {
        check_email: email.trim(),
      });

      if (rpcError) {
        // RPC not deployed yet or failed — fall through and let signUp run.
        console.warn("[signup] email_exists RPC failed:", rpcError.message);
      } else if (exists === true) {
        setError("An account with this email already exists. Try logging in instead.");
        setLoading(false);
        return;
      }
    } catch (rpcErr) {
      console.warn("[signup] email_exists check threw:", rpcErr);
    }
    try {
      const extraMetadata = { contact: contactE164, role };
      if (role === "driver") {
        if (coopName) extraMetadata.coop_name = coopName;
        if (affiliation) extraMetadata.affiliation = affiliation;
      }

      const result = await signup(
        email.trim(),
        password,
        name || email.split("@")[0],
        extraMetadata
      );

      // Layer 2: Detect duplicate signups that slip past the RPC.
      // Supabase returns identities=[] for duplicate signups on some versions.
      const identities = result?.user?.identities;
      if (Array.isArray(identities) && identities.length === 0) {
        setError("An account with this email already exists. Try logging in instead.");
        setLoading(false);
        return;
      }

      if (result?.user?.id) {
        // Clear form state before navigating
        setName("");
        setEmail("");
        setContact("");
        setPassword("");
        setConfirm("");
        setCoopName("");
        setAffiliation("");
        setRole("commuter");
        setShowPw(false);
        setShowConfirm(false);

        onSuccess({
          uid: result.user.id,
          email: result.user.email,
          needsConfirmation: result.needsConfirmation,
        });
      } else {
        setError("Registration did not return a user. Please try again.");
      }
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (
        msg.includes("already registered") ||
        msg.includes("already been registered") ||
        msg.includes("already exists")
      ) {
        setError("An account with this email already exists. Try logging in instead.");
      } else if (msg.includes("already in use")) {
        setError("This email or phone number is already registered.");
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many signup attempts. Please wait a few minutes and try again.");
      } else if (msg.includes("invalid email")) {
        setError("That doesn't look like a valid email address.");
      } else if (msg.includes("password")) {
        setError("Password does not meet security requirements. Please try a stronger one.");
      } else {
        setError(err?.message || "Registration failed. Please try again.");
      }
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

      <form onSubmit={handleSubmit} className="space-y-3" noValidate autoComplete="off">
        {/* Hidden dummy fields — absorb aggressive browser autofill so the
            visible email/password inputs start blank on every visit. */}
        <input
          type="email"
          name="signup-fake-email"
          autoComplete="email"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          tabIndex={-1}
          aria-hidden="true"
        />
        <input
          type="password"
          name="signup-fake-password"
          autoComplete="new-password"
          style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
          tabIndex={-1}
          aria-hidden="true"
        />

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          placeholder="Buong pangalan"
          required
          className={inputClass}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
          className={inputClass}
        />

        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={`Password (min ${PW_MIN_LENGTH} chars, symbol required)`}
            required
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPassword)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>

        <PasswordStrengthMeter password={password} />

        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Confirm password"
            required
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <EyeIcon open={showConfirm} />
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex items-center px-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold select-none whitespace-nowrap">
            +63
          </div>
          <input
            type="tel"
            value={contact}
            onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
            autoComplete="tel"
            placeholder="9XXXXXXXXX"
            required
            inputMode="numeric"
            className={`flex-1 px-4 py-2.5 rounded-lg text-gray-900 text-sm placeholder-gray-400 bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map(({ value, label, desc }) => {
            const active = role === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`p-2.5 rounded-lg border-2 text-center transition-all ${
                  active ? "border-purple-700 bg-purple-50" : "border-gray-200 bg-white"
                }`}
              >
                <span className={`block text-sm font-bold ${active ? "text-gray-900" : "text-gray-500"}`}>
                  {label}
                </span>
                <span className={`text-xs ${active ? "text-purple-700" : "text-gray-400"}`}>{desc}</span>
              </button>
            );
          })}
        </div>

        {role === "driver" && (
          <div className="space-y-2">
            <input
              type="text"
              value={coopName}
              onChange={(e) => setCoopName(e.target.value)}
              placeholder="Kooperatiba"
              className={inputClass}
            />
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="Grupo (hal. MANIBELA, PISTON)"
              className={inputClass}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Gumagawa…" : "Gumawa ng Account"}
        </button>
      </form>

      <p className="mt-3 text-center text-sm text-gray-500">
        May account na?{" "}
        <Link to="/login" className="text-purple-800 font-semibold hover:underline">
          Mag-login
        </Link>
      </p>
    </AuthPageLayout>
  );
}
