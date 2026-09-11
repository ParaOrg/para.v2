import {
  PW_MIN_LENGTH,
  STRENGTH_COLORS,
  STRENGTH_LABELS,
  getPasswordChecks,
  getPasswordScore,
} from "../utils/passwordValidation";

export function EyeIcon({ open }) {
  return open ? (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Renders a live strength meter + per-rule checklist for a password input.
 * Returns null when password is empty so it doesn't take up space.
 *
 * @param {string} password - The current password value.
 * @param {"light"|"dark"} variant - Styling variant. Default "light".
 */
export default function PasswordStrengthMeter({ password = "", variant = "light" }) {
  if (!password) return null;

  const checks = getPasswordChecks(password);
  const score = getPasswordScore(checks);

  const rules = [
    ["length", `${PW_MIN_LENGTH}+ characters`],
    ["uppercase", "Uppercase letter"],
    ["lowercase", "Lowercase letter"],
    ["number", "Number"],
    ["symbol", "Symbol (!@#$...)"],
  ];

  const mutedColor = variant === "dark" ? "text-gray-400" : "text-gray-500";

  return (
    <div className="mt-3 space-y-2 text-left">
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? STRENGTH_COLORS[score] : "#e5e7eb" }}
          />
        ))}
      </div>
      <p className="text-sm font-bold" style={{ color: STRENGTH_COLORS[score] }}>
        {STRENGTH_LABELS[score]}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map(([key, label]) => (
          <li
            key={key}
            className={`flex items-center gap-1.5 text-sm transition-colors ${
              checks[key] ? "text-green-600 font-semibold" : mutedColor
            }`}
          >
            {checks[key] && <CheckIcon />}
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
