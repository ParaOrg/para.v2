import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import SignupDetailsStep from "./SignupDetailsStep";
import SignupOTPStep from "./SignupOTPStep";

export default function Signup() {
  const [step, setStep] = useState("details");
  const [signupData, setSignupData] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleDetailsSuccess = async (data) => {
    setSignupData(data);
    setStep("otp");
  };

  const handleOTPSuccess = async (customToken) => {
    // Backend returns dev token — log in with the email
    if (signupData?.email) {
      await login(signupData.email);
    }
    navigate("/");
  };

  const handleBack = () => {
    setStep("details");
    setSignupData(null);
  };

  if (step === "otp" && signupData) {
    return (
      <SignupOTPStep
        uid={signupData.uid}
        email={signupData.email}
        onBack={handleBack}
        onSuccess={handleOTPSuccess}
      />
    );
  }

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
