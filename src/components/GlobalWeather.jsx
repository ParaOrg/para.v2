import { useState, useEffect } from "react";
import WeatherPage from "./WeatherPage";

export default function GlobalWeather() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const showWeather = () => setShow(true);
    window.addEventListener("para-show-weather", showWeather);
    return () => window.removeEventListener("para-show-weather", showWeather);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[99999]">
      <WeatherPage onClose={() => setShow(false)} />
    </div>
  );
}
