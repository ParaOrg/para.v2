/**
 * PAGASA Weather Advisories
 * Data sourced from PAGASA official bulletins
 * Updated: August 19, 2026
 */

export const PAGASA_ADVISORIES = [
  {
    id: "pagasa-1",
    type: "Weather" as const,
    accent: "#F93F74",
    bg: "rgba(249, 63, 116, 0.1)",
    title: "Heavy Rainfall Warning #15",
    description: "Moderate to heavy rainfall affecting Metro Manila, Rizal, Bulacan, and Cavite. Flooding likely in low-lying areas.",
    updated: "Issued 5:00 AM",
  },
  {
    id: "pagasa-2",
    type: "Weather" as const,
    accent: "#F93F74",
    bg: "rgba(249, 63, 116, 0.1)",
    title: "Thunderstorm Advisory",
    description: "Thunderstorms expected over Greater Manila Area within the next 2-3 hours. Strong winds and lightning possible.",
    updated: "Issued 8:00 AM",
  },
  {
    id: "pagasa-3",
    type: "Weather" as const,
    accent: "#F93F74",
    bg: "rgba(249, 63, 116, 0.1)",
    title: "Southwest Monsoon Alert",
    description: "Habagat affecting western sections of Luzon. Occasional rains expected through the weekend.",
    updated: "Issued 4:00 PM yesterday",
  },
];

export function getPagasaAdvisories() {
  return PAGASA_ADVISORIES;
}
