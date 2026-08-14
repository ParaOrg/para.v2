import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MAIN_NAV = [
  { id: "explore", label: "Explore", icon: "🗺️", to: "/explore" },
  { id: "search", label: "Search", icon: "🔍", to: "/", primary: true },
  { id: "community", label: "Community", icon: "🌟", to: "/community" },
  { id: "profile", label: "Profile", icon: "👤", to: "/profile" },
];

export default function BottomNav({ onSearchClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-[0_-4px_7px_rgba(0,0,0,0.05)] px-2 py-3"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
      <div className="flex items-end justify-center gap-7 px-4 py-2">
        {MAIN_NAV.map((item) => (
          <button key={item.id} onClick={() => {
            if (item.primary && onSearchClick) onSearchClick();
            else if (item.to) navigate(item.to);
          }}
            className={`flex flex-col items-center gap-0.5 min-w-[48px] ${item.primary ? "-mt-5" : ""}`}>
            {item.primary ? (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-lg ${
                isActive("/") ? "bg-[#381D65] text-white" : "bg-[#7A4BC8] text-white"
              }`}>
                {item.icon}
              </div>
            ) : (
              <span className="text-lg">{item.icon}</span>
            )}
            <span className={`text-[9px] font-medium ${
              isActive(item.to) ? "text-[#7A4BC8]" : "text-gray-400"
            }`}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
