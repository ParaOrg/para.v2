import { useState, useEffect } from "react";

export default function WeatherOverlay({ lat = 14.5995, lng = 120.9842 }) {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=Asia/Manila`)
      .then(r => r.json())
      .then(d => {
        if (d.current) setWeather(d.current);
      })
      .catch(() => {});
  }, [lat, lng]);

  if (!weather) return null;

  const weatherEmoji = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "🌨️",
    80: "🌦️", 81: "🌧️", 82: "🌧️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
  }[weather.weather_code] || "🌡️";

  return (
    <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
      <span className="text-2xl">{weatherEmoji}</span>
      <div>
        <p className="text-sm font-bold text-gray-800">{weather.temperature_2m}°C</p>
        <p className="text-xs text-gray-500">
          💧 {weather.relative_humidity_2m}% • 💨 {weather.wind_speed_10m} km/h
        </p>
      </div>
    </div>
  );
}
