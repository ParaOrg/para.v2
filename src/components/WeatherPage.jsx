import { useState, useEffect } from "react";
import { useTrackingConsent } from "../context/TrackingConsentContext";

export default function WeatherPage({ onClose }) {
  const { location } = useTrackingConsent();
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [advisories, setAdvisories] = useState([]);

  const lat = location?.lat || 14.5995;
  const lng = location?.lng || 120.9842;

  useEffect(() => {
    // Current weather
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=Asia/Manila&forecast_days=1`)
      .then(r => r.json())
      .then(d => {
        if (d.current) setWeather(d.current);
        if (d.hourly) {
          // Build 6-hour forecast (Now, 6AM, 8AM, 10AM, 12PM, 2PM)
          const times = d.hourly.time;
          const temps = d.hourly.temperature_2m;
          const codes = d.hourly.weather_code;
          const forecastData = [];
          const nowHour = new Date().getHours();
          for (let i = 0; i < times.length; i++) {
            const hour = new Date(times[i]).getHours();
            if (hour >= nowHour && forecastData.length < 6) {
              forecastData.push({
                hour: hour === 0 ? "12AM" : hour < 12 ? `${hour}AM` : hour === 12 ? "12PM" : `${hour-12}PM`,
                temp: Math.round(temps[i]),
                code: codes[i],
              });
            }
          }
          setForecast(forecastData);
        }
      })
      .catch(() => {});

    // Mock advisories (would come from PAGASA/NOAH API)
    setAdvisories([
      {
        type: "weather",
        severity: "red",
        title: "Heavy Rainfall Warning",
        description: "Moderate to heavy rainfall expected in Metro Manila from 3-6PM today. Flooding likely in Shaw Blvd, Quezon Ave underpass, and C5-Kalayaan interchange.",
        updated: "2 mins ago",
      },
      {
        type: "transport",
        severity: "orange",
        title: "LRT-2 Service Interruption",
        description: "Service interruption between Katipunan and Anonas due to technical issues. Allow extra travel time.",
        updated: "1 hour ago",
      },
      {
        type: "traffic",
        severity: "yellow",
        title: "EDSA Southbound Heavy Traffic",
        description: "Standstill traffic from Cubao to Guadalupe due to vehicle breakdown at Ortigas Ave. Consider MRT-3 or alternative routes.",
        updated: "40 mins ago",
      },
    ]);
  }, [lat, lng]);

  const getWeatherEmoji = (code) => {
    const map = { 0:"☀️", 1:"🌤️", 2:"⛅", 3:"☁️", 45:"🌫️", 48:"🌫️", 51:"🌦️", 53:"🌦️", 55:"🌧️", 61:"🌧️", 63:"🌧️", 65:"🌧️", 71:"🌨️", 73:"🌨️", 75:"🌨️", 80:"🌦️", 81:"🌧️", 82:"🌧️", 95:"⛈️", 96:"⛈️", 99:"⛈️" };
    return map[code] || "🌡️";
  };

  const getWeatherLabel = (code) => {
    const map = { 0:"Clear", 1:"Partly Cloudy", 2:"Partly Cloudy", 3:"Cloudy", 45:"Foggy", 48:"Foggy", 51:"Light Drizzle", 53:"Drizzle", 55:"Heavy Drizzle", 61:"Light Rain", 63:"Rain", 65:"Heavy Rain", 71:"Light Snow", 73:"Snow", 75:"Heavy Snow", 80:"Light Showers", 81:"Showers", 82:"Heavy Showers", 95:"Thunderstorm", 96:"Thunderstorm", 99:"Thunderstorm" };
    return map[code] || "Unknown";
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto relative">
        {/* Header with gradient */}
        <div className="relative bg-gradient-to-br from-[#5E6E7A] via-[#6C93A6] to-[#7A4BC8] p-6 rounded-t-3xl text-white">
          <button onClick={onClose} className="absolute top-4 right-4 bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-white">✕</button>
          
          {/* Expand arrow */}
          <div className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-xs">→</span>
          </div>

          {/* Advisory badge */}
          <div className="text-center mt-4">
            <p className="text-xl font-medium">Advisory</p>
            <p className="text-xs opacity-70">{advisories.length} Active</p>
          </div>

          {/* Manila, Philippines */}
          <p className="text-sm mt-4 opacity-90">Manila, Philippines</p>

          {/* Big temperature */}
          <div className="flex items-center gap-4 mt-2">
            <p className="text-4xl font-medium">{weather?.temperature_2m || 24}°</p>
            <div>
              <p className="text-sm opacity-90">{weather ? getWeatherLabel(weather.weather_code) : "Cloudy-Light Rain"}</p>
              <p className="text-xs opacity-70">
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Decorative rain lines */}
          <div className="absolute inset-x-0 top-0 h-16 overflow-hidden opacity-20">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute w-px bg-white" style={{ left: `${10 + i * 15}%`, top: 0, height: `${40 + i * 10}%`, transform: `rotate(${25 + i * 3}deg)` }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Today + See more */}
          <div className="flex items-center justify-between">
            <p className="text-base">Today</p>
            <p className="text-xs text-[#9767F7]">See more →</p>
          </div>

          {/* Hourly forecast */}
          <div className="flex justify-between mt-4">
            {forecast.map((f, i) => (
              <div key={i} className="text-center">
                <span className="text-2xl">{getWeatherEmoji(f.code)}</span>
                <p className="text-xs mt-1">{f.temp}°</p>
                <p className="text-[10px] text-gray-500">{f.hour}</p>
              </div>
            ))}
          </div>

          {/* Advisories */}
          <div className="mt-6 space-y-4">
            {advisories.map((adv, i) => (
              <div key={i} className="rounded-2xl border p-4"
                style={{
                  background: adv.severity === "red" ? "rgba(255,153,170,0.1)" : adv.severity === "orange" ? "rgba(255,136,39,0.1)" : "rgba(255,204,0,0.1)",
                  borderColor: adv.severity === "red" ? "#F93F74" : adv.severity === "orange" ? "#FF8827" : "#FFCC00",
                }}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {adv.type === "weather" ? "🌧️" : adv.type === "transport" ? "🚆" : "🚗"}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-[#381D65]">{adv.title}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded"
                        style={{ background: adv.severity === "red" ? "#F93F74" : adv.severity === "orange" ? "#FF8827" : "#F1BA0F", color: "white" }}>
                        {adv.type}
                      </span>
                    </div>
                    <p className="text-xs text-[#381D65] mt-1">{adv.description}</p>
                    <p className="text-[10px] text-[#381D65] mt-1">Updated {adv.updated}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
