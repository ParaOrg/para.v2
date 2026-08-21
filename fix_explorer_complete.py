import re

file_path = 'src/pages/RoutesExplorer.jsx'

with open(file_path, 'r') as f:
    content = f.read()

# 1. Add getModeColor import if missing
if "import { getModeColor }" not in content:
    content = content.replace(
        'import BottomNav from "../components/BottomNav";',
        'import BottomNav from "../components/BottomNav";\nimport { getModeColor } from "../utils/modeColors";'
    )

# 2. Add SUPABASE constants
if "const SUPABASE_URL" not in content:
    content = content.replace(
        'const API = getApiBaseUrl();',
        '''const API = getApiBaseUrl();
const SUPABASE_URL = "https://tcvomrkytxnetzijwqad.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o";'''
    )

# 3. Add activeMode state
if "activeMode" not in content:
    content = content.replace(
        'const [verifiedNames, setVerifiedNames] = useState(new Set());',
        'const [verifiedNames, setVerifiedNames] = useState(new Set());\n  const [activeMode, setActiveMode] = useState(null);'
    )

# 4. Replace ALL hardcoded supabase URLs with constants
content = content.replace(
    'https://tcvomrkytxnetzijwqad.supabase.co/rest/v1/ph_route_shapes',
    '${SUPABASE_URL}/rest/v1/ph_route_shapes'
)

# 5. Replace hardcoded anon keys
content = content.replace(
    "apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.ljYfw72N5dm4GsM1yKvV4bNNb8sWEoErTD3TrGz1s0o'",
    'apikey: SUPABASE_ANON_KEY'
)
content = content.replace(
    "apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdm9tcmt5dHhuZXR6aWp3cWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0MzY3NDgsImV4cCI6MjA3MzAxMjc0OH0.JyU9lX6yE2bH4N1mK8pQ3rT5vW9xY2zA4bC6dE8fG0h'",
    'apikey: SUPABASE_ANON_KEY'
)

# 6. Add mega map useEffect after the mobileOpen effect
mega_effect = '''
  // Draw mega map when Build tab is active and queue has routes
  useEffect(() => {
    if (tab !== "build") return;
    if (buildQueue.length === 0) return;
    
    const drawMegaMap = async () => {
      setLoading(true);
      layerRef.current?.clearLayers();
      const bounds = L.latLngBounds([]);
      
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/ph_route_shapes?select=route_uuid,geom_geojson&limit=2000`, {
          headers: { apikey: SUPABASE_ANON_KEY }
        });
        if (!res.ok) throw new Error("Failed to fetch shapes");
        const allShapes = await res.json();
        
        const shapeByUuid = {};
        allShapes.forEach(s => {
          if (s.route_uuid && s.geom_geojson) {
            shapeByUuid[s.route_uuid] = s.geom_geojson;
          }
        });
        
        // Sort: least frequent drawn first (bottom), most frequent last (top)
        const modeFrequency = {};
        buildQueue.forEach(r => {
          const m = r.mode || "default";
          modeFrequency[m] = (modeFrequency[m] || 0) + 1;
        });
        const sortedQueue = [...buildQueue].sort((a, b) => {
          const ma = a.mode || "default";
          const mb = b.mode || "default";
          return (modeFrequency[ma] || 0) - (modeFrequency[mb] || 0);
        });
        
        for (const route of sortedQueue) {
          if (activeMode && route.mode !== activeMode) continue;
          const routeId = route.route_uuid;
          if (!routeId || routeId === "undefined") continue;
          
          const geomData = shapeByUuid[routeId];
          if (!geomData) continue;
          
          const geo = {
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              properties: {},
              geometry: geomData
            }]
          };
          
          const layer = L.geoJSON(geo, { 
            style: { color: getModeColor(route.mode || "default"), weight: 3, opacity: 0.7 } 
          }).addTo(layerRef.current);
          layer.bindTooltip(route.name || route.route_name, { sticky: true });
          const b = layer.getBounds();
          if (b.isValid()) bounds.extend(b);
        }
      } catch (err) {
        console.error("Mega map error:", err);
      }
      
      if (bounds.isValid()) mapInst.current?.fitBounds(bounds, { padding: [60, 60] });
      setLoading(false);
    };
    
    drawMegaMap();
  }, [tab, buildQueue, activeMode]);
'''

old_effect = "  useEffect(() => { if (!isMobile && mobileOpen) setMobileOpen(false); }, [isMobile, mobileOpen]);"
content = content.replace(old_effect, old_effect + mega_effect)

# 7. Add clickable legend after map div
old_map_div = '<div ref={mapRef} className="absolute inset-0 z-0" />'
new_map_div = '''<div ref={mapRef} className="absolute inset-0 z-0" />
          
          {/* Map Legend - Clickable */}
          <div className="absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2.5 border border-gray-100 max-w-[160px]">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-gray-700">Transit Modes</p>
              {activeMode && (
                <button onClick={() => setActiveMode(null)} className="text-[9px] text-purple-600 font-bold hover:underline">Show All</button>
              )}
            </div>
            <div className="space-y-1">
              <button onClick={() => setActiveMode(activeMode === "rail" ? null : "rail")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "rail" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("rail") }} />
                <span className="text-[10px] text-gray-600">Rail</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "jeepney" ? null : "jeepney")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "jeepney" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("jeepney") }} />
                <span className="text-[10px] text-gray-600">Jeepney</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "bus" ? null : "bus")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "bus" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("bus") }} />
                <span className="text-[10px] text-gray-600">Bus</span>
              </button>
              <button onClick={() => setActiveMode(activeMode === "uv_express" ? null : "uv_express")} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors ${activeMode === "uv_express" ? "bg-purple-50" : "hover:bg-gray-50"}`}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: getModeColor("uv_express") }} />
                <span className="text-[10px] text-gray-600">UV Express</span>
              </button>
            </div>
          </div>'''

content = content.replace(old_map_div, new_map_div)

with open(file_path, 'w') as f:
    f.write(content)

print("Complete rewrite done")
