-- ============================================================
-- Admin Approval Flow — Promotes pending contributions to ph_routes
-- ============================================================
--
-- FLOW:
--   1. User records a new route via /contribute-v2 "Add Route"
--   2. Client generates a UUID (route_uuid) upfront
--   3. Client POSTs to commute-save with:
--        source = 'add_route_flow'
--        review_status = 'pending'
--        route_uuid = <the generated UUID>
--   4. Row lands in ph_user_tracks with raw_payload.flow = 'route_documentation'
--   5. Admin approves via the SQL below
--   6. ph_routes gets a new row using the SAME route_uuid
--
-- The UUID is preserved across both tables, so any cached client state,
-- shared links, or future references stay valid.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- STEP 1: List pending route-documentation contributions
-- ────────────────────────────────────────────────────────────
SELECT
  track_uuid,
  route_uuid,
  route_name,
  mode,
  total_time_sec,
  distance_m,
  gps_points,
  total_fare,
  user_email,
  created_at,
  jsonb_array_length(raw_payload->'segments') AS seg_count
FROM ph_user_tracks
WHERE source = 'add_route_flow'
  AND review_status = 'pending'
ORDER BY created_at DESC;


-- ────────────────────────────────────────────────────────────
-- STEP 2: Promote one contribution to ph_routes
-- Replace <CONTRIBUTION_TRACK_UUID> with the value from step 1.
-- ────────────────────────────────────────────────────────────
INSERT INTO ph_routes (
  route_uuid,
  name,
  mode,
  is_approved,
  is_loop,
  is_bidirectional,
  is_oneway,
  status,
  source_file,
  submitted_by,
  verification_status,
  verified_by,
  verified_at,
  data_source,
  origin_lat,
  origin_lng,
  dest_lat,
  dest_lng,
  ride_count,
  city,
  region
)
SELECT
  t.route_uuid,
  t.route_name,
  t.mode,
  true,                          -- is_approved
  false,                         -- is_loop (extend later from raw geometry)
  true,                          -- is_bidirectional
  false,                         -- is_oneway
  'active',                      -- status
  'admin_approval',              -- source_file
  t.user_email,                  -- submitted_by
  'verified',                    -- verification_status
  current_user::text,            -- verified_by (admin account)
  now(),                         -- verified_at
  'community',                   -- data_source
  (t.raw_payload->'segments'->0->'gps_points'->0->>0)::float,
  (t.raw_payload->'segments'->0->'gps_points'->0->>1)::float,
  (t.raw_payload->'segments'->0->'gps_points'->-1->>0)::float,
  (t.raw_payload->'segments'->0->'gps_points'->-1->>1)::float,
  1,                             -- ride_count
  t.city,
  t.region
FROM ph_user_tracks t
WHERE t.track_uuid = '<CONTRIBUTION_TRACK_UUID>'
  AND t.source = 'add_route_flow'
  AND t.review_status = 'pending'
ON CONFLICT (route_uuid) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- STEP 3: Insert the recorded geometry into ph_route_shapes
-- (This is what makes the route drawable on the map.)
-- ────────────────────────────────────────────────────────────
INSERT INTO ph_route_shapes (
  route_uuid,
  geom_geojson,
  created_at
)
SELECT
  t.route_uuid,
  jsonb_build_object(
    'type', 'LineString',
    'coordinates', (
      SELECT jsonb_agg(
        jsonb_build_array(
          (pt->>1)::float,      -- lng first
          (pt->>0)::float       -- lat
        )
      )
      FROM jsonb_array_elements(t.raw_payload->'segments'->0->'gps_points') AS pt
    )
  ),
  now()
FROM ph_user_tracks t
WHERE t.track_uuid = '<CONTRIBUTION_TRACK_UUID>';


-- ────────────────────────────────────────────────────────────
-- STEP 4: Mark the contribution as approved
-- ────────────────────────────────────────────────────────────
UPDATE ph_user_tracks
SET review_status = 'approved'
WHERE track_uuid = '<CONTRIBUTION_TRACK_UUID>';


-- ────────────────────────────────────────────────────────────
-- REJECTION FLOW (alternative to Step 2-4)
-- ────────────────────────────────────────────────────────────
-- If the contribution is bad (spoofed GPS, duplicate name, etc.):
--
-- UPDATE ph_user_tracks
-- SET review_status = 'rejected'
-- WHERE track_uuid = '<CONTRIBUTION_TRACK_UUID>';
--
-- The orphaned route_uuid is harmless — it never reaches ph_routes.
