import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// In-memory cache
let graphCache: Map<string, Array<[string, number]>> | null = null;
let nodesCache: Array<{node_id: string, lat: number, lon: number}> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function loadGraph(supabase: any) {
  if (graphCache && nodesCache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { graph: graphCache, nodes: nodesCache };
  }

  const graph = new Map<string, Array<[string, number]>>();
  let offset = 0;
  const pageSize = 1000;

  // Load edges - use order by id for stable pagination
  while (true) {
    const { data, error } = await supabase
      .from("graph_edges")
      .select("from_node,to_node,weight")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const edge of data) {
      if (!graph.has(edge.from_node)) {
        graph.set(edge.from_node, []);
      }
      graph.get(edge.from_node)!.push([edge.to_node, edge.weight]);
    }

    offset += pageSize;
    if (data.length < pageSize) break;
  }

  // Load nodes
  const { data: nodes, error: nodeError } = await supabase
    .from("graph_nodes")
    .select("node_id,lat,lon")
    .limit(50000);

  if (nodeError) throw nodeError;

  graphCache = graph;
  nodesCache = nodes || [];
  cacheTimestamp = Date.now();
  return { graph, nodes: nodesCache };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findNearestNode(lat: number, lon: number, nodes: Array<{node_id: string, lat: number, lon: number}>): string {
  let nearest = "";
  let minDist = Infinity;
  for (const n of nodes) {
    const d = haversine(lat, lon, n.lat, n.lon);
    if (d < minDist) {
      minDist = d;
      nearest = n.node_id;
    }
  }
  return nearest;
}

function dijkstra(
  graph: Map<string, Array<[string, number]>>,
  start: string,
  end: string,
): string[] {
  if (!graph.has(start) || !graph.has(end)) return [];

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  
  const heap: Array<[number, string]> = [[0, start]];
  dist.set(start, 0);

  while (heap.length > 0) {
    heap.sort((a, b) => a[0] - b[0]);
    const [d, u] = heap.shift()!;

    if (visited.has(u)) continue;
    visited.add(u);
    if (u === end) break;
    if (d > (dist.get(u) ?? Infinity)) continue;

    const neighbors = graph.get(u) || [];
    for (const [v, w] of neighbors) {
      const nd = d + w;
      if (nd < (dist.get(v) ?? Infinity)) {
        dist.set(v, nd);
        prev.set(v, u);
        heap.push([nd, v]);
      }
    }
  }

  if (!prev.has(end) && start !== end) return [];

  const path: string[] = [];
  let u: string | undefined = end;
  while (u !== undefined) {
    path.push(u);
    u = prev.get(u);
  }
  return path.reverse();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { origin_lat, origin_lng, dest_lat, dest_lng } = await req.json();

    if (!origin_lat || !origin_lng || !dest_lat || !dest_lng) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing coordinates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const { graph, nodes } = await loadGraph(supabase);

    const start = findNearestNode(origin_lat, origin_lng, nodes);
    const end = findNearestNode(dest_lat, dest_lng, nodes);

    const path = dijkstra(graph, start, end);

    return new Response(
      JSON.stringify({
        status: "success",
        path: path,
        path_length: path.length,
        graph_nodes: graph.size,
        start_node: start,
        end_node: end,
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
