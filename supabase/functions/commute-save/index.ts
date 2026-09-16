/**
 * commute-save Edge Function
 *
 * Validation philosophy (Q3=B — Moderate):
 *   HARD REJECT:  only genuine garbage (missing IDs, teleportation, malformed payload)
 *   SOFT FLAG:    everything else — accept and tag via `quality_reasons`
 *
 * The `compute_track_quality` DB trigger computes the actual score and
 * sets `is_ml_eligible`. This function's job is just to guarantee the
 * row is safe to insert.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hard-reject constants — only for genuine spoofing/garbage
const MAX_SPEED_KMH = 120;         // teleportation
const MAX_DISTANCE_M = 200_000;    // 200km — sanity cap
const MAX_DURATION_SEC = 21_600;   // 6 hours — sanity cap

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hardReject(data) {
  // Identity — required for idempotency
  if (!data.track_uuid) return "Missing track_uuid";
  if (!data.client_log_id) return "Missing client_log_id";
  if (!data.install_id) return "Missing install_id";

  const gpsTrack = Array.isArray(data.gps_track) ? data.gps_track : [];
  const distance = Number(data.distance_m) || 0;
  const duration = Number(data.total_time_sec) || 0;

  // Sanity caps
  if (distance > MAX_DISTANCE_M)
    return `Distance exceeds cap (${distance}m > ${MAX_DISTANCE_M}m)`;
  if (duration > MAX_DURATION_SEC)
    return `Duration exceeds cap (${duration}s > ${MAX_DURATION_SEC}s)`;

  // Teleportation: only if we have enough points to trust the check
  if (gpsTrack.length >= 5) {
    for (let i = 1; i < gpsTrack.length; i++) {
      const [prevLat, prevLng] = gpsTrack[i - 1];
      const [currLat, currLng] = gpsTrack[i];
      const dist = haversineDistance(prevLat, prevLng, currLat, currLng);
      // Assume up to 10s between samples; anything faster than MAX_SPEED_KMH is a glitch
      const speedKmh = (dist / 1000) / (10 / 3600);
      if (speedKmh > MAX_SPEED_KMH) {
        return `Teleportation detected (${speedKmh.toFixed(0)} km/h at point ${i})`;
      }
    }
  }

  return null; // pass
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ status: "error", message: "Method not allowed", code: "METHOD_NOT_ALLOWED" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const data = await req.json();

    const rejectReason = hardReject(data);
    if (rejectReason) {
      return new Response(
        JSON.stringify({
          status: "error",
          message: rejectReason,
          code: "VALIDATION_FAILED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Idempotency
    const { data: existing } = await supabase
      .from("ph_user_tracks")
      .select("track_uuid")
      .eq("client_log_id", data.client_log_id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          status: "success",
          message: "Duplicate submission — already saved",
          track_uuid: existing.track_uuid,
          code: "DUPLICATE",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build insert payload. `install_id` now exists in schema.
    const gpsTrack = Array.isArray(data.gps_track) ? data.gps_track : [];
    const insertData = {
      track_uuid: data.track_uuid,
      user_id: data.user_id || null,
      user_email: data.user_email || null,
      install_id: data.install_id,
      client_log_id: data.client_log_id,
      route_uuid: data.route_uuid || null,
      route_name: data.route_name || "Personal Commute",
      mode: data.mode || "transit",
      total_time_sec: Number(data.total_time_sec) || 0,
      distance_m: Number(data.distance_m) || 0,
      gps_track: gpsTrack,                           // jsonb column — pass array directly
      gps_points: gpsTrack.length,
      raw_payload: data.raw_payload || data,         // jsonb — pass object directly
      total_fare: data.total_fare ?? 0,
      fare_breakdown: data.fare_breakdown || [],
      pois: data.pois || [],
      is_loop: data.is_loop || false,
      ride_count: data.ride_count || 0,
      city: data.city || "Metro Manila",
      region: data.region || "NCR",
      source: data.source || "contribute_button_panel",
      review_status: "pending",
      sync_status: "synced",
      created_at: new Date().toISOString(),
    };

    const res = await supabase.from("ph_user_tracks").insert(insertData).select().single();

    if (res.error) {
      console.error("[commute-save] insert failed:", res.error);
      return new Response(
        JSON.stringify({
          status: "error",
          message: res.error.message,
          code: "DB_INSERT_FAILED",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "success",
        track_uuid: res.data?.track_uuid,
        code: "SUCCESS",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[commute-save] unexpected error:", e);
    return new Response(
      JSON.stringify({ status: "error", message: e.message, code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
