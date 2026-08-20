import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("DB_URL")!,
      Deno.env.get("DB_SERVICE_KEY")!
    );
    
    const res = await supabase
      .from("ph_routes")
      .select("*")
      .eq("is_approved", true)
      .order("name");
    
    // Defensive filter — is_test may not exist
    const routes = (res.data || []).filter(r => {
      if (r.is_test === true) return false;
      const name = (r.name || '').toLowerCase();
      return !/\b(test|demo|dummy|sample|staging)\b/.test(name);
    });
    
    return new Response(
      JSON.stringify({ routes, total: routes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ routes: [], total: 0, error: e.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
