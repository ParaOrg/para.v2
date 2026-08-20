import React from 'react';

export function RouteTag({ tag }: { tag: 'verified' | 'unverified' | 'no_shape' }) {
  if (tag === 'verified') {
    return (
      <span className="text-[8px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0 font-bold">
        ✅ VERIFIED
      </span>
    );
  }
  if (tag === 'unverified') {
    return (
      <span className="text-[8px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full shrink-0 font-bold">
        📝 UNVERIFIED
      </span>
    );
  }
  return (
    <span className="text-[8px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0 font-bold">
      ⏳ NO SHAPE
    </span>
  );
}
