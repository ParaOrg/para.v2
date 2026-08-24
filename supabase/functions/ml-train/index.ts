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
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    // Fetch recent user tracks
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: tracks, error: tracksError } = await supabase
      .from("ph_user_tracks")
      .select("route_uuid, route_name, total_time_sec, distance_m, raw_payload")
      .gte("created_at", since)
      .not("route_uuid", "is", null);

    if (tracksError) throw tracksError;

    // Group by route and compute ML features
    const routeStats = new Map();

    for (const track of tracks || []) {
      const key = track.route_uuid;
      if (!routeStats.has(key)) {
        routeStats.set(key, {
          speeds: [],
          waitTimes: [],
          totalTrips: 0,
        });
      }
      const stats = routeStats.get(key);
      stats.totalTrips++;

      if (track.distance_m && track.total_time_sec && track.total_time_sec > 0) {
        const speed = (track.distance_m / 1000) / (track.total_time_sec / 3600);
        stats.speeds.push(speed);
      }

      // Extract wait times from raw_payload
      try {
        const raw = typeof track.raw_payload === 'string' 
          ? JSON.parse(track.raw_payload) 
          : track.raw_payload;
        if (raw?.segments) {
          for (const seg of raw.segments) {
            if (seg.type === 'waiting' && seg.durationSec) {
              stats.waitTimes.push(seg.durationSec / 60);
            }
          }
        }
      } catch {}
    }

    // Upsert into route_ml_stats
    const results = [];
    for (const [routeUuid, stats] of routeStats) {
      const avgSpeed = stats.speeds.length > 0 
        ? stats.speeds.reduce((a, b) => a + b, 0) / stats.speeds.length 
        : 0;
      const stdDev = stats.speeds.length > 1 
        ? Math.sqrt(stats.speeds.reduce((s, v) => s + Math.pow(v - avgSpeed, 2), 0) / (stats.speeds.length - 1)) 
        : 0;
      const avgWait = stats.waitTimes.length > 0 
        ? stats.waitTimes.reduce((a, b) => a + b, 0) / stats.waitTimes.length 
        : 0;
      const reliability = avgSpeed > 0 
        ? 1 / (1 + stdDev / avgSpeed) 
        : 0.5;

      const payload = {
        route_uuid: routeUuid,
        avg_speed_kmh: avgSpeed,
        std_dev_speed: stdDev,
        avg_wait_time_min: avgWait,
        reliability_score: reliability,
        total_trips: stats.totalTrips,
        last_trained_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("route_ml_stats")
        .upsert(payload, { onConflict: "route_uuid" })
        .select();

      if (error) {
        console.error(`Failed to upsert ${routeUuid}:`, error);
      } else {
        results.push(data?.[0]);
      }
    }

    return new Response(
      JSON.stringify({ 
        status: "success", 
        routes_trained: results.length,
        trained_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
