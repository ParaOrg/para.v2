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
    const data = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );
    
    const res = await supabase.from("ph_user_tracks").insert({
      user_id: null,
      route_uuid: data.route_uuid || null,
      route_name: data.route_name || "Unknown Route",
      total_time_sec: data.total_time_sec || 0,
      distance_m: data.totalDistanceM || 0,
      gps_points: data.gps_points?.length || 0,
      gps_track: data.gps_points || [],
      raw_payload: data,
    }).select();
    
    return new Response(
      JSON.stringify({ status: "success", track_uuid: res.data?.[0]?.track_uuid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
