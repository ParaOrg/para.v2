"""
v1_routes.py — Public API endpoints missing from the legacy routes.
Adds: /routes/public*, /community/*, /api/v1/gas-prices*, /api/v1/waitlist, /articles/*, /admin/commute/logs
"""

import json
import re
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from database import supabase, fetch_all

router = APIRouter()


# ── Helpers ─────────────────────────────────────────────

def _row_to_route_dict(row: dict) -> dict:
    """Convert a ph_routes row to the shape the frontend expects."""
    return {
        "route_uuid": str(row.get("route_uuid", "")),
        "name": row.get("name", ""),
        "mode": row.get("mode", ""),
        "is_loop": row.get("is_loop", False),
        "is_bidirectional": row.get("is_bidirectional", False),
        "is_oneway": row.get("is_oneway", False),
        "is_approved": row.get("is_approved", False),
        "is_test": row.get("is_test", False),
        "status": row.get("status", "pending"),
        "ride_count": row.get("ride_count", 0) or 0,
        "created_at": str(row.get("created_at", "")),
    }


@router.get("/stops")
async def get_transit_stops(vehicle_type: str = Query(""), route_name: str = Query("")):
    """Get transit stops from database."""
    try:
        query = supabase.table("transit_stops").select("*")
        if vehicle_type:
            query = query.eq("vehicle_type", vehicle_type)
        if route_name:
            query = query.eq("route_name", route_name)
        res = query.execute()
        stops = [r["name"] for r in (res.data or [])]
        return {"stops": stops, "total": len(stops)}
    except Exception as e:
        return {"stops": [], "total": 0, "error": str(e)}


# ── /routes/public ──────────────────────────────────────

@router.get("/routes/public")
async def list_public_routes():
    """List approved non-test public routes."""
    try:
        rows = await fetch_all("ph_routes", eq={"is_approved": True}, order="name")
        routes = []
        for r in rows:
            name = (r.get("name") or "").strip()
            if r.get("is_test") or r.get("status") == "test":
                continue
            if name.lower() in ("test route", "test", "demo", "dummy", "staging"):
                continue
            routes.append(_row_to_route_dict(r))
        return {"routes": routes, "total": len(routes)}
    except Exception as e:
        return {"routes": [], "total": 0, "error": str(e)}


@router.get("/routes/public/reference")
async def list_public_reference_routes():
    """List all reference routes from ph_route_reference table."""
    try:
        rows = await fetch_all("ph_route_reference", order="route_name")
        unique = []
        seen = set()
        for r in rows:
            name = (r.get("route_name") or r.get("name") or "").strip()
            if name and name.lower() not in seen:
                seen.add(name.lower())
                unique.append({
                    "route_name": name,
                    "mode": r.get("mode", ""),
                    "reference_id": str(r.get("id", r.get("reference_id", ""))),
                })
        return {"routes": unique, "total": len(unique)}
    except Exception as e:
        return {"routes": [], "total": 0, "error": str(e)}
    except Exception as e:
        return {"routes": [], "total": 0, "error": str(e)}


@router.get("/routes/public/geojson")
async def get_public_route_geojson(route_id: str = Query(..., description="Route UUID")):
    """Get a public route's geometry as GeoJSON."""
    try:
        route_res = supabase.table("ph_routes").select("*").eq("route_uuid", route_id).limit(1).execute()
        if not route_res.data:
            raise HTTPException(404, f"Route not found: {route_id}")
        route = route_res.data[0]

        shape_res = supabase.table("ph_route_shapes").select("geom_geojson").eq("route_uuid", route_id).limit(1).execute()
        if not shape_res.data or not shape_res.data[0].get("geom_geojson"):
            raise HTTPException(404, f"No geometry for route: {route_id}")

        geometry = shape_res.data[0]["geom_geojson"]
        if isinstance(geometry, str):
            geometry = json.loads(geometry)

        return {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "properties": {
                    "name": route.get("name"),
                    "mode": route.get("mode"),
                    "is_loop": route.get("is_loop", False),
                    "is_bidirectional": route.get("is_bidirectional", False),
                    "is_oneway": route.get("is_oneway", False),
                },
                "geometry": geometry,
            }],
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"type": "FeatureCollection", "features": [], "error": str(e)}


# ── /community ─────────────────────────────────────────

@router.get("/community/threads")
async def get_community_threads():
    try:
        rows = await fetch_all("community_threads", order="created_at", desc=True)
        return {"threads": rows or [], "total": len(rows or [])}
    except Exception:
        return {"threads": [], "total": 0}


@router.post("/community/threads")
async def create_community_thread(data: Dict[str, Any]):
    try:
        thread = {
            "title": data.get("title", "").strip(),
            "content": data.get("content", "").strip(),
            "tag": data.get("tag", "Routes"),
            "user_email": data.get("user_email", "anonymous"),
            "author_name": data.get("author_name", data.get("handle", "Anonymous")),
            "created_at": "now()",
        }
        if not thread["title"]:
            return {"status": "error", "message": "Title is required"}
        res = supabase.table("community_threads").insert(thread).execute()
        return {"status": "success", "thread": res.data[0] if res.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/community/threads/delete")
async def delete_community_thread(data: Dict[str, Any]):
    try:
        thread_uuid = data.get("thread_uuid", "")
        if not thread_uuid:
            return {"status": "error", "message": "thread_uuid required"}
        supabase.table("community_threads").delete().eq("thread_uuid", thread_uuid).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/community/comments")
async def get_community_comments(thread_uuid: str = Query("")):
    try:
        query = supabase.table("community_comments").select("*").order("created_at")
        if thread_uuid:
            query = query.eq("thread_uuid", thread_uuid)
        res = query.execute()
        return {"comments": res.data or [], "total": len(res.data or [])}
    except Exception:
        return {"comments": [], "total": 0}


@router.post("/community/comments")
async def create_community_comment(data: Dict[str, Any]):
    try:
        comment = {
            "thread_uuid": data.get("thread_uuid", ""),
            "content": data.get("content", "").strip(),
            "author_name": data.get("author_name", data.get("user_email", "Anonymous")),
            "created_at": "now()",
        }
        if not comment["thread_uuid"] or not comment["content"]:
            return {"status": "error", "message": "thread_uuid and content required"}
        res = supabase.table("community_comments").insert(comment).execute()
        return {"status": "success", "comment": res.data[0] if res.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/community/route-edits")
async def get_route_edits(route_uuid: str = Query("")):
    try:
        query = supabase.table("community_route_edits").select("*").order("created_at", desc=True)
        if route_uuid:
            query = query.eq("route_uuid", route_uuid)
        res = query.execute()
        return {"edits": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        return {"edits": [], "total": 0, "error": str(e)}


@router.post("/community/route-edits")
async def create_route_edit(data: Dict[str, Any]):
    try:
        edit = {
            "route_uuid": data.get("route_uuid", ""),
            "edit_type": data.get("edit_type", "modify"),
            "description": data.get("description", ""),
            "new_geometry": data.get("new_geometry"),
            "author_name": data.get("author_name", data.get("user_email", "Anonymous")),
            "created_at": "now()",
        }
        res = supabase.table("community_route_edits").insert(edit).execute()
        return {"status": "success", "edit": res.data[0] if res.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/community/route-edits/vote")
async def vote_route_edit(data: Dict[str, Any]):
    try:
        vote = {
            "edit_id": data.get("edit_id", ""),
            "vote": data.get("vote", 0),
            "voter_email": data.get("voter_email", data.get("user_email", "anonymous")),
            "created_at": "now()",
        }
        supabase.table("community_route_edit_votes").insert(vote).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── /api/v1/gas-prices ─────────────────────────────────

@router.get("/api/v1/gas-prices/blended")
async def get_blended_gas_price():
    try:
        res = supabase.table("gas_prices").select("*").order("created_at", desc=True).limit(50).execute()
        prices = res.data or []
        if not prices:
            return {"blended_price": 0, "currency": "PHP", "sample_size": 0}
        avg = sum(p.get("price", 0) for p in prices) / len(prices)
        return {"blended_price": round(avg, 2), "currency": "PHP", "sample_size": len(prices)}
    except Exception as e:
        return {"blended_price": 0, "currency": "PHP", "sample_size": 0, "error": str(e)}


@router.get("/api/v1/gas-prices/stations")
async def get_gas_stations():
    try:
        res = supabase.table("gas_stations").select("*").eq("is_active", True).execute()
        stations = res.data or []
        return {"stations": stations, "total": len(stations)}
    except Exception as e:
        return {"stations": [], "total": 0, "error": str(e)}


@router.post("/api/v1/gas-prices/stations/{station_id}/submit")
async def submit_gas_price(station_id: str, data: Dict[str, Any]):
    try:
        price = {
            "station_id": station_id,
            "price": data.get("price", 0),
            "fuel_type": data.get("fuel_type", "diesel"),
            "reported_by": data.get("user_email", "anonymous"),
            "created_at": "now()",
        }
        supabase.table("gas_prices").insert(price).execute()
        return {"status": "success"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── /api/v1/waitlist ───────────────────────────────────

@router.post("/api/v1/waitlist")
async def join_waitlist(data: Dict[str, Any]):
    try:
        email = data.get("email", "").strip().lower()
        name = data.get("name", "").strip()
        if not email:
            return {"status": "error", "message": "Email is required"}
        existing = supabase.table("waitlist").select("*").eq("email", email).execute()
        if existing.data:
            return {"status": "error", "message": "This email is already on the waitlist.", "error": "DUPLICATE_EMAIL"}
        res = supabase.table("waitlist").insert({"email": email, "name": name, "listed_at": "now()"}).execute()
        if res.data:
            return {"status": "success", "message": "You have been added to the waitlist!"}
        return {"status": "error", "message": "Failed to save"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── /contact ───────────────────────────────────────────

@router.post("/contact")
async def submit_contact(data: Dict[str, Any]):
    try:
        message = {
            "name": data.get("name", "").strip(),
            "email": data.get("email", "").strip().lower(),
            "message": data.get("message", "").strip(),
            "created_at": "now()",
        }
        if not message["name"] or not message["email"] or not message["message"]:
            return {"status": "error", "message": "All fields are required"}
        supabase.table("contact_messages").insert(message).execute()
        return {"status": "success", "message": "Thanks for reaching out! We'll get back to you soon."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── /articles/{slug} ───────────────────────────────────

@router.get("/articles/{slug}")
async def get_article(slug: str):
    try:
        res = supabase.table("articles").select("*").eq("slug", slug).limit(1).execute()
        if res.data:
            return {"content": res.data[0].get("content", ""), "slug": slug, "title": res.data[0].get("title", slug)}
        return {"content": "", "slug": slug, "error": "Article not found"}
    except Exception as e:
        return {"content": "", "slug": slug, "error": str(e)}


# ── /admin/commute/logs ────────────────────────────────

@router.get("/admin/commute/logs")
async def get_admin_commute_logs(user_email: str = Query("")):
    try:
        query = supabase.table("ph_user_tracks").select("*").order("created_at", desc=True).limit(100)
        if user_email:
            query = query.eq("user_id", user_email)
        res = query.execute()
        return {"logs": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        return {"logs": [], "total": 0, "error": str(e)}
