// Weather utility for commute tracking
export async function fetchWeather(lat, lng) {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=weather_code,precipitation,temperature_2m&timezone=Asia/Manila`
    );
    const data = await res.json();
    return {
      code: data.current?.weather_code || 0,
      precipitation: data.current?.precipitation || 0,
      temp: data.current?.temperature_2m || null,
    };
  } catch {
    return { code: 0, precipitation: 0, temp: null };
  }
}

export function getWeatherPenalty(weather) {
  if (!weather || weather.code === 0) return 0;
  if (weather.code >= 95) return 0.30;
  if (weather.code >= 80) return 0.20;
  if (weather.code >= 61) return 0.15;
  return 0;
}

export function isFloodZone(routeName) {
  const floodZones = ['españa', 'taft', 'buendia', 'edsa', 'commonwealth', 'recto', 'quezon ave'];
  return floodZones.some(zone => (routeName || '').toLowerCase().includes(zone));
}
