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
    
    const res = await supabase.from("ph_places").insert({
      canonical_name: data.canonical_name,
      category: data.category || "landmark",
      location: `POINT(${data.lng} ${data.lat})`,
      is_active: true,
    }).select();
    
    return new Response(
      JSON.stringify({ status: "success", message: `Added ${data.canonical_name}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
