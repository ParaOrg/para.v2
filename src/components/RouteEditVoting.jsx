import { useState, useEffect } from "react";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function RouteEditVoting({ routeUuid, onClose }) {
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/community/route-edits?route_uuid=${routeUuid}`)
      .then(r => r.json())
      .then(d => setEdits(d.edits || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [routeUuid]);

  const vote = async (editUuid, voteType) => {
    try {
      await fetch(`${API}/community/route-edits/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edit_uuid: editUuid, vote: voteType }),
      });
      // Refresh
      const res = await fetch(`${API}/community/route-edits?route_uuid=${routeUuid}`);
      const d = await res.json();
      setEdits(d.edits || []);
    } catch (e) {
      console.error("Vote failed:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Community Route Edits</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading edits...</p>
          ) : edits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No pending edits for this route.</p>
          ) : (
            edits.map((edit) => (
              <div key={edit.edit_uuid} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#7A4BC8] capitalize">{edit.edit_type}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    by {(edit.user_email || "anonymous").split("@")[0]}
                  </span>
                </div>

                <div className="mt-2 text-sm">
                  <p className="text-xs text-gray-400">Before: {edit.before_data?.segments?.length || 0} segments</p>
                  <p className="text-xs text-gray-400">After: {edit.after_data?.segments?.length || 0} segments</p>
                </div>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => vote(edit.edit_uuid, "up")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200"
                  >
                    👍 {edit.upvotes || 0}
                  </button>
                  <button
                    onClick={() => vote(edit.edit_uuid, "down")}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200"
                  >
                    👎 {edit.downvotes || 0}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
