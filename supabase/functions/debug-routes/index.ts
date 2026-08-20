import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const dbUrl = Deno.env.get("DB_URL");
  const dbKey = Deno.env.get("DB_SERVICE_KEY");

  const result: any = {
    env: { hasDbUrl: !!dbUrl, hasDbKey: !!dbKey, dbUrlPrefix: dbUrl ? dbUrl.substring(0, 40) : null },
    raw_query: {},
    filtered_query: {},
    schema_check: {}
  };

  if (!dbUrl || !dbKey) {
    return new Response(JSON.stringify({ error: "Missing DB_URL or DB_SERVICE_KEY in Edge Secrets", result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(dbUrl, dbKey);

  // 1. Raw query (no filters) to see if we can read the table at all
  const raw = await supabase.from("ph_routes").select("*").limit(5);
  result.raw_query = { count: raw.data?.length || 0, error: raw.error?.message || null, sample: raw.data?.[0] || null };

  // 2. Filtered query (is_approved = true) to see if the filter is killing it
  const filtered = await supabase.from("ph_routes").select("route_uuid", { count: 'exact', head: true }).eq("is_approved", true);
  result.filtered_query = { count: filtered.count, error: filtered.error?.message || null };

  // 3. Schema check to see if the 'is_test' column actually exists
  const schemaCheck = await supabase.from("ph_routes").select("is_test").limit(1);
  result.schema_check = { has_is_test_column: !schemaCheck.error?.message?.includes("is_test") };

  return new Response(JSON.stringify(result, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
