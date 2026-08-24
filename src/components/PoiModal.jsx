import { createPortal } from "react-dom";

export default function PoiModal({ onClose, onSave, poiType, setPoiType, poiName, setPoiName, POI_TYPES }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center">
      <div className="bg-white rounded-t-2xl shadow-2xl p-4 space-y-3 w-full" style={{ maxHeight: "50vh", overflowY: "auto", marginBottom: "84px" }}>
        <div className="flex justify-between items-center">
          <p className="text-sm font-bold text-gray-900">📍 Tap map to drop pin</p>
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {POI_TYPES.map(p => (
            <button key={p.id} onClick={() => setPoiType(p.id)}
              className={`p-2 rounded-lg text-center ${poiType === p.id ? "bg-green-100 border-2 border-green-300" : "bg-gray-50 border-2 border-transparent"}`}>
              <span className="text-lg">{p.icon}</span>
              <span className={`block text-[9px] font-bold ${poiType === p.id ? "text-green-800" : "text-gray-500"}`}>{p.label}</span>
            </button>
          ))}
        </div>
        <input value={poiName} onChange={(e) => setPoiName(e.target.value)}
          placeholder="Name" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm" />
        <button onClick={onSave}
          className="w-full py-2 bg-green-500 text-white rounded-lg text-sm font-bold">📍 Save POI</button>
      </div>
    </div>,
    document.body
  );
}
