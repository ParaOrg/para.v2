import { useState, useEffect } from "react";

const WEATHER_HEADLINES = {
  0: "Clear skies. Great day for commuting!",
  1: "Mostly sunny. Light traffic expected.",
  2: "Partly cloudy. Comfortable commute.",
  3: "Overcast. Watch for slippery roads.",
  45: "Foggy. Reduced visibility — drive carefully.",
  48: "Dense fog. Consider delaying travel.",
  51: "Light drizzle. Roads may be slippery.",
  53: "Moderate drizzle. Bring an umbrella.",
  55: "Heavy drizzle. Expect slower traffic.",
  61: "Light rain. Jeepney stops may flood.",
  63: "Moderate rain. Flood-prone areas at risk.",
  65: "Heavy rain. Consider alternate routes.",
  71: "Light snow. Unusual for Manila.",
  73: "Moderate snow. Travel not advised.",
  75: "Heavy snow. Stay indoors.",
  80: "Light showers. Bring an umbrella.",
  81: "Moderate showers. Flooding possible.",
  82: "Heavy showers. Severe flooding risk.",
  95: "Thunderstorm. Avoid open areas.",
  96: "Thunderstorm with hail. Seek shelter.",
  99: "Severe thunderstorm. Stay indoors.",
};

export default function WeatherOverlay({ lat = 14.5995, lng = 120.9842 }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,uv_index,is_day` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max` +
      `&timezone=Asia/Manila&forecast_days=3`
    )
      .then(r => r.json())
      .then(d => {
        if (d.current) setWeather(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [lat, lng]);

  if (loading) {
    return (
      <div className="bg-blue-50 rounded-xl p-3 animate-pulse">
        <div className="h-4 w-24 bg-blue-200 rounded mb-2" />
        <div className="h-3 w-32 bg-blue-200 rounded" />
      </div>
    );
  }

  if (!weather?.current) return null;

  const current = weather.current;
  const daily = weather.daily || {};
  const code = current.weather_code;
  const emoji = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    71: "🌨️", 73: "🌨️", 75: "🌨️",
    80: "🌦️", 81: "🌧️", 82: "🌧️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
  }[code] || "🌡️";

  const headline = WEATHER_HEADLINES[code] || "Current conditions for your commute.";
  const isDay = current.is_day === 1;
  const windDirection = current.wind_direction_10m 
    ? ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(current.wind_direction_10m / 22.5) % 16]
    : "N/A";

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 shadow-xl border border-blue-100 w-[300px] relative z-[10000]">
      {/* Headline */}
      <div className="mb-3">
        <p className="text-[13px] font-bold text-[#381D65] font-poppins leading-tight">
          {headline}
        </p>
      </div>

      {/* Main temp + emoji */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl">{emoji}</span>
        <div>
          <p className="text-2xl font-black text-gray-800 tabular-nums">
            {current.temperature_2m}°C
          </p>
          <p className="text-[11px] text-gray-500">
            Feels like {current.apparent_temperature}°C • {isDay ? "Day" : "Night"}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/60 rounded-[10px] p-2">
          <p className="text-[9px] text-gray-400 uppercase">Humidity</p>
          <p className="text-[12px] font-bold text-gray-700">💧 {current.relative_humidity_2m}%</p>
        </div>
        <div className="bg-white/60 rounded-[10px] p-2">
          <p className="text-[9px] text-gray-400 uppercase">Wind</p>
          <p className="text-[12px] font-bold text-gray-700">💨 {current.wind_speed_10m} km/h {windDirection}</p>
        </div>
        <div className="bg-white/60 rounded-[10px] p-2">
          <p className="text-[9px] text-gray-400 uppercase">Gusts</p>
          <p className="text-[12px] font-bold text-gray-700">🌬️ {current.wind_gusts_10m} km/h</p>
        </div>
        <div className="bg-white/60 rounded-[10px] p-2">
          <p className="text-[9px] text-gray-400 uppercase">Visibility</p>
          <p className="text-[12px] font-bold text-gray-700">👁️ {(current.visibility / 1000).toFixed(1)} km</p>
        </div>
        {current.uv_index !== undefined && (
          <div className="bg-white/60 rounded-[10px] p-2">
            <p className="text-[9px] text-gray-400 uppercase">UV Index</p>
            <p className="text-[12px] font-bold text-gray-700">☀️ {current.uv_index}</p>
          </div>
        )}
        {current.precipitation !== undefined && (
          <div className="bg-white/60 rounded-[10px] p-2">
            <p className="text-[9px] text-gray-400 uppercase">Precipitation</p>
            <p className="text-[12px] font-bold text-gray-700">🌧️ {current.precipitation} mm</p>
          </div>
        )}
      </div>

      {/* 3-day forecast */}
      {daily?.temperature_2m_max && daily.temperature_2m_max.length > 0 && (
        <div className="border-t border-blue-100 pt-2">
          <p className="text-[10px] font-bold text-gray-500 mb-2 uppercase">3-Day Forecast</p>
          <div className="grid grid-cols-3 gap-1">
            {[0, 1, 2].map(i => {
              const max = daily.temperature_2m_max?.[i] || "—";
              const min = daily.temperature_2m_min?.[i] || "—";
              const precip = daily.precipitation_probability_max?.[i] || 0;
              const dayName = new Date(Date.now() + i * 86400000).toLocaleDateString('en', { weekday: 'short' });
              return (
                <div key={i} className="bg-white/60 rounded-[8px] p-1.5 text-center">
                  <p className="text-[9px] font-bold text-gray-500">{dayName}</p>
                  <p className="text-[11px] font-black text-gray-700">{Math.round(max)}°</p>
                  <p className="text-[9px] text-gray-400">{Math.round(min)}°</p>
                  <p className="text-[9px] text-blue-500">💧 {precip}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
