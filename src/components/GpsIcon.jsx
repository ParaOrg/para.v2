export default function GpsIcon({ size = 24, color = "#7A4BC8", filled = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <circle cx="17" cy="17" r="12" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="17" cy="17" r="3" fill={filled ? color : "none"} stroke={color} strokeWidth="1.5" />
      <line x1="17" y1="2" x2="17" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="17" y1="26" x2="17" y2="32" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="2" y1="17" x2="8" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="26" y1="17" x2="32" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
