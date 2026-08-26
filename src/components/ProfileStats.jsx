import React from 'react';

export default function ProfileStats({ stats }) {
  const items = [
    { label: 'Total Distance', value: `${(stats.totalDistanceKm || 0).toFixed(1)} km`, icon: '🛣️' },
    { label: 'Commute Hours', value: `${(stats.totalHours || 0).toFixed(1)} hrs`, icon: '⏱️' },
    { label: 'POIs Added', value: stats.poisAdded || 0, icon: '📍' },
    { label: 'Routes Mapped', value: stats.routesMapped || 0, icon: '🗺️' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="bg-[#E6D7FF] rounded-[14px] p-3 text-center">
          <span className="text-2xl block mb-1">{item.icon}</span>
          <p className="text-[16px] font-black text-[#381D65] font-poppins">{item.value}</p>
          <p className="text-[10px] text-gray-500 font-poppins">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
