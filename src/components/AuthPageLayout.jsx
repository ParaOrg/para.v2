import loopGif from "../assets/images/loop.gif";
import paralogo from "../assets/images/Para1P.png";

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
        }}
      />
      {/* Subtle dark overlay for readability — keeps GIF visible */}
      <div className="absolute inset-0 z-10 bg-black/20" />
      
      {/* Content */}
      <div className="relative z-20 w-full flex flex-col items-center justify-center gap-6">
        {/* Logo */}
        <img src={paralogo} alt="Para PH" className="h-12 w-auto object-contain" />
        
        <div className={variant === "split" ? "w-full max-w-lg" : "w-full max-w-md"}>
          <div className="rounded-2xl p-6 md:p-8 shadow-2xl" style={{ background: "rgba(255, 255, 255, 0.85)", backdropFilter: "blur(8px)" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
