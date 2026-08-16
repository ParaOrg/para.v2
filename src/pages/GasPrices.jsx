import { useState } from "react";
import Navbar from "../components/Navbar";
import BottomNav from "../components/BottomNav";
import { useGasStations } from "../components/GasPrice/useGasStations";
import GasStationMap from "../components/GasPrice/GasStationMap";
import ReportModal from "../components/GasPrice/ReportModal";

export default function GasPrices() {
  const { stations, loading } = useGasStations();
  const [showReport, setShowReport] = useState(false);
  const [selectedStation, setSelectedStation] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col lg:flex-row pb-24 lg:pb-0">
        {/* Map */}
        <div className="relative flex-1 min-h-[300px] lg:min-h-0 z-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <GasStationMap stations={stations} onSelectStation={setSelectedStation} />
          )}
        </div>

        {/* Panel */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-100 overflow-y-auto max-h-[50vh] lg:max-h-none z-10">
          <div className="p-4">
            <h1 className="text-lg font-black text-[#381D65]">⛽ Gas Prices</h1>
            <p className="text-xs text-gray-500">Select a station to view and report prices.</p>

            {selectedStation ? (
              <div className="mt-3 bg-purple-50 rounded-xl p-3">
                <h3 className="text-sm font-bold text-gray-900">{selectedStation.name}</h3>
                <p className="text-xs text-gray-500">{selectedStation.brand}</p>
                <p className="text-xs text-gray-400">{selectedStation.address}</p>
                <button onClick={() => setShowReport(true)}
                  className="w-full mt-2 py-2 bg-[#7A4BC8] text-white rounded-lg text-sm font-bold">
                  Report Price
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400 text-center">Tap a station on the map to get started.</p>
            )}
          </div>
        </div>
      </div>

      {showReport && selectedStation && (
        <ReportModal station={selectedStation} onClose={() => setShowReport(false)} />
      )}

      <BottomNav />
    </div>
  );
}
