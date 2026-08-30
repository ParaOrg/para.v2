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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const res = await supabase.from("fare_reports").insert({
      user_email: data.user_email || "anonymous",
      route_name: data.route_name || "",
      mode: data.mode || "transit",
      fare_amount: data.fare_amount || 0,
      city: data.city || "Metro Manila",
      region: data.region || "NCR",
      tnvs_provider: data.tnvs_provider,
      surge_multiplier: data.surge_multiplier || 1,
      is_surge: data.is_surge || false,
      reported_at: data.reported_at || new Date().toISOString(),
    }).select();
    
    if (res.error) {
      return new Response(
        JSON.stringify({ status: "error", message: res.error.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    return new Response(
      JSON.stringify({ status: "success", fare_id: res.data?.[0]?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
