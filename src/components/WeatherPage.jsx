import React, { useState, useEffect } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";

function RainCloudIcon({ stroke = "#F93F74" }) {
  return (
    <svg width="37" height="34" viewBox="0 0 30 30" fill="none">
      <path d="M8 16a6 6 0 0 1 11.7-1.9A4.5 4.5 0 0 1 20.5 22H9a4 4 0 0 1-1-6z" fill="#F2EDF6" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M11 24l-1 3M16 24l-1 3M21 24l-1 3" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrainIcon({ stroke = "#FF8827" }) {
  return (
    <svg width="40" height="40" viewBox="0 0 43 43" fill="none">
      <rect x="6" y="9" width="31" height="21" rx="4" stroke={stroke} strokeWidth="1.7" />
      <rect x="11" y="14" width="5" height="5" rx="1" fill={stroke} />
      <rect x="19" y="14" width="5" height="5" rx="1" fill={stroke} />
      <rect x="27" y="14" width="5" height="5" rx="1" fill={stroke} />
      <path d="M9 34h25" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon({ stroke = "#F2BA0F" }) {
  return (
    <svg width="40" height="37" viewBox="0 0 40 37" fill="none">
      <path d="M20 4 37 32H3L20 4z" stroke={stroke} strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M20 14v8" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="20" cy="27" r="1" fill={stroke} />
    </svg>
  );
}

function ForecastIcon({ type }) {
  if (type === "rain") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <path d="M8 17a6 6 0 0 1 11.7-1.9A4.5 4.5 0 0 1 20.5 23H9a4 4 0 0 1-1-6z" fill="#F4F4F3" stroke="#0B122C" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M11 25l-1 2M16 25l-1 2M21 25l-1 2" stroke="#549BF6" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "sun-cloud") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
        <path d="M16 8a5 5 0 0 1 9 3" stroke="#F1BA0F" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8 20a6 6 0 0 1 11.7-1.9A4.5 4.5 0 0 1 20.5 25H9a4 4 0 0 1-1-5z" fill="#F4F4F3" stroke="#0B122C" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
      <path d="M8 19a6 6 0 0 1 11.7-1.9A4.5 4.5 0 0 1 20.5 24H9a4 4 0 0 1-1-5z" fill="#F4F4F3" stroke="#0B122C" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

const DEFAULT_ADVISORIES = [
  { id: "weather", type: "Weather", accent: "#F93F74", bg: "rgba(249, 63, 116, 0.1)", title: "Heavy Rainfall Warning", description: "Moderate to heavy rainfall expected in Metro Manila from 3-6PM today. Flooding likely in Shaw Blvd, Quezon Ave underpass, and C5-Kalayaan interchange.", updated: "Updated 2 mins ago", Icon: RainCloudIcon },
  { id: "transport", type: "Transport", accent: "#FF8827", bg: "rgba(255, 136, 39, 0.1)", title: "LRT-2 Service Interruption", description: "Service interruption between Katipunan and Anonas.", updated: "Updated 1 hour ago", Icon: TrainIcon },
  { id: "traffic", type: "Traffic", accent: "#F1BA0F", bg: "rgba(255, 204, 0, 0.1)", title: "EDSA Southbound Heavy Traffic", description: "Standstill traffic from Cubao to Guadalupe due to vehicle breakdown at Ortigas Ave.", updated: "Updated 40 mins ago", Icon: WarningIcon },
];

export default function WeatherPage({ onClose }) {
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [daily, setDaily] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [advisories, setAdvisories] = useState([]);
  const [cityName, setCityName] = useState("");

  const { location, consent } = useTrackingConsent();
  const lat = location?.lat || window.__userLocation?.[0] || 14.5995;
  const lng = location?.lng || window.__userLocation?.[1] || 120.9842;

  useEffect(() => {
    // Reverse geocode to get city name
    if (lat !== 14.5995 || lng !== 120.9842) {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`)
        .then(r => r.json())
        .then(d => {
          const addr = d.address || {};
          const city = addr.city || addr.town || addr.municipality || addr.county || "Metro Manila";
          setCityName(city);
        })
        .catch(() => {});
    } else {
      setCityName("Metro Manila");
    }
  }, [lat, lng]);

  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&timezone=Asia/Manila&forecast_days=7`)
      .then(r => r.json())
      .then(d => {
        if (d.current) { setWeather(d.current); setLastUpdated(new Date()); }
        if (d.daily && d.daily.time && d.daily.temperature_2m_max) {
          setDaily(d.daily.time.map((day, i) => ({
            day: new Date(day).toLocaleDateString('en-US', { weekday: 'short' }),
            max: Math.round(d.daily.temperature_2m_max[i]),
            min: Math.round(d.daily.temperature_2m_min[i]),
            code: d.daily.weather_code[i],
          })));
        }
        if (d.hourly && d.hourly.time && d.hourly.temperature_2m) {
          const nowHour = new Date().getHours();
          const data = [];
          for (let i = 0; i < d.hourly.time.length && data.length < 6; i++) {
            const h = new Date(d.hourly.time[i]).getHours();
            if (h >= nowHour) {
              data.push({ time: h === 0 ? "12AM" : h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h-12}PM`, temp: `${Math.round(d.hourly.temperature_2m[i])}°`, code: d.hourly.weather_code[i], active: data.length === 0 });
            }
          }
          setForecast(data);
        }
      })
      .catch((e) => { console.error("Weather fetch failed:", e); setError("Unable to load weather"); });
    
    // Use default advisories (backend fetch removed for stability)
    setAdvisories(DEFAULT_ADVISORIES);
  }, [lat, lng, consent, location]);

  const getIconType = (code) => {
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if (code === 1 || code === 2) return "sun-cloud";
    return "cloud";
  };

  const getWeatherLabel = (code) => {
    const map = { 0:"Clear", 1:"Partly Cloudy", 2:"Partly Cloudy", 3:"Cloudy", 45:"Foggy", 48:"Foggy", 51:"Light Drizzle", 61:"Light Rain", 63:"Rain", 65:"Heavy Rain", 80:"Light Showers", 95:"Thunderstorm" };
    return map[code] || "Cloudy";
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="mx-auto w-full max-w-[443px] max-h-[85vh] overflow-y-auto relative rounded-3xl shadow-2xl" onClick={(e) => e.stopPropagation()} style={{ fontFamily: "'Poppins', sans-serif" }}>

        {/* HERO — purple gradient + weather effects */}
        <div className="relative w-full overflow-hidden rounded-t-3xl" style={{ height: "251px", background: "linear-gradient(180deg, #3A1E86 0%, #5B339C 50%, #7A4BC8 100%)" }}>
            {cityName && <p className="absolute top-3 left-1/2 -translate-x-1/2 text-white/80 text-sm font-semibold">{cityName}</p>}
          
          {/* Weather effects based on code */}
          {(() => {
            const code = (weather && weather.weather_code) ? weather.weather_code : 3;
            return (
              <>
                {/* Sun */}
                {(code === 0 || code === 1 || code === 2) && (
                  <div className="absolute" style={{ right: "30px", top: "30px" }}>
                    <svg width="70" height="70" viewBox="0 0 72 72" fill="none">
                      <circle cx="36" cy="36" r="14" fill="#F1BA0F" />
                      {Array.from({ length: 8 }, (_, i) => (
                        <rect key={i} x="33" y="4" width="6" height="10" rx="3" fill="#F1BA0F" transform={`rotate(${i * 45} 36 36)`} />
                      ))}
                    </svg>
                  </div>
                )}
                
                {/* Clouds — puffy cumulus shapes */}
                {(code >= 1) && (
                  <>
                    <svg className="absolute" width="130" height="50" viewBox="0 0 120 44" style={{ left: "15px", top: "35px", opacity: 0.25 }}>
                      <path d="M20 40 Q20 25 40 25 Q45 10 65 15 Q85 5 95 20 Q110 20 110 35 Q110 43 95 43 L25 43 Q10 43 20 40 Z" fill="#FCFCF5" />
                    </svg>
                    <svg className="absolute" width="110" height="44" viewBox="0 0 120 44" style={{ right: "10px", top: "60px", opacity: 0.15 }}>
                      <path d="M20 40 Q20 25 40 25 Q45 10 65 15 Q85 5 95 20 Q110 20 110 35 Q110 43 95 43 L25 43 Q10 43 20 40 Z" fill="#FCFCF5" />
                    </svg>
                  </>
                )}
                
                {/* Rain drops */}
                {(code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95) ? (
                  <div className="absolute inset-0 overflow-hidden">
                    {[...Array(40)].map((_, i) => {
                      const x = (i * 11.1) % 443;
                      const delay = (i * 0.15) % 2;
                      const len = 10 + (i % 14);
                      const op = 0.3 + ((i * 9) % 35) / 100;
                      return (
                        <div key={i} className="absolute w-[2px] bg-white rounded-full" style={{ left: x, top: -20, height: len, opacity: op, animation: `weather-rain ${0.7 + (i % 5) * 0.12}s linear ${delay}s infinite` }} />
                      );
                    })}
                  </div>
                ) : null}
                
                {/* Lightning */}
                {(code >= 95) && (
                  <div className="absolute" style={{ right: "55px", top: "25px", animation: "weather-lightning 4s ease-in-out infinite" }}>
                    <svg width="30" height="50" viewBox="0 0 30 50" fill="none">
                      <path d="M18 0 L5 28 L14 28 L10 50 L25 20 L16 20 Z" fill="#F1BA0F" />
                    </svg>
                  </div>
                )}
                
                <style>{`
                  @keyframes weather-rain { from { transform: translateY(-20px); } to { transform: translateY(240px); } }
                  @keyframes weather-lightning { 0%, 88%, 100% { opacity: 0; } 90%, 92%, 94%, 96% { opacity: 1; } }
                `}</style>
              </>
            );
          })()}

          {/* Close */}
          <button onClick={onClose} className="absolute right-4 top-4 w-9 h-9 rounded-full bg-black/20 flex items-center justify-center text-white z-20">✕</button>

          {/* Text */}
          {error && <div className="absolute left-10 top-4 z-20 text-white/70 text-xs">{error}</div>}
          {error && <div className="absolute left-10 top-4 z-20 text-white/70 text-xs">{error}</div>}
          <div className="absolute left-10 top-12 z-10">
            <span className="text-[#FCFCF5] font-medium text-[20px] leading-[30px]">Advisory</span>
          </div>
          <div className="absolute left-10 top-[126px] z-10">
            <div className="text-white font-medium text-[32px] leading-[48px]">{weather?.temperature_2m || 24}°</div>
            <div className="text-white text-[16px] leading-[24px]">Manila, Philippines</div>
            <div className="text-white/80 text-[13px] leading-[18px]">{weather ? getWeatherLabel(weather.weather_code) : "Cloudy-Light Rain"}</div>
            <div className="text-white/70 text-[13px] leading-[18px]">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
        </div>

        {/* BODY */}
        <div className="bg-[#EFEFEF]">
          <div className="px-[33px] pt-[13px]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[16px] leading-[24px] text-[#0B122C]">Today</div>
              <button onClick={() => setExpanded(!expanded)} className="text-[12px] leading-[18px] text-[#9767F7] text-right">{expanded ? "See less" : "See more →"}</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {forecast.map((slot, i) => (
                <div key={i} className="flex flex-col items-center shrink-0 w-[47px]" style={slot.active ? { background: "#F2EDFA", borderRadius: "10px", paddingTop: "8px", paddingBottom: "8px" } : { paddingTop: "8px", paddingBottom: "8px" }}>
                  <span className="text-[10px] leading-[15px] text-[#7B7B7B] text-center">{slot.temp}</span>
                  <div className="my-1 w-[30px] h-[30px] flex items-center justify-center"><ForecastIcon type={getIconType(slot.code)} /></div>
                  <span className="text-[12px] leading-[18px] text-[#333333] text-center">{slot.time}</span>
                </div>
              ))}
            </div>
          </div>

          {expanded && daily.length > 0 && (
            <div className="px-[33px] pt-4">
              <div className="text-[16px] leading-[24px] text-[#0B122C] mb-3">7-Day Forecast</div>
              <div className="space-y-2">
                {daily.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-2">
                    <span className="w-10 text-sm font-medium text-gray-700">{d.day}</span>
                    <ForecastIcon type={getIconType(d.code)} />
                    <span className="flex-1 text-sm text-gray-600">{getWeatherLabel(d.code)}</span>
                    <span className="font-bold text-gray-800">{d.max}°</span>
                    <span className="text-gray-400">/{d.min}°</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-[30px] pt-[33px] pb-8">
            <div className="text-[16px] leading-[24px] text-[#0B122C] mb-4">Active Advisories ({advisories.length || DEFAULT_ADVISORIES.length})</div>
            <div className="flex flex-col gap-4">
              {(advisories.length > 0 ? advisories : DEFAULT_ADVISORIES).map((item) => (
                <div key={item.id} className="relative rounded-[15px] p-4" style={{ background: item.bg, border: `1px solid ${item.accent}` }}>
                  <div className="flex gap-3">
                    <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-white"><item.Icon stroke={item.accent} /></div>
                    <div className="flex-1 min-w-0 pr-14">
                      <h4 className="text-[14px] font-medium leading-[21px] text-[#381D65]">{item.title}</h4>
                      <p className="text-[12px] leading-[18px] text-[#381D65] mt-1">{item.description}</p>
                      <p className="text-[10px] leading-[15px] text-[#381D65] mt-2">{item.updated}</p>
                    </div>
                  </div>
                  <span className="absolute top-3 right-3 text-[10px] leading-[15px] text-[#F4F4F3] rounded-[5px] px-2 py-[1px] text-center" style={{ background: item.accent }}>{item.type}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center text-[10px] text-gray-400 border-t pt-3">
              Weather data by <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="text-[#7A4BC8] hover:underline">Open-Meteo</a> · Updated {lastUpdated ? lastUpdated.toLocaleTimeString() : "now"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
