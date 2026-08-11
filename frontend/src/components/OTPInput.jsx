export default function OTPInput({ value = "", onChange, disabled = false }) {
  return (
    <input
      type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
      value={value} disabled={disabled}
      onChange={(e) => { const clean = e.target.value.replace(/\D/g, "").slice(0, 6); onChange(clean); }}
      className="w-full text-center tracking-[0.6em] text-2xl font-black px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 disabled:opacity-50"
      placeholder="______"
    />
  );
}
