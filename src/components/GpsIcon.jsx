export default function GpsIcon({ size = 34, color = "#7A4BC8" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circle */}
      <circle
        cx="17"
        cy="17"
        r="10"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Center dot */}
      <circle
        cx="17"
        cy="17"
        r="3"
        fill={color}
        stroke={color}
        strokeWidth="1.5"
      />
      {/* Top line */}
      <line
        x1="17"
        y1="2"
        x2="17"
        y2="7"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Bottom line */}
      <line
        x1="17"
        y1="27"
        x2="17"
        y2="32"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Left line */}
      <line
        x1="2"
        y1="17"
        x2="7"
        y2="17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Right line */}
      <line
        x1="27"
        y1="17"
        x2="32"
        y2="17"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
