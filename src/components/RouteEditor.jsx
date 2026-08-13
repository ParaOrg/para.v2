import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getApiBaseUrl } from "../utils/api";

const API = getApiBaseUrl();

export default function RouteEditor({ routeData, onClose, onSubmitted }) {
  const auth = useAuth();
  const [segments, setSegments] = useState([]);
  const [originalSegments, setOriginalSegments] = useState([]);
  const [editType, setEditType] = useState("");
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (routeData?.segments) {
      const segs = routeData.segments.map((s, i) => ({
        ...s,
        index: i,
        route_name: s.route || s.type || "Unknown",
        mode: s.type || "transit",
      }));
      setSegments(segs);
      setOriginalSegments(JSON.parse(JSON.stringify(segs)));
    }
  }, [routeData]);

  const addWalkSegment = (index) => {
    const newSeg = {
      index: segments.length,
      route_name: "WALK",
      mode: "walk",
      is_transfer: true,
      time_min: 5,
      distance_m: 300,
      geometry: [],
    };
    const updated = [...segments];
    updated.splice(index + 1, 0, newSeg);
    setSegments(updated.map((s, i) => ({ ...s, index: i })));
    setEditType("add_walk");
  };

  const removeSegment = (index) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((_, i) => i !== index).map((s, i) => ({ ...s, index: i })));
    setEditType("remove_segment");
  };

  const splitSegment = (index) => {
    const seg = segments[index];
    const halfTime = Math.floor((seg.time_min || 10) / 2);
    const seg1 = { ...seg, index, time_min: halfTime };
    const seg2 = { ...seg, index: index + 1, time_min: (seg.time_min || 10) - halfTime, route_name: "WALK", mode: "walk", is_transfer: true };
    const updated = [...segments.slice(0, index), seg1, seg2, ...segments.slice(index + 1)];
    setSegments(updated.map((s, i) => ({ ...s, index: i })));
    setEditType("split_segment");
  };

  const mergeWithNext = (index) => {
    if (index >= segments.length - 1) return;
    const seg1 = segments[index];
    const seg2 = segments[index + 1];
    const merged = {
      ...seg1,
      index,
      time_min: (seg1.time_min || 0) + (seg2.time_min || 0),
      distance_m: (seg1.distance_m || 0) + (seg2.distance_m || 0),
      fare: (seg1.fare || 0) + (seg2.fare || 0),
    };
    const updated = [...segments.slice(0, index), merged, ...segments.slice(index + 2)];
    setSegments(updated.map((s, i) => ({ ...s, index: i })));
    setEditType("merge_segment");
  };

  const updateSegment = (index, field, value) => {
    setSegments(segments.map(s => s.index === index ? { ...s, [field]: value } : s));
    setEditType("update_segment");
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...segments];
    [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
    setSegments(updated.map((s, i) => ({ ...s, index: i })));
    setEditType("reorder");
  };

  const moveDown = (index) => {
    if (index === segments.length - 1) return;
    const updated = [...segments];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setSegments(updated.map((s, i) => ({ ...s, index: i })));
    setEditType("reorder");
  };

  const submitEdit = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/community/route-edits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route_uuid: routeData?.route_uuid || null,
          user_email: auth.user?.email || "anonymous",
          edit_type: editType || "custom",
          before_data: { segments: originalSegments },
          after_data: { segments },
        }),
      });
      const data = await res.json();
      if (data.status === "success") {
        setMessage({ ok: true, text: "Edit submitted for community review!" });
        if (onSubmitted) setTimeout(onSubmitted, 1500);
      } else {
        setMessage({ ok: false, text: data.message || "Failed to submit" });
      }
    } catch (e) {
      setMessage({ ok: false, text: "Network error" });
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Edit Route — Community Proposal</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-4 space-y-3">
          {message && (
            <div className={`text-xs p-2 rounded-lg ${message.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {message.text}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Edit segments to improve this route. Your proposal will be voted on by the community before going live.
          </p>

          {segments.map((seg, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                <input
                  value={seg.route_name}
                  onChange={(e) => updateSegment(i, "route_name", e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none"
                />
                <select
                  value={seg.mode}
                  onChange={(e) => updateSegment(i, "mode", e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg"
                >
                  <option value="transit">Transit</option>
                  <option value="jeepney">Jeepney</option>
                  <option value="bus">Bus</option>
                  <option value="train">Train</option>
                  <option value="walk">Walk</option>
                  <option value="uv_express">UV Express</option>
                </select>
              </div>

              <div className="flex gap-2 text-xs text-gray-500">
                <input
                  type="number"
                  value={seg.time_min || 0}
                  onChange={(e) => updateSegment(i, "time_min", parseInt(e.target.value) || 0)}
                  placeholder="Min"
                  className="w-16 px-2 py-1 border border-gray-200 rounded-lg outline-none"
                />
                <span className="self-center">min</span>
                <input
                  type="number"
                  value={seg.fare || 0}
                  onChange={(e) => updateSegment(i, "fare", parseFloat(e.target.value) || 0)}
                  placeholder="Fare"
                  className="w-20 px-2 py-1 border border-gray-200 rounded-lg outline-none"
                />
                <span className="self-center">₱</span>

                <div className="ml-auto flex gap-1">
                  <button onClick={() => moveUp(i)} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">↑</button>
                  <button onClick={() => moveDown(i)} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">↓</button>
                  <button onClick={() => removeSegment(i)} className="px-2 py-1 bg-red-50 text-red-500 border border-red-200 rounded text-xs">✕</button>
                </div>
              </div>

              <div className="flex gap-1 flex-wrap">
                <button onClick={() => addWalkSegment(i)} className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 rounded-lg">+ Walk</button>
                <button onClick={() => splitSegment(i)} className="px-2 py-1 text-[10px] bg-amber-50 text-amber-600 rounded-lg">Split</button>
                {i < segments.length - 1 && (
                  <button onClick={() => mergeWithNext(i)} className="px-2 py-1 text-[10px] bg-purple-50 text-purple-600 rounded-lg">Merge with next</button>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={submitEdit}
            disabled={saving}
            className="w-full py-3 bg-[#7A4BC8] text-white rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {saving ? "Submitting..." : "Submit for Community Review"}
          </button>
        </div>
      </div>
    </div>
  );
}
