export default function AuthPageLayout({ children, variant = "center" }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10">
      <div className={variant === "split" ? "w-full max-w-2xl" : "w-full max-w-xl"}>{children}</div>
    </div>
  );
}
