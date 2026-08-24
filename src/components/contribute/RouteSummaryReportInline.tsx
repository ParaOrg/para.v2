import React from 'react';

interface SegmentSummary {
  type: 'walking' | 'riding';
  vehicle?: string;
  routeName?: string;
  fare?: number;
  durationSec: number;
  distanceM: number;
}

interface RouteSummaryReportInlineProps {
  summary: {
    totalTimeSec: number;
    totalDistanceM: number;
    totalFare: number;
    avgSpeedKmh: number;
    biyaheScore?: number;
    segments: SegmentSummary[];
  };
}

export const RouteSummaryReportInline: React.FC<RouteSummaryReportInlineProps> = ({ summary }) => {
  return (
    <div className="bg-white rounded-[15px] p-4 shadow-sm border border-gray-100">
      <p className="text-[13px] font-bold text-[#381D65] font-poppins mb-3">Trip Summary</p>
      
      {summary.biyaheScore !== undefined && (
        <div className="mb-3 p-3 bg-[#7A4BC8] text-white rounded-[12px] text-center">
          <p className="text-[10px] font-poppins opacity-80">BIYAHE SCORE</p>
          <p className="text-[32px] font-black font-poppins leading-tight">{summary.biyaheScore}</p>
          <p className="text-[10px] font-poppins opacity-80">
            {summary.biyaheScore >= 80 ? '🌟 Excellent route' : summary.biyaheScore >= 60 ? '👍 Good route' : summary.biyaheScore >= 40 ? '⚠️ Fair route' : '🔴 Difficult route'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#E6D7FF] rounded-[10px] p-2">
          <p className="text-[10px] text-gray-500">Distance</p>
          <p className="text-[14px] font-bold text-[#381D65]">{(summary.totalDistanceM / 1000).toFixed(2)} km</p>
        </div>
        <div className="bg-[#E6D7FF] rounded-[10px] p-2">
          <p className="text-[10px] text-gray-500">Time</p>
          <p className="text-[14px] font-bold text-[#381D65]">{Math.round(summary.totalTimeSec / 60)} min</p>
        </div>
        <div className="bg-[#E6D7FF] rounded-[10px] p-2">
          <p className="text-[10px] text-gray-500">Fare</p>
          <p className="text-[14px] font-bold text-[#381D65]">₱{summary.totalFare}</p>
        </div>
        <div className="bg-[#E6D7FF] rounded-[10px] p-2">
          <p className="text-[10px] text-gray-500">Avg Speed</p>
          <p className="text-[14px] font-bold text-[#381D65]">{summary.avgSpeedKmh.toFixed(1)} km/h</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {summary.segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px] font-poppins">
            <span>{seg.type === 'riding' ? '🚐' : '🚶'}</span>
            <span className="flex-1 text-gray-700">{seg.routeName || 'Walking'}</span>
            <span className="text-gray-500">{Math.round(seg.durationSec / 60)} min</span>
            {seg.fare && <span className="text-[#381D65] font-bold">₱{seg.fare}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
