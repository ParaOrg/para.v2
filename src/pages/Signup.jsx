import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SignupDetailsStep from "./SignupDetailsStep";

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDetailsSuccess = async (data) => {
    // Bypass OTP - directly log in with the email
    if (data?.email) {
      await login(data.email);
    }
    navigate("/");
  };

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
