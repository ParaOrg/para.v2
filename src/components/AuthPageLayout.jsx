import { useEffect, useRef } from "react";
import paralogo from "../assets/images/Para1P.png";
import loopVideo from "../assets/images/loop.webm";
import loopFallback from "../assets/images/loop-fallback.jpg";
import Navbar from "./Navbar";
import BottomNav from "./BottomNav";

export default function AuthPageLayout({ children, variant = "center" }) {
  const videoRef = useRef(null);

  // Some mobile browsers ignore the autoplay attribute and need
  // an explicit .play() call after the element is mounted.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {
      /* Autoplay may be blocked; the poster image stays visible. */
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative">
      <Navbar />

      <div className="flex-1 flex items-center justify-center px-4 py-10 relative overflow-hidden">
        {/* Animated background: WebM video (~264KB) with JPEG poster (~26KB)
            Replaces the previous 11MB GIF on all auth pages. */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={loopFallback}
          aria-hidden="true"
          className="absolute inset-0 z-0 w-full h-full object-cover"
        >
          <source src={loopVideo} type="video/webm" />
        </video>

        {/* Subtle overlay for text readability */}
        <div className="absolute inset-0 z-10 bg-black/20" />

        <div className="relative z-20 w-full flex flex-col items-center justify-center gap-6">
          <img src={paralogo} alt="Para PH" className="h-12 w-auto object-contain" />

          <div className={variant === "split" ? "w-full max-w-lg" : "w-full max-w-md"}>
            <div
              className="rounded-2xl p-6 md:p-8 shadow-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.85)",
                backdropFilter: "blur(8px)",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
