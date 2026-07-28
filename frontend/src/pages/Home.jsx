import { useState, useEffect } from "react";
import ChatPanel from "../components/ChatPanel";
import loopGif from "../assets/images/loop.gif";
import paralogo from "../assets/images/Para1P.png";

export default function Home() {
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setBooted(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!booted) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loopGif})` }}>
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Logo */}
          <img 
            src={paralogo} 
            alt="Para PH" 
            className="w-24 h-24 object-contain animate-pulse"
          />
          
          {/* Title */}
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white tracking-tight drop-shadow-lg">
              Para PH
            </h1>
            <p className="text-white/70 text-sm mt-1 font-medium">
              Your Multimodal Transit Companion
            </p>
          </div>
          
          {/* Loading indicator */}
          <div className="flex items-center gap-2 mt-4">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
          </div>
          
          <p className="text-white/50 text-xs mt-2">
            Loading Metro Manila transit data…
          </p>
        </div>
      </div>
    );
  }

  return <ChatPanel embedded={false} />;
}