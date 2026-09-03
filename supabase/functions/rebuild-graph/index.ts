import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    await supabase.from("graph_edges").delete().neq("id", 0);
    await supabase.from("graph_nodes").delete().neq("id", 0);

    const { data: shapes, error: shapesError } = await supabase
      .rpc("get_route_shapes_geojson");

    if (shapesError) throw shapesError;

    let allRoutes = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("ph_routes")
        .select("route_uuid, name, mode, is_approved")
        .range(offset, offset + 999);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allRoutes = allRoutes.concat(data);
      offset += 1000;
      if (data.length < 1000) break;
    }

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    for (const shape of shapes || []) {
      const route = allRoutes?.find(r => r.route_uuid === shape.route_uuid);
      if (!route) continue;

      let coords = [];
      try {
        const geo = JSON.parse(shape.geojson);
        if (geo.type === 'LineString' && geo.coordinates) {
          coords = geo.coordinates;
        }
      } catch { continue; }

      if (coords.length < 2) continue;

      const startCoord = coords[0];
      const endCoord = coords[coords.length - 1];

      const startId = `${route.route_uuid}_start`;
      const endId = `${route.route_uuid}_end`;

      if (!nodeSet.has(startId)) {
        nodes.push({ node_id: startId, lat: startCoord[1], lon: startCoord[0] });
        nodeSet.add(startId);
      }
      if (!nodeSet.has(endId)) {
        nodes.push({ node_id: endId, lat: endCoord[1], lon: endCoord[0] });
        nodeSet.add(endId);
      }

      let distKm = 0;
      for (let i = 1; i < coords.length; i++) {
        distKm += haversine(coords[i-1][1], coords[i-1][0], coords[i][1], coords[i][0]);
      }

      const avgSpeed = route.mode === 'rail' ? 40 : route.mode === 'bus' ? 20 : 15;
      const travelMin = Math.max(1, Math.round((distKm / avgSpeed) * 60));
      const weight = route.is_approved ? travelMin : travelMin * 1.5;

      edges.push({ from_node: startId, to_node: endId, weight, route_name: route.name, mode: route.mode });
      edges.push({ from_node: endId, to_node: startId, weight, route_name: route.name, mode: route.mode });

      // Transfer edges
      for (const existingNode of nodes) {
        if (existingNode.node_id === startId || existingNode.node_id === endId) continue;
        const dist = haversine(startCoord[1], startCoord[0], existingNode.lat, existingNode.lon);
        if (dist < 0.5) {
          edges.push({ from_node: startId, to_node: existingNode.node_id, weight: 5, route_name: 'Transfer', mode: 'walk' });
          edges.push({ from_node: existingNode.node_id, to_node: startId, weight: 5, route_name: 'Transfer', mode: 'walk' });
        }
      }
    }

    if (nodes.length > 0) {
      for (let i = 0; i < nodes.length; i += 500) {
        await supabase.from("graph_nodes").insert(nodes.slice(i, i + 500));
      }
    }
    if (edges.length > 0) {
      for (let i = 0; i < edges.length; i += 500) {
        await supabase.from("graph_edges").insert(edges.slice(i, i + 500));
      }
    }

    return new Response(
      JSON.stringify({ status: "success", routes: allRoutes.length, nodes: nodes.length, edges: edges.length }),
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
