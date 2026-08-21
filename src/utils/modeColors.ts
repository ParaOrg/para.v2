export const MODE_COLORS: Record<string, string> = {
  jeepney: "#7A4BC8",
  bus: "#4285F4",
  train: "#EA4335",
  lrt: "#34A853",
  mrt: "#FBBC05",
  uv_express: "#FF6D00",
  trike: "#00BCD4",
  ferry: "#009688",
  walking: "#9E9E9E",
  default: "#7A4BC8",
};

export function getModeColor(mode?: string): string {
  if (!mode) return MODE_COLORS.default;
  // Map aliases
  const normalized = mode === 'rail' ? 'train' : mode;
  return MODE_COLORS[normalized] || MODE_COLORS.default;
}

export function getModeEmoji(mode: string): string {
  const map: Record<string, string> = {
    jeepney: "🚐", bus: "🚌", train: "🚆", lrt: "🚆", mrt: "🚆",
    uv_express: "🚐", trike: "🛺", ferry: "⛴️", walking: "🚶",
  };
  return map[mode] || "🚐";
}
