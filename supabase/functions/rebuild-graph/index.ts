import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // Clear existing graph
    await supabase.from("graph_edges").delete().neq("id", 0);
    await supabase.from("graph_nodes").delete().neq("id", 0);

    // Get ALL routes (verified + unverified)
    const { data: routes, error: routesError } = await supabase
      .from("ph_routes")
      .select("route_uuid, name, mode, is_approved");

    if (routesError) throw routesError;

    // Get ALL route shapes
    const { data: shapes, error: shapesError } = await supabase
      .from("ph_route_shapes")
      .select("route_uuid, geom");

    if (shapesError) throw shapesError;

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    for (const shape of shapes || []) {
      const route = routes?.find(r => r.route_uuid === shape.route_uuid);
      if (!route) continue;

      let coords = [];
      try {
        if (typeof shape.geom === 'string') {
          const match = shape.geom.match(/LINESTRING\(([^)]+)\)/i);
          if (match) {
            coords = match[1].split(',').map(p => {
              const [lng, lat] = p.trim().split(' ').map(Number);
              return [lng, lat];
            });
          }
        } else if (shape.geom?.coordinates) {
          coords = shape.geom.coordinates;
        }
      } catch {
        continue;
      }

      if (coords.length < 2) continue;

      const startCoord = coords[0];
      const endCoord = coords[coords.length - 1];

      const startId = `${route.route_uuid}_start`;
      const endId = `${route.route_uuid}_end`;

      if (!nodeSet.has(startId)) {
        nodes.push({ 
          node_id: startId, 
          lat: startCoord[1], 
          lon: startCoord[0],
          is_verified: route.is_approved || false
        });
        nodeSet.add(startId);
      }
      if (!nodeSet.has(endId)) {
        nodes.push({ 
          node_id: endId, 
          lat: endCoord[1], 
          lon: endCoord[0],
          is_verified: route.is_approved || false
        });
        nodeSet.add(endId);
      }

      let distKm = 0;
      for (let i = 1; i < coords.length; i++) {
        const [lng1, lat1] = coords[i-1];
        const [lng2, lat2] = coords[i];
        distKm += haversine(lat1, lng1, lat2, lng2);
      }

      const avgSpeed = route.mode === 'rail' ? 40 : route.mode === 'bus' ? 20 : 15;
      const travelMin = Math.max(1, Math.round((distKm / avgSpeed) * 60));

      // Weight unverified routes higher (more penalty)
      const weight = route.is_approved ? travelMin : travelMin * 1.5;

      edges.push({ from_node: startId, to_node: endId, weight: weight });
      edges.push({ from_node: endId, to_node: startId, weight: weight });

      // Transfer edges between nearby stops (500m)
      for (const existingNode of nodes) {
        if (existingNode.node_id === startId || existingNode.node_id === endId) continue;
        const dist = haversine(startCoord[1], startCoord[0], existingNode.lat, existingNode.lon);
        if (dist < 0.5) {
          edges.push({ from_node: startId, to_node: existingNode.node_id, weight: 5 });
          edges.push({ from_node: existingNode.node_id, to_node: startId, weight: 5 });
        }
      }
    }

    if (nodes.length > 0) {
      await supabase.from("graph_nodes").insert(nodes);
    }
    if (edges.length > 0) {
      await supabase.from("graph_edges").insert(edges);
    }

    return new Response(
      JSON.stringify({
        status: "success",
        total_routes: routes?.length || 0,
        verified_routes: routes?.filter(r => r.is_approved).length || 0,
        unverified_routes: routes?.filter(r => !r.is_approved).length || 0,
        nodes_created: nodes.length,
        edges_created: edges.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
