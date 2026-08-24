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
    // This function is designed to be called by pg_cron or external scheduler
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_KEY")!
    );

    // Get counts of new data since last training
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // Last hour

    const [tracksRes, faresRes, poisRes] = await Promise.all([
      supabase.from("ph_user_tracks").select("track_uuid", { count: "exact" }).gte("created_at", since),
      supabase.from("fare_reports").select("id", { count: "exact" }).gte("reported_at", since),
      supabase.from("ph_places").select("id", { count: "exact" }).gte("created_at", since),
    ]);

    const newDataCount = (tracksRes.count || 0) + (faresRes.count || 0) + (poisRes.count || 0);

    // If enough new data, trigger training
    if (newDataCount > 10) {
      // Call ml-train function
      const trainRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/ml-train`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_KEY")}`,
            "Content-Type": "application/json",
          },
        }
      );
      const trainData = await trainRes.json();

      return new Response(
        JSON.stringify({
          status: "trained",
          new_data_count: newDataCount,
          train_result: trainData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "skipped",
        new_data_count: newDataCount,
        message: "Not enough new data to trigger training",
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
