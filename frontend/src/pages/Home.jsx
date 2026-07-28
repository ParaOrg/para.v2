import { Link } from "react-router-dom";
import { Countdown } from "../components/landing_page/components";
import { CONFIG } from "../components/landing_page/data";
import WaitListBubble from "../components/waitList_bubble.jsx";
import LandingPageFooter from "../components/landingpage-footer.component.jsx";
import loopGif from "../assets/images/loop.gif";

export default function Home() {
  const { colors, ticketStyle } = CONFIG;

  return (
    <div className="flex min-h-full flex-col">
      <div
        className="relative min-h-[85vh] w-full shrink-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${loopGif})` }}
      >
        <div className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-4 py-10 sm:py-12">
          <Countdown
            targetDate={CONFIG.targetDate}
            dateLabel={CONFIG.dateLabel}
            backgroundColor={colors.ticketBackground}
            scallopsColor={colors.background}
            ticketStyle={ticketStyle}
          />
          <WaitListBubble />

          {/* Quick-access to routes explorer */}
          <Link
            to="/routes"
            className="mt-6 inline-flex items-center gap-2.5 bg-white/90 backdrop-blur-sm text-pink-600 px-6 py-3 rounded-full font-semibold shadow-lg hover:bg-white hover:shadow-xl transition-all text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            View All Jeepney Routes
            <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
      <LandingPageFooter className="shrink-0" />
    </div>
  );
}
