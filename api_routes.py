"""
api_routes.py — Core chat and routing endpoints.
"""

import traceback
from fastapi import Request, APIRouter
from database import supabase


from functools import lru_cache
import hashlib
import json
import time

# Simple in-memory route cache
_route_cache = {}
_cache_hits = 0
_cache_misses = 0

def get_cached_route(origin_lat, origin_lng, dest_lat, dest_lng):
    key = f"{round(origin_lat,4)},{round(origin_lng,4)}->{round(dest_lat,4)},{round(dest_lng,4)}"
    if key in _route_cache:
        global _cache_hits
        _cache_hits += 1
        return _route_cache[key]
    global _cache_misses
    _cache_misses += 1
    return None

def set_cached_route(origin_lat, origin_lng, dest_lat, dest_lng, route):
    key = f"{round(origin_lat,4)},{round(origin_lng,4)}->{round(dest_lat,4)},{round(dest_lng,4)}"
    _route_cache[key] = route
    # Keep cache under 1000 entries
    if len(_route_cache) > 1000:
        oldest = next(iter(_route_cache))
        del _route_cache[oldest]

from graph_engine import find_route, find_k_routes, get_walking_path, haversine
from llm_engine import parse_chat_intent, normalize_location
from models import ChatMessage, ChatResponse, RouteRequest, RouteResponse, RouteStep
from biyahe_score import compute_biyahe_score, rank_routes, get_profile

router = APIRouter()


# ── Helpers ────────────────────────────────────────────

def _format_segments(route: dict) -> list[str]:
    """Format route segments into human-readable lines for chat replies."""
    lines = []
    for seg in route.get("segments", []):
        if seg.get("is_transfer"):
            time_min = seg.get("time_min", 0)
            if time_min > 0.5:
                lines.append(f"  🚶 Walk {time_min:.0f} min")
        else:
            route_name = seg.get("route", "")
            if route_name in ("WALK_TO_ROUTE", "WALK_TO_DEST", "WALK_TRANSFER", ""):
                continue
            time_min = seg.get("time_min", 0)
            fare = seg.get("fare", 0)
            if time_min > 0.5 or seg.get("distance_m", 0) > 100:
                lines.append(f"  🚌 {route_name} ({time_min:.0f} min, ₱{fare:.0f})")
    return lines


def _build_chat_reply(origin_raw: str, dest_raw: str, route: dict) -> str:
    """Build a complete chat reply string from a route result."""
    lines = [f"📍 {origin_raw} ➡️ {dest_raw}"]
    lines.append(f"✅ {route['message']}")
    lines.append("")
    lines.extend(_format_segments(route))
    return "\n".join(lines)






# ── POI ────────────────────────────────────────────────

@router.get("/poi/list")
async def list_pois():
    """List all points of interest."""
    try:
        res = supabase.table("ph_places").select("*").eq("is_active", True).order("canonical_name").execute()
        pois = res.data or []
        for p in pois:
            loc = p.get("location")
            if loc and isinstance(loc, str) and "POINT" in loc:
                parts = loc.replace("POINT(", "").replace(")", "").split()
                if len(parts) == 2:
                    p["lng"] = float(parts[0])
                    p["lat"] = float(parts[1])
        return {"pois": pois, "total": len(pois)}
    except Exception as e:
        return {"pois": [], "total": 0, "error": str(e)}


@router.post("/poi/add")
async def add_poi(request: Request):
    data = await request.json()
    """Add a new point of interest."""
    try:
        lat = data.get("lat")
        lng = data.get("lng")
        name = data.get("canonical_name", "").strip()
        category = data.get("category", "landmark")
        if not name or lat is None or lng is None:
            return {"status": "error", "message": "Name, lat, and lng are required"}
        supabase.table("ph_places").insert({
            "canonical_name": name,
            "category": category,
            "location": f"POINT({lng} {lat})",
            "is_active": True,
        }).execute()
        return {"status": "success", "message": f"Added {name}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}



# ── Route Reports ──────────────────────────────────────

@router.post("/routes/report")
async def report_route(request: Request):
    data = await request.json()
    """Report an issue with a route."""
    try:
        report = {
            "route_uuid": data.get("route_uuid", ""),
            "route_name": data.get("route_name", ""),
            "reason": data.get("reason", ""),
            "reported_by": data.get("user_email", "anonymous"),
            "created_at": "now()"
        }
        # Store in a reports table or update route status
        supabase.table("ph_routes").update({
            "reviewer_note": f"Reported: {data.get('reason', 'Issue')} by {data.get('user_email', 'anonymous')}"
        }).eq("route_uuid", data.get("route_uuid", "")).execute()
        
        return {"status": "success", "message": "Report submitted. Thank you!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── Feedback Loop ──────────────────────────────────────

@router.get("/user/submissions")
async def get_user_submissions(user_email: str = None):
    """Get all submissions by a user with their approval status."""
    try:
        if not user_email:
            return {"submissions": [], "message": "Email required"}
        
        res = supabase.table("ph_routes").select("*").eq("submitted_by", user_email).order("created_at", desc=True).execute()
        subs = res.data or []
        
        approved = [s for s in subs if s.get("is_approved")]
        pending = [s for s in subs if not s.get("is_approved") and s.get("status") != "rejected"]
        rejected = [s for s in subs if s.get("status") == "rejected"]
        
        return {
            "submissions": subs,
            "total": len(subs),
            "approved": len(approved),
            "pending": len(pending),
            "rejected": len(rejected),
            "message": f"You have {len(approved)} approved, {len(pending)} pending, {len(rejected)} rejected routes."
        }
    except Exception as e:
        return {"submissions": [], "error": str(e)}

# ── Commute Tracking ──────────────────────────────────

@router.post("/commute/save")
async def save_commute(request: Request):
    data = await request.json()
    """Save a completed tracked commute with GPS data, ratings, and timings."""
    try:
        user_id = data.get("user_id", "anonymous")
        route_data = data.get("routeData", {})
        
        # Build the track record
        track = {
            "user_id": data.get("user_email") or user_id,
            "route_uuid": data.get("route_uuid"),
            "route_name": route_data.get("message", "Unknown Route"),
            "total_time_sec": data.get("totalTimeSec", 0),
            "distance_m": data.get("totalDistanceM", 0),
            "gps_points": len(data.get("gpsPoints", [])),
            "gps_track": data.get("gpsPoints"),
            "raw_payload": data,
        }
        
        res = supabase.table("ph_user_tracks").insert(track).execute()
        if res.data:
            return {"status": "success", "track_uuid": res.data[0].get("track_uuid")}
        return {"status": "error", "message": "Failed to save"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/commute/rate")
async def rate_commute(request: Request):
    data = await request.json()
    """Save a rating for a completed commute."""
    try:
        rating_data = {
            "user_id": data.get("user_email", "anonymous"),
            "route_id": data.get("route_uuid", ""),
            "rating": data.get("rating", 0),
            "comment": data.get("comment", ""),
            "total_fare": data.get("total_fare"),
            "total_time": data.get("total_time"),
            "route_nodes": data.get("route_nodes", []),
        }
        # Store rating as part of the track update
        if data.get("track_uuid"):
            supabase.table("ph_user_tracks").update({
                "rating": data.get("rating"),
            }).eq("track_uuid", data["track_uuid"]).execute()
        
        return {"status": "success", "message": "Rating saved"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/commute/logs")
async def get_commute_logs(user_email: str = None):
    """Get commute logs, optionally filtered by user."""
    try:
        query = supabase.table("ph_user_tracks").select("*").order("created_at", desc=True).limit(50)
        if user_email:
            query = query.eq("user_id", user_email)
        res = query.execute()
        return {"logs": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        return {"logs": [], "error": str(e)}


# ── GPS Telemetry ─────────────────────────────────────

@router.post("/telemetry/ping")
async def save_telemetry_ping(request: Request):
    data = await request.json()
    """Save a single GPS ping during active commute."""
    try:
        ping = {
            "device_id": data.get("device_id", "web"),
            "lat": data.get("lat"),
            "lng": data.get("lng"),
            "speed_kmh": data.get("speed", 0),
            "heading": data.get("heading", 0),
            "trip_id": data.get("trip_id", ""),
        }
        # Store in telemetry table or as part of user_tracks
        return {"status": "received"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/telemetry/batch")
async def save_telemetry_batch(request: Request):
    data = await request.json()
    """Save a batch of GPS pings."""
    try:
        pings = data.get("pings", [])
        device_id = data.get("device_id", "web")
        trip_id = data.get("trip_id", "")
        
        for ping in pings:
            ping["device_id"] = device_id
            ping["trip_id"] = trip_id
        
        return {"status": "received", "count": len(pings)}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ── Endpoints ──────────────────────────────────────────



# ── Auth ───────────────────────────────────────────────

@router.post("/auth/signup")
async def signup(request: Request):
    """Sign up / login via waitlist."""
    try:
        data = await request.json()
        email = data.get("email", "").strip().lower()
        name = data.get("name", data.get("displayName", email.split("@")[0] if "@" in email else "Commuter"))
        if not email:
            return {"status": "error", "message": "Email is required"}
        
        # Check if already in waitlist
        existing = supabase.table("waitlist").select("*").eq("email", email).execute()
        if existing.data:
            return {"status": "exists", "message": "Welcome back!", "user": existing.data[0]}
        
        # New signup — add to waitlist
        res = supabase.table("waitlist").insert({"email": email, "name": name, "listed_at": "now()"}).execute()
        if res.data:
            return {"status": "success", "message": "Welcome to Para PH! You are on the list.", "user": res.data[0]}
        return {"status": "error", "message": "Failed to save"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/auth/waitlist/count")
async def waitlist_count():
    """Total signups."""
    try:
        res = supabase.table("waitlist").select("*", count="exact").execute()
        return {"count": res.count or 0}
    except:
        return {"count": 0}

@router.post("/chat")
async def chat(request: ChatMessage, req: Request):
    """Parse a natural-language message and return a route (or helpful reply)."""
    try:
        G = req.app.state.G
        intent = parse_chat_intent(request.message)

        # Handle non-routing intents
        intent_type = intent.get("intent", "unknown")

        if intent_type == "greeting":
            return ChatResponse(reply_text=(
                "Kumusta! 👋 Ako si Para PH, ang iyong commuting assistant.\n\n"
                "Sabihin mo lang kung saan ka galing at papunta:\n"
                "• from UPD to UST\n"
                "• from Cubao to Makati\n"
                "• from Ateneo to DLSU\n\n"
                "Ano ang maitutulong ko sa'yo ngayon?"
            ))

        if intent_type == "help":
            return ChatResponse(reply_text=(
                "🚐 Heto ang mga kaya kong gawin:\n\n"
                "1. **Humanap ng ruta** — Sabihin mo lang: 'from [pinanggalingan] to [pupuntahan]'\n"
                "2. Kilalanin ang mga lugar — Alam ko ang mga universities, malls, stations, at landmarks sa Metro Manila\n"
                "3. Magbigay ng oras at pamasahe — Kasama ang estimated travel time at fare\n\n"
                "Subukan mo: 'from UPD to UST' o 'from Cubao to Makati'"
            ))

        if intent_type == "about":
            return ChatResponse(reply_text=(
                "🚐 Ako si Para PH — ang iyong multi-modal commuting assistant para sa Metro Manila!\n\n"
                "Alam ko ang mga ruta ng jeep, bus, LRT, MRT, at UV Express. "
                "Ginagamit ko ang Dijkstra algorithm para mahanap ang pinakamabilis na ruta para sa'yo.\n\n"
                "Gawa ako ng ParaOrg, isang grupo ng mga estudyante na gustong mapabuti ang commuting experience sa Pilipinas. 🇵🇭"
            ))

        if intent_type == "unknown":
            return ChatResponse(reply_text=(
                "🚐 Para PH — Ang iyong commuting assistant!\n\n"
                "Pwede mong gawin ang mga sumusunod:\n\n"
                "1. 🔍 Maghanap ng ruta — I-type: 'from UPD to UST' o 'from Cubao to Makati'\n"
                "2. 📤 Mag-upload ng bagong ruta — Pumunta sa Community page\n"
                "3. 💬 Magtanong — I-type ang 'help' para sa tulong\n\n"
                "Ano ang gusto mong gawin ngayon?"
            ))

        # ── Route finding ──
        origin_raw = intent.get("origin", "")
        dest_raw = intent.get("destination", "")

        # If only destination (no origin), try GPS
        if dest_raw and not origin_raw and request.user_location:
            origin_raw = "here"
        
        if not origin_raw or not dest_raw:
            return ChatResponse(reply_text=(
                "Please specify both origin and destination. Example: 'from UPD to UST'"
            ))

        # Handle "here" — use GPS coords if available
        if origin_raw.lower() in ("here", "current location", "my location"):
            user_loc = request.user_location
            if user_loc and user_loc.get("lat"):
                origin_geo = {"lat": user_loc["lat"], "lon": user_loc.get("lng", user_loc.get("lon", 0)), "found": True, "display_name": "Your Location", "source": "gps"}
            else:
                return ChatResponse(reply_text="📍 Please enable GPS to route from your location. Tap ⊕ and allow location access.")
        else:
            origin_geo = await normalize_location(origin_raw)
        
        dest_geo = await normalize_location(dest_raw)

        if not origin_geo or not dest_geo:
            return ChatResponse(reply_text=(
                f"Could not find one or both locations.\n"
                f"Origin: {origin_raw}\n"
                f"Destination: {dest_raw}"
            ))

        # Find K candidate routes and rank by Biyahe Score
        # Check cache first
        cached = get_cached_route(origin_geo["lat"], origin_geo["lon"], dest_geo["lat"], dest_geo["lon"])
        if cached:
            candidates = cached
        else:
            candidates = find_k_routes(
                G,
                origin_geo["lat"], origin_geo["lon"],
                dest_geo["lat"], dest_geo["lon"],
                k=3
            )
            if candidates:
                set_cached_route(origin_geo["lat"], origin_geo["lon"], dest_geo["lat"], dest_geo["lon"], candidates)

        if not candidates:
            return ChatResponse(reply_text=(
                f"Walang nakitang ruta from '{origin_raw}' to '{dest_raw}'."
            ))

        # Score and rank all candidates
        ranked = rank_routes(candidates)
        best_route = ranked[0]

        # Simple reply text - route cards show the details
        reply_text = f"Here are {len(ranked)} routes from {origin_raw} to {dest_raw}." if len(ranked) > 1 else f"Here is the best route from {origin_raw} to {dest_raw}."


        route = best_route

        # Deduplicate alternatives
        ranked_filtered = [a for a in ranked[1:] if [s.get("route","") for s in a.get("segments",[])] != [s.get("route","") for s in best_route.get("segments",[])]]
        
        # Enhance walk segments with actual walking paths
        if route and route.get("segments"):
            for seg in route["segments"]:
                if (seg.get("is_transfer") or seg.get("type") == "walk" or "WALK" in str(seg.get("route", ""))) and seg.get("geometry") and len(seg["geometry"]) >= 2:
                    start = seg["geometry"][0]
                    end = seg["geometry"][-1]
                    # start/end are [lng, lat] from backend
                    walk_path = await get_walking_path(start[1], start[0], end[1], end[0])
                    if walk_path and len(walk_path) > 2:
                        # Convert back to [lng, lat] for consistency
                        seg["geometry"] = [[c[1], c[0]] for c in walk_path]
                        seg["distance_m"] = sum(
                            haversine(walk_path[i][0], walk_path[i][1], walk_path[i+1][0], walk_path[i+1][1])
                            for i in range(len(walk_path)-1)
                        )

        return ChatResponse(
            reply_text=reply_text,
            route_data=route,
            origin=origin_raw,
            destination=dest_raw,
        )

    except Exception:
        traceback.print_exc()
        return ChatResponse(reply_text="Sorry, may naging problema sa paghahanap ng ruta. Please try again.")


@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest, req: Request):
    """Calculate route between two lat/lng points (programmatic endpoint)."""
    G = req.app.state.G

    route = find_route(
        G,
        request.origin_lat, request.origin_lng,
        request.dest_lat, request.dest_lng,
    )

    if not route:
        return RouteResponse(
            success=False,
            total_distance_m=0,
            total_duration_min=0,
            total_fare=0,
            steps=[],
            path_nodes=[],
            message="No route found",
        )

    steps = []
    for seg in route.get("segments", []):
        steps.append(RouteStep(
            from_stop=seg.get("from", ""),
            to_stop=seg.get("to", ""),
            route_name=seg.get("route", ""),
            mode=seg.get("type", ""),
            distance_m=seg.get("distance_m", 0),
            duration_min=seg.get("time_min", 0),
            fare=seg.get("fare", 0),
        ))

    return RouteResponse(
        success=True,
        total_distance_m=route.get("total_distance_m", 0),
        total_duration_min=route.get("total_time_min", 0),
        total_fare=route.get("total_fare", 0),
        steps=steps,
        path_nodes=route.get("path", []),
        message=route.get("message", "Route found"),
    )
# force deploy
