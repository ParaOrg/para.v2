export default function ContributeButtons({ setMode }) {
  return (
    <div className="p-4 space-y-3">
      <button onClick={() => setMode("personal_setup")}
        className="w-full py-5 bg-[#7A4BC8] text-white rounded-2xl font-black text-lg shadow-lg">
        📍 Add Personal Route
      </button>
      <button onClick={() => setMode("route_setup")}
        className="w-full py-4 bg-purple-800 text-white rounded-2xl font-bold text-lg">
        ✏️ Add Route (Transit Line)
      </button>
      <button onClick={() => setMode("poi")}
        className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg">
        📌 Add POI
      </button>
      <button onClick={() => setMode("upload")}
        className="w-full py-4 bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg">
        📤 Upload File
      </button>
    </div>
  );
}
