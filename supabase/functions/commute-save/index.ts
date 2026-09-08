/**
 * commute-save Edge Function
 * 
 * WHY: Fixed to validate all incoming tracks, prevent duplicates via
 * client_log_id idempotency, and reject phantom trips. Uses
 * SERVICE_ROLE_KEY for writes (bypasses RLS).
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validation constants
const MIN_GPS_POINTS = 5;
const MIN_DURATION_SEC = 60;
const MIN_DISTANCE_M = 50;
const MAX_DISTANCE_M = 100000;
const MAX_SPEED_KMH = 120;

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function validatePayload(data) {
  // Required fields
  if (!data.track_uuid) return { valid: false, reason: 'Missing track_uuid' };
  if (!data.client_log_id) return { valid: false, reason: 'Missing client_log_id' };
  if (!data.install_id) return { valid: false, reason: 'Missing install_id' };

  // GPS points validation
  const gpsPoints = data.gps_track || [];
  if (gpsPoints.length < MIN_GPS_POINTS) {
    return { valid: false, reason: `Insufficient GPS points (${gpsPoints.length}, min ${MIN_GPS_POINTS})` };
  }

  // Duration validation
  const duration = data.total_time_sec || 0;
  if (duration < MIN_DURATION_SEC) {
    return { valid: false, reason: `Duration too short (${duration}s, min ${MIN_DURATION_SEC}s)` };
  }

  // Distance validation
  const distance = data.distance_m || 0;
  if (distance < MIN_DISTANCE_M) {
    return { valid: false, reason: `Distance too short (${distance}m, min ${MIN_DISTANCE_M}m)` };
  }
  if (distance > MAX_DISTANCE_M) {
    return { valid: false, reason: `Distance too long (${distance}m)` };
  }

  // Teleportation check
  for (let i = 1; i < gpsPoints.length; i++) {
    const [prevLat, prevLng] = gpsPoints[i - 1];
    const [currLat, currLng] = gpsPoints[i];
    const dist = haversineDistance(prevLat, prevLng, currLat, currLng);
    const speedKmh = (dist / 1000) / (3 / 3600); // assume 3-second intervals
    if (speedKmh > MAX_SPEED_KMH) {
      return { valid: false, reason: `Teleportation detected at point ${i} (${speedKmh.toFixed(1)} km/h)` };
    }
  }

  return { valid: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const data = await req.json();

    // Validate payload
    const validation = validatePayload(data);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ status: "error", message: validation.reason, code: "VALIDATION_FAILED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency check
    const { data: existingTrack } = await supabase
      .from("ph_user_tracks")
      .select("track_uuid")
      .eq("client_log_id", data.client_log_id)
      .maybeSingle();

    if (existingTrack) {
      return new Response(
        JSON.stringify({ status: "success", message: "Duplicate submission", track_uuid: existingTrack.track_uuid, code: "DUPLICATE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert track
    const insertData = {
      track_uuid: data.track_uuid,
      user_id: data.user_id || null,
      route_uuid: data.route_uuid || null,
      route_name: data.route_name || "Personal Commute",
      total_time_sec: data.total_time_sec || 0,
      distance_m: data.distance_m || 0,
      gps_track: JSON.stringify(data.gps_track || []),
      gps_points: (data.gps_track || []).length,
      raw_payload: JSON.stringify(data.raw_payload || data),
      created_at: new Date().toISOString(),
      user_email: data.user_email || null,
      review_status: 'pending',
      mapped_by: null,
      source: data.source || 'commute_tracker',
      client_log_id: data.client_log_id,
      sync_status: 'synced',
      total_fare: data.total_fare || '0',
      fare_breakdown: JSON.stringify(data.fare_breakdown || []),
      mode: data.mode || 'transit',
      pois: JSON.stringify(data.pois || []),
      is_loop: data.is_loop || false,
      ride_count: data.ride_count || 0,
      city: data.city || 'Metro Manila',
      region: data.region || 'NCR',
      reference_id: data.reference_id || null,
      install_id: data.install_id,
    };

    const res = await supabase.from("ph_user_tracks").insert(insertData).select();

    if (res.error) {
      return new Response(
        JSON.stringify({ status: "error", message: res.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "success", track_uuid: res.data?.[0]?.track_uuid, code: "SUCCESS" }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ status: "error", message: e.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
