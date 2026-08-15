"""
fare_routes.py — Self-reported fare and transit data endpoints.
"""

from typing import Any, Dict
from fastapi import APIRouter, Query
from database import supabase, fetch_all

router = APIRouter()


@router.post("/fare/report")
async def report_fare(data: Dict[str, Any]):
    """Submit a self-reported fare for a route/mode."""
    try:
        fare = {
            "user_email": data.get("user_email", "anonymous"),
            "route_name": data.get("route_name", ""),
            "mode": data.get("mode", "jeepney"),
            "fare_amount": data.get("fare_amount", 0),
            "city": data.get("city", "Metro Manila"),
            "region": data.get("region", "NCR"),
            "tnvs_provider": data.get("tnvs_provider"),
            "surge_multiplier": data.get("surge_multiplier", 1),
            "is_surge": data.get("is_surge", False),
            "reported_at": data.get("reported_at") or "now()",
        }
        
        if not fare["fare_amount"] or fare["fare_amount"] <= 0:
            return {"status": "error", "message": "Fare amount required"}
        
        res = supabase.table("fare_reports").insert(fare).execute()
        if res.data:
            return {"status": "success", "fare_id": res.data[0].get("id")}
        return {"status": "error", "message": "Failed to save"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/fare/reports")
async def get_fare_reports(city: str = Query(""), mode: str = Query(""), limit: int = 100):
    """Get fare reports filtered by city/mode."""
    try:
        query = supabase.table("fare_reports").select("*").order("-created_at").limit(limit)
        if city:
            query = query.eq("city", city)
        if mode:
            query = query.eq("mode", mode)
        res = query.execute()
        return {"reports": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        return {"reports": [], "total": 0, "error": str(e)}


@router.get("/fare/stats")
async def get_fare_stats(city: str = Query(""), mode: str = Query("")):
    """Get average fare by city and mode."""
    try:
        query = supabase.table("fare_reports").select("*").eq("is_surge", False)
        if city:
            query = query.eq("city", city)
        if mode:
            query = query.eq("mode", mode)
        res = query.execute()
        reports = res.data or []
        if not reports:
            return {"average_fare": 0, "sample_size": 0}
        
        avg = sum(r.get("fare_amount", 0) for r in reports) / len(reports)
        return {
            "average_fare": round(avg, 2),
            "sample_size": len(reports),
            "min_fare": min(r.get("fare_amount", 0) for r in reports),
            "max_fare": max(r.get("fare_amount", 0) for r in reports),
        }
    except Exception as e:
        return {"average_fare": 0, "sample_size": 0, "error": str(e)}


@router.get("/cities")
async def get_cities():
    """List cities where we have data."""
    try:
        routes = await fetch_all("ph_routes", select="city")
        cities = set()
        for r in routes:
            city = r.get("city") or "Metro Manila"
            cities.add(city)
        return {"cities": sorted(cities), "total": len(cities)}
    except Exception as e:
        return {"cities": ["Metro Manila"], "total": 1, "error": str(e)}
