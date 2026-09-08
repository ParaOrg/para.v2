import { useNavigate } from "react-router-dom";
import SignupDetailsStep from "./SignupDetailsStep";

export default function Signup() {
  const navigate = useNavigate();

  const handleDetailsSuccess = (data) => {
    if (data?.email) {
      // Firebase user is already logged in after signup
      navigate("/");
    }
  };

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
