import { useState } from "react";
import SignupDetailsStep from "./SignupDetailsStep";
import SignupOTPStep from "./SignupOTPStep";

export default function Signup() {
  const [step, setStep] = useState("details");
  const [uid, setUid] = useState(null);
  const [email, setEmail] = useState("");

  const handleRegistered = ({ uid, email }) => {
    setUid(uid);
    setEmail(email);
    setStep("otp");
  };

  if (step === "otp" && uid && email) {
    return (
      <SignupOTPStep
        uid={uid}
        email={email}
        onBack={() => setStep("details")}
      />
    );
  }

  return <SignupDetailsStep onSuccess={handleRegistered} />;
}
