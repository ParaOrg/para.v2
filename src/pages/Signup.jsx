import { useNavigate } from "react-router-dom";
import SignupDetailsStep from "./SignupDetailsStep";

export default function Signup() {
  const navigate = useNavigate();

  const handleDetailsSuccess = (data) => {
    if (data?.email) {
      navigate("/login", { state: { message: "Account created! Please log in." } });
    }
  };

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
