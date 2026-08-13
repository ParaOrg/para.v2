export default function TripSummaryCard({ routeData, isRecommended = false, rank = 0 }) {
  if (!routeData) return null;
  const { segments = [], total_fare = 0, total_time_min = 0, biyahe_score = 0 } = routeData;
  const score = typeof biyahe_score === "object" ? biyahe_score?.biyahe_score : biyahe_score;
  const scorePercent = score != null ? Math.round(score * 100) : null;
  const cardBg = isRecommended ? "bg-[#7A4BC81A]" : "bg-white";
  const cardShadow = isRecommended ? "" : "shadow-[0px_4px_6px_rgba(0,0,0,0.05)]";
  const pillGradient = isRecommended ? "linear-gradient(to right, #4B2885 50%, #7A4BC8 50%)" : "#7A4BC8";
  const visibleSegments = segments.filter((seg) => seg.distance_m > 0 || !seg.is_transfer);

  const handleReport = () => {
    const reason = window.prompt("What's wrong with this route?\n- Wrong directions\n- Route no longer exists\n- Fare changed\n- Other");
    if (reason) {
      window.alert("Thank you! Your report has been submitted. We'll review this route.");
    }
  };

  return (
    <div className={`${cardBg} ${cardShadow} rounded-2xl overflow-hidden border border-gray-100`}>
      <div className="flex" style={{ gap: "12px" }}>
        <div className="shrink-0 rounded-l-2xl" style={{ width: "6px", background: pillGradient, minHeight: "100%" }} />
        <div className="flex-1 py-3 pr-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[#381D65] text-xs font-bold">{isRecommended ? "Recommended" : `Alternative ${rank}`}</p>
            {scorePercent != null && <span className="shrink-0 text-[11px] font-bold" style={{ backgroundColor: "#F3E8FF", color: "#7A4BC8", padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem" }}>⚡ {scorePercent}%</span>}
          </div>
          <div className="flex items-center gap-1">
            {visibleSegments.map((seg, i) => {
              const isWalk = seg.is_transfer || seg.type === "walk";
              const emoji = isWalk ? "🚶" : seg.type === "train" || seg.type === "lrt" || seg.type === "mrt" ? "🚆" : "🚌";
              return (<div key={i} className="flex items-center"><span className="text-sm">{emoji}</span>{i < visibleSegments.length - 1 && <div className="w-3 h-[1px] bg-[#D1B6FC] mx-0.5" />}</div>);
            })}
          </div>
          <p className="text-[#381D65] text-sm font-bold">{segments.map((seg) => { const isWalk = seg.is_transfer || seg.type === "walk"; return isWalk ? "Walk" : seg.route || "Transit"; }).join(" + ")} ({total_time_min} min total)</p>
          <div className="text-[#381D65] text-[11px] leading-relaxed space-y-0.5">
            {visibleSegments.map((seg, i) => {
              const isWalk = seg.is_transfer || seg.type === "walk";
              const dist = seg.distance_display || (seg.distance_m >= 1000 ? `${(seg.distance_m / 1000).toFixed(1)} km` : `${seg.distance_m}m`);
              return <p key={i}>{isWalk ? `Walk ${seg.time_min} min (${dist})` : `${seg.route || "Transit"} ${seg.time_min} min`}</p>;
            })}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#381D65] pt-1 border-t border-gray-100">
            <span>💰 ₱{total_fare ?? 0}</span><span>⏱ {total_time_min} min</span><span>🌤️ Mostly sheltered</span>
            <button onClick={handleReport} className="ml-auto text-[10px] text-red-400 hover:text-red-600 font-medium" title="Report an issue with this route">⚠️ Report</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteCardList({ routeData, alternatives = [] }) {
  if (!routeData) return null;
  return (
    <div className="flex flex-col" style={{ gap: "12px" }}>
      <TripSummaryCard routeData={routeData} isRecommended />
      {alternatives.map((alt, i) => <TripSummaryCard key={i} routeData={alt} rank={i + 1} />)}
    </div>
  );
}
