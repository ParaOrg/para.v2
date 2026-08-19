/**
 * OpenWeather Alerts API integration
 * Free tier: 1,000 calls/day — enough for demo
 */

const OPENWEATHER_API_KEY = ""; // User enters their key

export interface WeatherAlert {
  id: string;
  type: "Weather" | "Transport" | "Traffic";
  accent: string;
  bg: string;
  title: string;
  description: string;
  updated: string;
  rawAlert?: any;
}

export async function fetchOpenWeatherAlerts(
  lat: number,
  lng: number
): Promise<WeatherAlert[]> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error("OpenWeather API key not configured");
  }

  // OpenWeather One Call API 3.0 includes alerts
  const res = await fetch(
    `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&exclude=minutely,hourly,daily&appid=${OPENWEATHER_API_KEY}`
  );

  if (!res.ok) {
    throw new Error(`OpenWeather API error: ${res.status}`);
  }

  const data = await res.json();

  if (!data.alerts || data.alerts.length === 0) {
    return [];
  }

  return data.alerts.map((alert: any, index: number) => {
    // Map alert type to our design
    let type: "Weather" | "Transport" | "Traffic" = "Weather";
    let accent = "#F93F74";
    let bg = "rgba(249, 63, 116, 0.1)";

    const eventLower = (alert.event || "").toLowerCase();
    const descLower = (alert.description || "").toLowerCase();

    if (/(traffic|road|closure|accident)/.test(eventLower + descLower)) {
      type = "Traffic";
      accent = "#F1BA0F";
      bg = "rgba(255, 204, 0, 0.1)";
    } else if (/(transport|train|rail|bus|transit|service)/.test(eventLower + descLower)) {
      type = "Transport";
      accent = "#FF8827";
      bg = "rgba(255, 136, 39, 0.1)";
    }

    const issuedTime = new Date(alert.start * 1000);
    const now = new Date();
    const diffMin = Math.round((now.getTime() - issuedTime.getTime()) / 60000);
    const updatedStr = diffMin < 1 ? "Updated just now" : `Updated ${diffMin} min ago`;

    return {
      id: `ow-alert-${index}`,
      type,
      accent,
      bg,
      title: alert.event || "Weather Advisory",
      description: alert.description?.substring(0, 200) || alert.sender_name || "",
      updated: updatedStr,
      rawAlert: alert,
    };
  });
}
