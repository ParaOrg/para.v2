import React from 'react';

interface TimelineSegment {
  type: 'walking' | 'riding';
  vehicle?: string;
  routeName?: string;
  durationSec: number;
  startTime: number;
}

interface SegmentTimelineInlineProps {
  segments: TimelineSegment[];
}

export const SegmentTimelineInline: React.FC<SegmentTimelineInlineProps> = ({ segments }) => {
  const totalDuration = segments.reduce((sum, seg) => sum + seg.durationSec, 0);
  
  return (
    <div className="bg-white rounded-[15px] p-4 shadow-sm border border-gray-100">
      <p className="text-[13px] font-bold text-[#381D65] font-poppins mb-3">Segment Timeline</p>
      
      <div className="flex gap-1 h-6 mb-2">
        {segments.map((seg, i) => {
          const widthPct = (seg.durationSec / totalDuration) * 100;
          return (
            <div
              key={i}
              className={`${seg.type === 'riding' ? 'bg-[#7A4BC8]' : 'bg-gray-300'} rounded-full`}
              style={{ width: `${widthPct}%` }}
              title={`${seg.routeName || 'Walking'}: ${Math.round(seg.durationSec / 60)} min`}
            />
          );
        })}
      </div>
      
      <div className="space-y-1">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] font-poppins">
            <span className={`w-2 h-2 rounded-full ${seg.type === 'riding' ? 'bg-[#7A4BC8]' : 'bg-gray-300'}`} />
            <span className="text-gray-700">{seg.routeName || 'Walking'}</span>
            <span className="ml-auto text-gray-500">
              {new Date(seg.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
