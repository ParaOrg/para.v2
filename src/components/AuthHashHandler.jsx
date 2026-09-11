import { useEffect, useState } from "react";

/**
 * Supabase appends auth results to the URL hash:
 *   #access_token=...&type=signup          (success — handled by Supabase client)
 *   #error=access_denied&error_code=...    (failure — needs UI feedback)
 *
 * The success case is handled automatically by the Supabase client
 * (detectSessionInUrl: true). This component catches the FAILURE case
 * and shows a friendly message instead of a broken page.
 */
export default function AuthHashHandler() {
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("error=")) return;

    // Parse the hash into key/value pairs
    const params = new URLSearchParams(hash.substring(1));
    const code = params.get("error_code");
    const desc = params.get("error_description") || "";

    let friendly = "Something went wrong with that link.";
    if (code === "otp_expired") {
      friendly = "That confirmation link has expired. Please sign up again or request a new link.";
    } else if (code === "access_denied") {
      friendly = "That link is no longer valid. It may have already been used.";
    } else if (desc) {
      friendly = decodeURIComponent(desc.replace(/\+/g, " "));
    }

    setErrorMessage(friendly);

    // Clean the hash so a refresh doesn't re-trigger the message
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", cleanUrl);
  }, []);

  if (!errorMessage) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[99999] bg-amber-50 border-b border-amber-300 px-4 py-3 text-sm text-amber-900 text-center shadow-md">
      <span className="font-semibold">⚠️ {errorMessage}</span>
      <button
        onClick={() => setErrorMessage(null)}
        className="ml-3 text-amber-700 hover:text-amber-900 font-bold"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
