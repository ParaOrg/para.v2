import loopGif from "../assets/images/loop.gif";

export default function AuthPageLayout({ children, variant = "center" }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Background GIF */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${loopGif})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.15,
        }}
      />
      {/* Overlay for readability */}
      <div className="absolute inset-0 z-10 bg-white/70" />
      
      {/* Content */}
      <div className="relative z-20 w-full flex items-center justify-center">
        <div className={variant === "split" ? "w-full max-w-2xl" : "w-full max-w-xl"}>{children}</div>
      </div>
    </div>
  );
}
