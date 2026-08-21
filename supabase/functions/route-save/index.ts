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

    const body = await req.json();
    const {
      route_name,
      mode = 'jeepney',
      is_loop = false,
      is_bidirectional = false,
      path_coordinates, // Array of [lat, lng]
      submitted_by,
      region = 'ncr',
    } = body;

    if (!route_name || !path_coordinates || path_coordinates.length < 2) {
      return new Response(
        JSON.stringify({ error: "Missing route_name or path_coordinates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert path coordinates to PostGIS LineString
    const lineString = path_coordinates
      .map(([lat, lng]: [number, number]) => `${lng} ${lat}`)
      .join(',');

    // Insert into ph_routes
    const { data: routeData, error: routeError } = await supabase
      .from("ph_routes")
      .insert({
        name: route_name,
        mode,
        is_loop,
        is_bidirectional,
        is_approved: false,
        status: 'pending',
        submitted_by,
        region,
      })
      .select()
      .single();

    if (routeError) {
      return new Response(
        JSON.stringify({ error: routeError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert shape into ph_route_shapes if table exists
    const { error: shapeError } = await supabase
      .from("ph_route_shapes")
      .insert({
        route_uuid: routeData.route_uuid,
        shape_geometry: `LINESTRING(${lineString})`,
        region,
      });

    if (shapeError) {
      console.warn("Failed to insert shape:", shapeError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        route_uuid: routeData.route_uuid,
        message: "Route saved for review" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
