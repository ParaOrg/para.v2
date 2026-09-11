// Shared password strength rules used by SignupDetailsStep and ChangePassword.
// This file is the single source of truth for client-side password rules.
// Server-side enforcement lives in Supabase Auth Policies.

export const PW_MIN_LENGTH = 8;

// Matches common keyboard-accessible symbols
export const SYMBOL_REGEX = /[!@#$%^&*(),.?":{}|<>_\-+=;'[\]\\\/~`]/;

export function getPasswordChecks(pw = "") {
  return {
    length: pw.length >= PW_MIN_LENGTH,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: SYMBOL_REGEX.test(pw),
  };
}

export function getPasswordScore(checks) {
  return Math.min(Object.values(checks).filter(Boolean).length, 4);
}

export const STRENGTH_COLORS = ["#dc2626", "#f59e0b", "#eab308", "#22c55e", "#16a34a"];
export const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Strong", "Very strong"];

export function validatePassword(pw) {
  const checks = getPasswordChecks(pw);
  const missing = [];
  if (!checks.length) missing.push(`${PW_MIN_LENGTH}+ characters`);
  if (!checks.uppercase) missing.push("an uppercase letter");
  if (!checks.lowercase) missing.push("a lowercase letter");
  if (!checks.number) missing.push("a number");
  if (!checks.symbol) missing.push("a symbol (!@#$...)");
  return { checks, missing };
}
