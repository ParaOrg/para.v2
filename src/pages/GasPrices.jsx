import { useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useGasPrices } from "../components/GasPrice/useGasPrices";
import { useGasStations } from "../components/GasPrice/useGasStations";
import GasStationMap from "../components/GasPrice/GasStationMap";
import ReportModal from "../components/GasPrice/ReportModal";
import GasPricePanel from "../components/GasPrice/GasPricePanel";

export default function GasPrices() {
  const { data: blended, loading: priceLoading, lastFetched, secondsAgo } = useGasPrices();
  const { stations, loading: stationsLoading } = useGasStations();
  const [showReport, setShowReport] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row pb-24 lg:pb-0">
        {/* Map */}
        <div className="relative flex-1 min-h-[300px] lg:min-h-0 z-0">
          <GasStationMap stations={stations} onSelectStation={setSelectedStation} />
        </div>

        {/* Panel */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto max-h-[50vh] lg:max-h-none z-10">
          <GasPricePanel
            blended={blended}
            loading={priceLoading}
            lastFetched={lastFetched}
            secondsAgo={secondsAgo}
            selectedStation={selectedStation}
            onReport={() => setShowReport(true)}
          />
        </div>
      </div>

      {showReport && selectedStation && (
        <ReportModal
          station={selectedStation}
          onClose={() => setShowReport(false)}
        />
      )}

      <BottomNav />
    </div>
  );
}
