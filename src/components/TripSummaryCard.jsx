export default function TripSummaryCard({ routeData, isRecommended = false, rank = 0 }) {
  if (!routeData) return null;

  const {
    segments = [],
    total_fare = 0,
    total_time_min = 0,
    biyahe_score = 0,
  } = routeData;

  const score = typeof biyahe_score === "object" ? biyahe_score?.biyahe_score : biyahe_score;
  const scorePercent = Math.round((score || 0) * 100);

  const cardBg = isRecommended ? "rgba(122, 75, 200, 0.1)" : "#FFFFFF";
  const pillColor = isRecommended ? "#7A4BC8" : rank === 1 ? "#D1B6FC" : "#E6D7FF";

  const visibleSegments = segments.filter((seg) => seg.distance_m > 0 || !seg.is_transfer);

  /* ---------- Inline SVG icons ---------- */
  function WalkIcon() {
    return <span className="text-[18px]">🚶</span>;
  }

  function TrainIcon() {
    return <span className="text-[18px]">🚆</span>;
  }

  function JeepIcon() {
    return <span className="text-[18px]">🚌</span>;
  }

  function StopwatchIcon() {
    return <span className="text-[16px]">⏱</span>;
  }

  function getSegmentIcon(seg) {
    const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.includes("WALK"));
    if (isWalk) return <WalkIcon />;
    if (seg.type === "train" || seg.type === "lrt" || seg.type === "mrt") return <TrainIcon />;
    return <JeepIcon />;
  }

  /* ---------- Render ---------- */
  return (
    <div
      className="relative rounded-[15px] overflow-hidden"
      style={{ background: cardBg }}
    >
      {/* Byahe Score badge */}
      {scorePercent > 0 && (
        <span
          className="absolute top-3 right-3 text-[12px] font-bold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#F3E8FF", color: "#7A4BC8" }}
        >
          ⚡ {scorePercent}%
        </span>
      )}

      <div className="flex" style={{ gap: "14px" }}>
        {/* Left pill bar */}
        <div
          className="shrink-0 rounded-[10px]"
          style={{
            width: "11px",
            background: pillColor,
            marginLeft: "12px",
            marginTop: "14px",
            marginBottom: "14px",
          }}
        />

        {/* Content */}
        <div className="flex-1 py-3 pr-4 space-y-2">
          {/* Icon row with connector lines */}
          <div className="flex items-center">
            {visibleSegments.map((seg, i) => (
              <div key={i} className="flex items-center">
                {getSegmentIcon(seg)}
                {i < visibleSegments.length - 1 && (
                  <div className="mx-1" style={{ width: "20px", height: "1px", backgroundColor: "#7A4BC8" }} />
                )}
              </div>
            ))}
          </div>

          {/* Title */}
          <p className="text-[14px] font-semibold text-[#381D65] leading-[21px]">
            {visibleSegments.map((seg) => {
              const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.includes("WALK"));
              return isWalk ? "Walk" : seg.route || "Transit";
            }).join(" + ")}{" "}
            <span className="inline-flex items-center gap-1">
              <StopwatchIcon />({total_time_min} min total)
            </span>
          </p>

          {/* Detail lines */}
          <div className="text-[14px] text-[#381D65] leading-[21px] space-y-0.5">
            {visibleSegments.map((seg, i) => {
              const isWalk = seg.is_transfer || seg.type === "walk" || (seg.route && seg.route.includes("WALK"));
              const dist = seg.distance_display || (seg.distance_m >= 1000 ? `${(seg.distance_m / 1000).toFixed(1)} km` : `${seg.distance_m}m`);
              return (
                <p key={i}>
                  {isWalk
                    ? `Walk ${seg.time_min} min${dist ? ` (${dist})` : ""}`
                    : `${seg.route || "Transit"} ${seg.time_min} min`}
                </p>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 text-[14px] text-[#381D65] pt-1">
            <span>💰 ₱{total_fare}</span>
            <span>🌤️ Mostly sheltered</span>
            {/* Report button */}
            <button
              onClick={() => {
                const reason = window.prompt("What's wrong with this route?\n- Wrong directions\n- Route no longer exists\n- Fare changed\n- Other");
                if (reason) {
                  window.alert("Thank you! Your report has been submitted.");
                }
              }}
              className="ml-auto text-[10px] text-red-400 hover:text-red-600 font-medium"
            >
              ⚠️ Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RouteCardList({ routeData, alternatives = [] }) {
  if (!routeData) return null;

  return (
    <div className="flex flex-col" style={{ gap: "20px" }}>
      {/* Recommended label */}
      <p className="text-[14px] font-medium text-[#7A4BC8] leading-[21px]">Recommended</p>
      <TripSummaryCard routeData={routeData} isRecommended />

      {/* Alternatives */}
      {alternatives.map((alt, i) => (
        <TripSummaryCard key={i} routeData={alt} rank={i + 1} />
      ))}
    </div>
  );
}
