// Static weather data for Metro Manila — no network dependency
export const MANILA_WEATHER = {
  temperature_2m: 28.7,
  relative_humidity_2m: 78,
  apparent_temperature: 31.2,
  precipitation: 0,
  wind_speed_10m: 12.5,
  wind_direction_10m: 220,
  wind_gusts_10m: 18.3,
  visibility: 10000,
  uv_index: 6,
  is_day: 1,
  weather_code: 2,
};

export const WEATHER_HEADLINES = {
  0: "Clear skies. Great day for commuting!",
  1: "Mostly sunny. Light traffic expected.",
  2: "Partly cloudy. Comfortable commute.",
  3: "Overcast. Watch for slippery roads.",
  45: "Foggy. Reduced visibility — drive carefully.",
  61: "Light rain. Jeepney stops may flood.",
  63: "Moderate rain. Flood-prone areas at risk.",
  65: "Heavy rain. Consider alternate routes.",
  80: "Light showers. Bring an umbrella.",
  95: "Thunderstorm. Avoid open areas.",
};

export function getWeatherEmoji(code: number): string {
  const map: Record<number, string> = {
    0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
    45: "🌫️", 48: "🌫️",
    51: "🌦️", 53: "🌦️", 55: "🌧️",
    61: "🌧️", 63: "🌧️", 65: "🌧️",
    80: "🌦️", 81: "🌧️", 82: "🌧️",
    95: "⛈️", 96: "⛈️", 99: "⛈️",
  };
  return map[code] || "🌡️";
}
