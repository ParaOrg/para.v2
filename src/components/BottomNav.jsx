import { useNavigate, useLocation } from "react-router-dom";

const LEFT_NAV = [
  { id: "explore", label: "Explore", icon: "🗺️", to: "/explore" },
  { id: "contribute", label: "Contribute", icon: "🛰️", to: "/contribute" },
];

const RIGHT_NAV = [
  { id: "community", label: "Community", icon: "🌟", to: "/community" },
  { id: "profile", label: "Profile", icon: "👤", to: "/profile" },
];

export default function BottomNav({ onSearchClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  // user not needed in BottomNav

  const isActive = (path) => location.pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md rounded-t-[20px] shadow-[4px_4px_7px_8px_rgba(0,0,0,0.06)] px-2 py-2"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-end justify-between px-3">
        <div className="flex gap-6">
          {LEFT_NAV.map((item) => (
            <button key={item.id} onClick={() => navigate(item.to)} className="flex flex-col items-center gap-0.5 min-w-[48px]">
              <span className="text-lg">{item.icon}</span>
              <span className={`text-[9px] font-medium ${isActive(item.to) ? "text-[#7A4BC8]" : "text-gray-400"}`}>{item.label}</span>
            </button>
          ))}
        </div>
        <button onClick={() => onSearchClick ? onSearchClick() : navigate("/")} className="-mt-4 flex flex-col items-center">
          <div className="w-14 h-8 rounded-full bg-[#7A4BC8] text-white flex items-center justify-center shadow-lg text-lg px-3">🔍</div>
          <span className="text-[9px] font-medium text-[#7A4BC8]">Search</span>
        </button>
        <div className="flex gap-6">
          {RIGHT_NAV.map((item) => (
            <button key={item.id} onClick={() => navigate(item.to)} className="flex flex-col items-center gap-0.5 min-w-[48px]">
              <span className="text-lg">{item.icon}</span>
              <span className={`text-[9px] font-medium ${isActive(item.to) ? "text-[#7A4BC8]" : "text-gray-400"}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
