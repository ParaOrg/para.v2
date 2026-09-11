import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SignupDetailsStep from "./SignupDetailsStep";

export default function Signup() {
  const navigate = useNavigate();

  // Purge legacy Firebase-era cache keys that were used before the
  // Supabase migration. They cause stale user data to appear after a
  // fresh signup if the browser retained them from a prior session.
  useEffect(() => {
    try {
      localStorage.removeItem("para_auth_user_v1");
      localStorage.removeItem("para_user");
    } catch {}
  }, []);

  const handleDetailsSuccess = (data) => {
    if (!data?.email) return;

    const message = data.needsConfirmation
      ? "Account created! Check your email to confirm your address, then log in."
      : "Account created! Please log in.";

    navigate("/login", { state: { message } });
  };

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
