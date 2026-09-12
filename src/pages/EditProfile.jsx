import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../context/AuthContext";

const ROLE_OPTIONS = [
  { value: "commuter", label: "Commuter", desc: "Naghahanap ng ruta" },
  { value: "driver", label: "Driver", desc: "Nag-aalok ng sakay" },
];

const inputClass =
  "w-full px-4 py-3 rounded-xl text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white";

export default function EditProfile() {
  const { user, updateProfile, updateHandle, updateEmail, phoneExists } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("commuter");
  const [coopName, setCoopName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [emailChangeSent, setEmailChangeSent] = useState(false);

  useEffect(() => {
    if (searchParams.get("emailChanged") === "1") {
      setSuccess("Email updated successfully.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata || {};
    setName(meta.full_name || "");
    setHandle(meta.handle || "");
    setBio(meta.bio || "");
    setRole(meta.role || "commuter");
    setCoopName(meta.coop_name || "");
    setAffiliation(meta.affiliation || "");
    const rawContact = meta.contact || "";
    setContact(rawContact.startsWith("+63") ? rawContact.slice(3) : rawContact.replace(/\D/g, ""));
    setLoading(false);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <span className="text-5xl">👤</span>
          <h1 className="text-2xl font-black text-gray-900 mt-4">Sign in to edit your profile</h1>
        </div>
      </div>
    );
  }

  const meta = user.user_metadata || {};
  const originalRole = meta.role || "commuter";
  const isPrivileged = originalRole === "admin" || originalRole === "founder";

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const digits = (contact || "").replace(/\D/g, "");
    if (digits && (digits.length !== 10 || !digits.startsWith("9"))) {
      setError("Enter a valid PH mobile number (10 digits starting with 9).");
      return;
    }
    const contactE164 = digits ? `+63${digits}` : "";

    const originalContact = meta.contact || "";
    if (contactE164 && contactE164 !== originalContact) {
      const taken = await phoneExists(contactE164);
      if (taken) {
        setError("This phone number is already registered to another account.");
        return;
      }
    }

    const updates = {};
    if (name && name !== (meta.full_name || "")) updates.full_name = name;
    if (bio !== (meta.bio || "")) updates.bio = bio;
    if (contactE164 !== originalContact) updates.contact = contactE164;
    if (!isPrivileged && role !== originalRole) updates.role = role;
    if (role === "driver") {
      if (coopName !== (meta.coop_name || "")) updates.coop_name = coopName;
      if (affiliation !== (meta.affiliation || "")) updates.affiliation = affiliation;
    }

    setSaving(true);
    try {
      if (Object.keys(updates).length > 0) {
        await updateProfile(updates);
      }
      if (handle && handle !== (meta.handle || "")) {
        await updateHandle(handle, name || meta.full_name);
      }
      setSuccess("Profile updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("already taken")) {
        setError("That handle or phone is already taken by another account.");
      } else if (msg.includes("phone")) {
        setError(err.message);
      } else {
        setError(err?.message || "Failed to update profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEmailChange = async () => {
    setError("");
    setSuccess("");
    const trimmed = newEmail.trim();
    if (!trimmed) { setError("Enter the new email address."); return; }
    if (trimmed === user.email) { setError("That's the same email you already have."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("That doesn't look like a valid email address.");
      return;
    }

    setSaving(true);
    try {
      await updateEmail(trimmed);
      setEmailChangeSent(true);
      setSuccess(`Confirmation sent to ${trimmed}. Check that inbox to finish the change.`);
      setNewEmail("");
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("in use")) {
        setError("That email is already in use by another account.");
      } else if (msg.includes("rate limit")) {
        setError("Too many email change attempts. Please wait a few minutes.");
      } else {
        setError(err?.message || "Failed to update email.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#381D65]">Edit Profile</h1>
          <button
            onClick={() => navigate("/profile")}
            className="text-sm font-semibold text-gray-500 hover:text-[#7A4BC8]"
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Basic Info</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan dela Cruz"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase())}
              placeholder="juandc"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">Letters, numbers, dots, underscores</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide pt-4">Contact</h2>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Phone number</label>
            <div className="flex gap-2">
              <div className="flex items-center px-3 rounded-xl bg-gray-100 border border-gray-300 text-gray-700 text-sm font-bold select-none">
                +63
              </div>
              <input
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="9XXXXXXXXX"
                inputMode="numeric"
                className={`flex-1 ${inputClass}`}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">10 digits starting with 9</p>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Current email
            </label>
            <div className="text-sm text-gray-700 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
              {user.email}
            </div>
            {!emailChangeSent ? (
              <div className="mt-3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Change to a new email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="new@example.com"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button
                    type="button"
                    onClick={handleEmailChange}
                    disabled={saving || !newEmail.trim()}
                    className="px-4 rounded-xl bg-[#7A4BC8] text-white text-sm font-bold disabled:opacity-50"
                  >
                    Send link
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">
                  We'll send a confirmation link to the new address. Your email stays the same until you click it.
                </p>
              </div>
            ) : (
              <div className="mt-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                Check both your <strong>old</strong> and <strong>new</strong> inboxes — you need to confirm from the new one.
              </div>
            )}
          </div>

          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide pt-4">Role</h2>

          {isPrivileged ? (
            <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600">
              Your role is <strong>{originalRole}</strong> and can't be changed here.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map(({ value, label, desc }) => {
                const active = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
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
          )}

          {role === "driver" && !isPrivileged && (
            <div className="space-y-3 pt-2">
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
            disabled={saving}
            className="w-full mt-4 py-3 rounded-xl font-bold text-sm text-white bg-purple-800 hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>
      <BottomNav />
    </div>
  );
}
