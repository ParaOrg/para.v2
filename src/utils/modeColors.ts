export const MODE_COLORS: Record<string, string> = {
  jeepney: "#7A4BC8",    // Para purple
  bus: "#4285F4",        // Google blue
  train: "#EA4335",      // Google red
  lrt: "#34A853",        // Green
  mrt: "#FBBC05",        // Yellow
  uv_express: "#FF6D00", // Orange
  trike: "#00BCD4",      // Cyan
  ferry: "#009688",      // Teal
  walking: "#9E9E9E",    // Gray
  default: "#7A4BC8",    // Para purple
};

export function getModeColor(mode: string): string {
  return MODE_COLORS[mode] || MODE_COLORS.default;
}

export function getModeEmoji(mode: string): string {
  const map: Record<string, string> = {
    jeepney: "🚐",
    bus: "🚌",
    train: "🚆",
    lrt: "🚆",
    mrt: "🚆",
    uv_express: "🚐",
    trike: "🛺",
    ferry: "⛴️",
    walking: "🚶",
  };
  return map[mode] || "🚐";
}

export function getModeLabel(mode: string): string {
  const map: Record<string, string> = {
    jeepney: "Jeepney",
    bus: "Bus",
    train: "Train",
    lrt: "LRT",
    mrt: "MRT",
    uv_express: "UV Express",
    trike: "Tricycle",
    ferry: "Ferry",
    walking: "Walking",
  };
  return map[mode] || mode;
}
