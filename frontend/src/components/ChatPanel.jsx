import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getApiBaseUrl } from "../config/api";
import transferPinImg from "../assets/images/logo1.jpg";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const API = getApiBaseUrl();
const CENTER = [14.5995, 120.9842];
const P = "#310775";
const CACHE_KEY = "para_route_cache";
const MAX_CACHE = 20;
const COLORS = { jeep: "#FBBC05", jeepney: "#FBBC05", bus: "#34A853", lrt: "#FF6D00", mrt: "#FF6D00", train: "#FF6D00", uv: "#9C27B0", uv_express: "#9C27B0", walk: "#9CA3AF" };
const VEHICLE_EMOJI = { jeepney: "🚐", jeep: "🚐", bus: "🚌", lrt: "🚆", mrt: "🚆", train: "🚆", uv: "🚙", uv_express: "🚙" };

function getColor(t) { return COLORS[(t || "").toLowerCase()] || P; }
function vehEmoji(t) { return VEHICLE_EMOJI[(t || "").toLowerCase()] || "🚐"; }
function getCache() { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}"); } catch { return {}; } }
function setCache(k, d) { const c = getCache(); c[k] = { data: d, time: Date.now() }; const ks = Object.keys(c).slice(-MAX_CACHE); const t = {}; ks.forEach(x => t[x] = c[x]); sessionStorage.setItem(CACHE_KEY, JSON.stringify(t)); }

function startIcon() { return L.divIcon({ className: '', html: '<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px #22c55e44,0 2px 6px rgba(0,0,0,0.3)"></div>', iconSize: [14,14], iconAnchor: [7,7] }); }
function endIcon() { return L.divIcon({ className: '', html: '<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 3px #ef444444,0 2px 6px rgba(0,0,0,0.3)"></div>', iconSize: [14,14], iconAnchor: [7,7] }); }
function transferIcon() { return L.icon({ iconUrl: transferPinImg, iconSize: [32,32], iconAnchor: [16,16] }); }
function boardIcon() { return L.divIcon({ className: '', html: `<div style="background:${P};color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">🚐</div>`, iconSize: [22,22], iconAnchor: [11,11] }); }
function getOffIcon() { return L.divIcon({ className: '', html: '<div style="background:#f59e0b;color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">⬇</div>', iconSize: [22,22], iconAnchor: [11,11] }); }

function RouteCard({ routeData, alts, origin, dest, onSave }) {
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const steps = routeData?.steps || [];
  if (!steps.length) return null;
  const journey = []; let i = 0;
  while (i < steps.length) {
    const s = steps[i]; const isWalk = s.action === "walk" || s.vehicle_type === "walk";
    if (isWalk) { let d = s.distance_m || 0, t = s.duration_min || 0; while (i + 1 < steps.length && (steps[i+1].action === "walk" || steps[i+1].vehicle_type === "walk")) { i++; d += steps[i].distance_m || 0; t += steps[i].duration_min || 0; } journey.push({ type: "walk", dist: d, time: t }); i++; }
    else { const ride = { type: "ride", vehicle: s.vehicle_type, route: s.route_name, time: s.duration_min || 0, fare: s.fare || 0 }; i++; while (i < steps.length && steps[i].action !== "walk" && steps[i].vehicle_type !== "walk" && steps[i].route_name === ride.route) { ride.time += steps[i].duration_min || 0; ride.fare += steps[i].fare || 0; i++; } journey.push(ride); }
  }
  const share = () => { navigator.clipboard.writeText(`🚐 Para PH\n${origin||"?"} → ${dest||"?"}\n${routeData.message}`).then(() => { setShared(true); setTimeout(() => setShared(false), 2000); }); };
  const save = () => { setSaved(true); if (onSave) onSave(); };
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1.5 text-[10px]">
        <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center"><div className="font-bold" style={{color:P}}>{(routeData.total_duration_min||0).toFixed(0)} min</div><div className="text-gray-400">Total</div></div>
        <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center"><div className="font-bold" style={{color:P}}>₱{(routeData.total_fare||0).toFixed(0)}</div><div className="text-gray-400">Fare</div></div>
        <div className="flex-1 bg-purple-50 rounded-lg p-2 text-center"><div className="font-bold" style={{color:P}}>{journey.filter(j=>j.type==="ride").length}</div><div className="text-gray-400">Rides</div></div>
      </div>
      <div className="relative pl-5">
        <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gray-200" />
        <div className="relative pb-2"><div className="absolute left-[-14px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:"#22c55e"}} /><div className="pl-1"><span className="text-[10px] font-bold text-green-600">START</span><span className="text-[11px] text-gray-700 ml-1">{origin || "Current Location"}</span></div></div>
        {journey.map((seg, idx) => seg.type === "walk" ? (
          <div key={idx} className="relative pb-2"><div className="absolute left-[-14px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:"#9CA3AF"}} /><div className="pl-1"><span className="text-[10px] text-gray-400">🚶 Walk {seg.time.toFixed(0)} min ({(seg.dist/1000).toFixed(1)} km)</span></div></div>
        ) : (
          <div key={idx} className="relative pb-2">
            <div className="absolute left-[-14px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:P}} />
            <div className="pl-1"><div className="bg-purple-50 border border-purple-100 rounded-xl p-2.5"><div className="flex items-center gap-2"><span className="text-lg">{vehEmoji(seg.vehicle)}</span><div className="flex-1 min-w-0"><span className="text-[10px] font-bold text-purple-800 uppercase">Board</span><div className="font-semibold text-xs text-gray-800 capitalize">{seg.vehicle}</div><div className="text-[11px] truncate" style={{color:P}}>{seg.route&&seg.route!=="?"?seg.route:""}</div></div><div className="text-right shrink-0"><div className="text-[10px] font-bold text-gray-800">{seg.time.toFixed(0)} min</div><div className="text-[10px] text-gray-400">₱{seg.fare.toFixed(0)}</div></div></div></div></div>
            <div className="absolute left-[-14px] top-[calc(100%-8px)] w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:"#f59e0b"}} /><div className="pl-1 mt-1"><div className="bg-amber-50 border border-amber-100 rounded-xl p-2"><span className="text-[10px] font-bold text-amber-700">GET OFF</span></div></div>
          </div>
        ))}
        <div className="relative pb-1"><div className="absolute left-[-14px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{background:"#ef4444"}} /><div className="pl-1"><span className="text-[10px] font-bold text-red-500">DESTINATION</span><span className="text-[11px] text-gray-700 ml-1">{dest || "Destination"}</span></div></div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={share} className="flex-1 text-[10px] font-semibold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">{shared ? "✅ Copied!" : "📤 Share"}</button>
        <button onClick={save} className="flex-1 text-[10px] font-semibold py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">{saved ? "💾 Saved!" : "💾 Save"}</button>
      </div>
      {alts?.length > 0 && <div className="mt-2 pt-2 border-t border-gray-100"><p className="text-[10px] text-gray-400 uppercase font-bold mb-1">🔄 {alts.length} Alternative{alts.length>1?"s":""}</p>{alts.map((alt, j) => <div key={j} className="text-[10px] text-gray-500 flex gap-2 py-0.5"><span style={{color:P}}>Alt {j+1}:</span><span>{alt.message}</span></div>)}</div>}
    </div>
  );
}

function Rating({ routeData, origin, dest, onApprove }) {
  const [v, setV] = useState(null);
  const cast = (s) => {
    setV(s);
    fetch(`${API}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "u", route_id: `r_${Date.now()}`, rating: s, origin_name: origin || "", destination_name: dest || "" }) }).catch(() => {});
    if (s >= 6 && onApprove) onApprove();
  };
  if (v) return <div className="text-center text-green-500 text-[10px] mt-2">✅ Salamat!</div>;
  return <div className="mt-2 pt-2 border-t border-gray-100 flex justify-center gap-4">{[{ s: 7, e: "👍" }, { s: 3, e: "😐" }, { s: 1, e: "👎" }].map(({ s, e }) => <button key={s} onClick={() => cast(s)} className="hover:scale-110 text-lg">{e}</button>)}</div>;
}

function addPins(map, group, route) {
  if (!route?.steps?.length) return;
  const steps = route.steps;
  const s0 = steps[0]?.geometry?.[0];
  if (s0) L.marker([s0[1],s0[0]],{icon:startIcon()}).addTo(group).bindTooltip("🟢 Start",{direction:"top"});
  const last = steps[steps.length-1];
  const end = last?.geometry?.[last.geometry.length-1];
  if (end) L.marker([end[1],end[0]],{icon:endIcon()}).addTo(group).bindTooltip("🔴 Destination",{direction:"top"});
  for (let i=0;i<steps.length;i++) {
    const s=steps[i]; if (s.action==="walk"||s.vehicle_type==="walk") continue;
    const label = s.route_name&&s.route_name!=="?"?s.route_name:s.vehicle_type;
    const bc = s.geometry?.[0]; if (bc) L.marker([bc[1],bc[0]],{icon:boardIcon()}).addTo(group).bindTooltip(`🟣 Board: ${label}`,{direction:"top"});
    const ni=i+1, nw=ni<steps.length&&(steps[ni].action==="walk"||steps[ni].vehicle_type==="walk");
    const nd=ni<steps.length&&!nw&&steps[ni].route_name!==s.route_name, isLast=ni>=steps.length;
    if ((nw||nd)&&!isLast) { const oc=s.geometry?.[s.geometry.length-1]; if(oc) L.marker([oc[1],oc[0]],{icon:getOffIcon()}).addTo(group).bindTooltip(`🟡 Get off: ${label}`,{direction:"top"}); }
  }
}

export default function ChatPanel() {
  const mapRef=useRef(null),mapInst=useRef(null),rl=useRef(null);
  const [msgs,setMsgs]=useState([{sender:"bot",text:"Kumusta! Saan tayo papunta?"}]);
  const [inp,setInp]=useState(""); const [load,setLoad]=useState(false);
  const [collapsed,setCollapsed]=useState(false);

  useEffect(()=>{if(!mapRef.current||mapInst.current)return; const map=L.map(mapRef.current,{zoomControl:false,attributionControl:false}).setView(CENTER,12); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map); L.control.zoom({position:"bottomright"}).addTo(map); mapInst.current=map; rl.current=L.layerGroup().addTo(map); },[]);

  const draw=(pri,alts)=>{rl.current.clearLayers(); addPins(mapInst.current,rl.current,pri);
    const d=(r,w=6,dash=null)=>{if(!r?.steps)return null; const ll=r.steps.flatMap(s=>(s.geometry||[]).filter(c=>Array.isArray(c)&&c.length>=2).map(c=>[c[1],c[0]])); if(ll.length<2)return null;
      const ts=r.steps.find(s=>s.action!=="walk")||r.steps[0];
      const label=ts.route_name&&ts.route_name!=="?"?ts.route_name:"Route";
      return L.polyline(ll,{color:P,weight:w,opacity:0.9,dashArray:dash}).addTo(rl.current).bindTooltip(label,{sticky:true});
    };
    if(alts)alts.forEach(a=>d(a,3,"10 6")); const p=d(pri,6); if(p)try{mapInst.current?.fitBounds(p.getBounds(),{padding:[50,50]})}catch{}
  };

  const clean=r=>{if(!r?.steps)return null; const ss=r.steps.map(s=>({...s,geometry:(s.geometry||[]).filter(c=>Array.isArray(c)&&c.length>=2&&!isNaN(c[0])&&!isNaN(c[1]))})).filter(s=>s.geometry.length>=2); return{...r,steps:ss};};

  const saveRoute = (origin, dest, routeData) => {
    const cacheKey = `${origin || ""}_${dest || ""}`.toLowerCase();
    setCache(cacheKey, { route_data: routeData, reply_text: `${routeData.message} 💾 Saved`, origin, destination: dest });
  };

  const send=async()=>{if(!inp.trim())return; setMsgs(p=>[...p,{sender:"user",text:inp}]); const q=inp.toLowerCase().trim(); setInp(""); setLoad(true); setCollapsed(false);
    try{const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),30000); const res=await fetch(`${API}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({user_id:"guest",message:q}),signal:ctrl.signal}); const data=await res.json(); const pri=clean(data.route_data); const alts=(data.alternatives||[]).map(clean).filter(Boolean); setMsgs(p=>[...p,{sender:"bot",text:data.reply_text,routeData:pri,alts,origin:data.origin,dest:data.destination}]); if(pri)draw(pri,alts);}catch{setMsgs(p=>[...p,{sender:"bot",text:"❌ Error sa server."}]);} setLoad(false);};

  return (
    <div className="fixed inset-0 flex flex-col">
      <div ref={mapRef} className="absolute inset-0 z-0" />
      {collapsed && <button onClick={()=>setCollapsed(false)} className="absolute bottom-4 left-4 z-10 bg-white rounded-2xl shadow-xl px-4 py-3 flex items-center gap-2 font-bold text-sm md:hidden" style={{color:P}}>🚐 Routes</button>}
      <div className={`absolute bottom-4 left-4 right-4 md:left-4 md:right-auto md:w-96 z-10 flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ${collapsed?'max-h-0 md:max-h-[80vh] opacity-0 md:opacity-100':'max-h-[80vh]'}`}>
        <div className="text-white p-3 font-bold text-sm flex items-center gap-2 shrink-0 justify-between" style={{background:`linear-gradient(135deg,${P},#5a1fa8)`}}><span>🚐 Para PH</span><button onClick={()=>setCollapsed(true)} className="md:hidden text-white/70 hover:text-white text-lg leading-none">&times;</button></div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[120px]">
          {msgs.map((m,i)=>(
            <div key={i} className={`flex ${m.sender==="user"?"justify-end":"justify-start"}`}>
              <div className={`max-w-[95%] p-3 rounded-2xl text-sm ${m.sender==="user"?"text-white rounded-br-none":"bg-white text-gray-800 rounded-bl-none border border-gray-100 shadow-sm"}`} style={m.sender==="user"?{background:`linear-gradient(135deg,${P},#5a1fa8)`}:{}}>
                <div className="whitespace-pre-wrap mb-1">{m.text}</div>
                {m.routeData?.success && m.routeData.steps?.length > 0 && (
                  <>
                    <RouteCard routeData={m.routeData} alts={m.alts} origin={m.origin} dest={m.dest} onSave={() => saveRoute(m.origin, m.destination, m.routeData)} />
                    <Rating routeData={m.routeData} origin={m.origin} dest={m.dest} onApprove={() => saveRoute(m.origin, m.destination, m.routeData)} />
                  </>
                )}
              </div>
            </div>
          ))}
          {load&&<div className="flex justify-start"><div className="bg-white border border-gray-100 text-gray-400 p-3 rounded-2xl rounded-bl-none text-sm italic">Naghahanap ng ruta…</div></div>}
        </div>
        <div className="p-3 border-t border-gray-100 bg-white flex gap-2 shrink-0">
          <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Saan papunta?" className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2" />
          <button onClick={send} disabled={load} className="text-white px-4 py-2 rounded-xl hover:opacity-90 disabled:opacity-50 font-semibold text-sm" style={{background:P}}>Send</button>
        </div>
      </div>
    </div>
  );
}