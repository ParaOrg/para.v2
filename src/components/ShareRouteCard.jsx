import { useState } from "react";
import { getModeColor, getModeEmoji } from "../utils/modeColors";

export default function ShareRouteCard({ routeData, onClose }) {
  const [title, setTitle] = useState("");
  const [showTitle, setShowTitle] = useState(true);
  const [showTimeDist, setShowTimeDist] = useState(true);
  const [showModes, setShowModes] = useState(true);
  const [showTransfers, setShowTransfers] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [background, setBackground] = useState("transparent");
  
  if (!routeData?.segments) return null;
  
  const totalTime = routeData.total_time_min || 0;
  const totalDist = routeData.total_distance_km || 0;
  const totalFare = routeData.total_fare || 0;
  const transfers = routeData.transfers || 0;
  const score = routeData.biyahe_score || 0;
  const modeSummary = routeData.mode_summary || "";
  
  const handleDownload = () => {
    // Export as PNG
    const card = document.getElementById("share-route-card");
    if (!card) return;
    import("html-to-image").then(({ toPng }) => {
      toPng(card, { backgroundColor: "transparent" })
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = "para-route-summary.png";
          link.href = dataUrl;
          link.click();
        })
        .catch(console.error);
    });
  };
  
  return (
    <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-bold text-sm">Build Your Route Card</h3>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        
        {/* Controls */}
        <div className="px-4 py-3 space-y-2 bg-gray-50">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title (e.g., My Daily Commute)"
            className="w-full px-3 py-2 text-xs border rounded-lg"
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showTitle} onChange={(e) => setShowTitle(e.target.checked)} />
              Title
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showTimeDist} onChange={(e) => setShowTimeDist(e.target.checked)} />
              Time & Distance
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showModes} onChange={(e) => setShowModes(e.target.checked)} />
              Mode Summary
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showTransfers} onChange={(e) => setShowTransfers(e.target.checked)} />
              Transfers
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showDetails} onChange={(e) => setShowDetails(e.target.checked)} />
              Route Details
            </label>
          </div>
        </div>
        
        {/* Preview */}
        <div className="p-4 flex justify-center">
          <div id="share-route-card" className="w-[340px] min-h-[400px] rounded-2xl p-5 border border-gray-200" style={{ background: background === "transparent" ? "transparent" : "#1a1a2e" }}>
            {showTitle && (
              <h3 className="text-lg font-black text-[#381D65] mb-3 text-center">
                {title || "My Para Route"}
              </h3>
            )}
            
            {showTimeDist && (
              <div className="flex justify-center gap-6 mb-3">
                <div className="text-center">
                  <p className="text-2xl font-black text-[#7A4BC8]">{totalTime}</p>
                  <p className="text-[10px] text-gray-500">MINUTES</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black text-[#7A4BC8]">{totalDist.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500">KILOMETERS</p>
                </div>
              </div>
            )}
            
            {showModes && modeSummary && (
              <p className="text-xs text-gray-600 text-center mb-2">{modeSummary}</p>
            )}
            
            {showTransfers && (
              <p className="text-xs text-gray-500 text-center mb-2">{transfers} transfer{transfers !== 1 ? "s" : ""} · ₱{totalFare.toFixed(2)}</p>
            )}
            
            {showDetails && routeData.segments.map((seg, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{getModeEmoji(seg.mode || "jeepney")}</span>
                <span className="text-[10px] text-gray-600 truncate flex-1">{seg.route}</span>
                <span className="text-[10px] text-gray-400">{seg.time_min} min</span>
              </div>
            ))}
            
            <div className="mt-3 flex items-center justify-center gap-1">
              <span className="text-[10px] font-bold text-[#7A4BC8]">⚡ {score} Biyahe Score</span>
            </div>
            
            <p className="text-[8px] text-gray-300 text-center mt-2">@paraph · www.para-commute.org</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="px-4 py-3 border-t flex gap-2">
          <button onClick={handleDownload} className="flex-1 py-2 bg-[#7A4BC8] text-white rounded-xl font-bold text-xs">
            📥 Download PNG
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-xl text-xs">Close</button>
        </div>
      </div>
    </div>
  );
}
