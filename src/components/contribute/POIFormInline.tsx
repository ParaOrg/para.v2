import React, { useState } from 'react';

interface POIFormInlineProps {
  onSubmit: (data: { type: string; name: string; businessType?: string }) => void;
  onCancel: () => void;
}

const POI_TYPES = [
  { id: 'business', label: 'Business', icon: '🏪' },
  { id: 'landmark', label: 'Landmark', icon: '📍' },
  { id: 'amenity', label: 'Amenity', icon: '🏥' },
];

export const POIFormInline: React.FC<POIFormInlineProps> = ({ onSubmit, onCancel }) => {
  const [poiType, setPoiType] = useState('business');
  const [poiName, setPoiName] = useState('');
  const [businessType, setBusinessType] = useState('');

  return (
    <div className="bg-white rounded-[15px] p-3 shadow-sm border border-gray-100 mt-2">
      <p className="text-[12px] font-bold text-[#381D65] font-poppins mb-2">📍 Add Pin Details</p>

      {/* Pin Type */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {POI_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setPoiType(type.id)}
            className={`p-2 rounded-[10px] text-center transition-all ${
              poiType === type.id 
                ? 'bg-[#7A4BC8] text-white' 
                : 'bg-[#E6D7FF] text-[#381D65]'
            }`}
          >
            <span className="text-lg block">{type.icon}</span>
            <span className="text-[9px] font-bold font-poppins">{type.label}</span>
          </button>
        ))}
      </div>

      {/* Name */}
      <input
        type="text"
        value={poiName}
        onChange={(e) => setPoiName(e.target.value)}
        placeholder="Name (e.g., Lugawan ni Aling Nena)"
        className="w-full px-3 py-2 bg-gray-50 rounded-[10px] text-[11px] font-poppins text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8] mb-2"
      />

      {/* Business Type (conditional) */}
      {poiType === 'business' && (
        <input
          type="text"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          placeholder="Business type (e.g., Restaurant, Sari-sari)"
          className="w-full px-3 py-2 bg-gray-50 rounded-[10px] text-[11px] font-poppins text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7A4BC8] mb-2"
        />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onSubmit({ type: poiType, name: poiName, businessType: poiType === 'business' ? businessType : undefined })}
          disabled={!poiName.trim()}
          className="flex-1 py-2 bg-[#7A4BC8] text-white rounded-[10px] text-[11px] font-bold font-poppins disabled:opacity-40"
        >
          ✓ Save Pin
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
