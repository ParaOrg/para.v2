import { useState } from 'react';
import SignupDetailsStep from './SignupDetailsStep';
import SignupOTPStep from './SignupOTPStep';

// Signup orchestrator
export default function Signup() {
  const [step, setStep]   = useState('details');
  const [uid, setUid]     = useState('');
  const [email, setEmail] = useState('');

  const handleDetailsSuccess = ({ uid: newUid, email: newEmail }) => {
    setUid(newUid);
    setEmail(newEmail);
    setStep('otp');
  };

  if (step === 'otp') {
    return (
      <SignupOTPStep
        uid={uid}
        email={email}
        onBack={() => setStep('details')}
      />
    );
  }

  return <SignupDetailsStep onSuccess={handleDetailsSuccess} />;
}
