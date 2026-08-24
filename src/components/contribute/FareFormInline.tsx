import React, { useState } from 'react';

interface FareFormInlineProps {
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}

const QUICK_AMOUNTS = [10, 12, 13, 15, 20, 25, 30, 50];

export const FareFormInline: React.FC<FareFormInlineProps> = ({ onSubmit, onCancel }) => {
  const [amount, setAmount] = useState('');

  return (
    <div className="bg-white rounded-[15px] p-3 shadow-sm border border-gray-100 mt-2">
      <p className="text-[12px] font-bold text-[#381D65] font-poppins mb-2">💰 Report Fare</p>

      {/* Quick amounts */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_AMOUNTS.map((amt) => (
          <button
            key={amt}
            onClick={() => setAmount(amt.toString())}
            className={`px-2.5 py-1 rounded-[8px] text-[10px] font-bold font-poppins transition-all ${
              amount === amt.toString() 
                ? 'bg-[#7A4BC8] text-white' 
                : 'bg-[#E6D7FF] text-[#381D65]'
            }`}
          >
            ₱{amt}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Or type amount (₱)"
        className="w-full px-3 py-2 bg-gray-50 rounded-[10px] text-[11px] font-poppins text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8] mb-2"
      />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit(parseFloat(amount))}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex-1 py-2 bg-[#7A4BC8] text-white rounded-[10px] text-[11px] font-bold font-poppins disabled:opacity-40"
        >
          ✓ Save Fare
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 bg-gray-100 text-gray-600 rounded-[10px] text-[11px] font-poppins"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
