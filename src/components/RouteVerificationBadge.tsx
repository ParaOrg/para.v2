import React from 'react';

export function RouteVerificationBadge({ is_approved, verification_status, shape_confidence }) {
  if (is_approved) {
    return (
      <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
        ✅ Verified
      </span>
    );
  }
  
  if (verification_status === 'pending') {
    return (
      <span className="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
        ⏳ Pending Review
      </span>
    );
  }
  
  return (
    <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
      📝 Unverified • {shape_confidence}% confidence
    </span>
  );
}
