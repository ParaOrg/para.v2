"""gas_routes.py — Gas price endpoints."""

from typing import Any, Dict
from fastapi import APIRouter, Query
from database import supabase, fetch_all

router = APIRouter()

@router.get("/api/v1/gas-prices/stations")
async def get_gas_stations(city: str = Query("")):
    """List gas stations."""
    try:
        query = supabase.table("gas_stations").select("*").eq("is_active", True)
        if city:
            query = query.eq("city", city)
        res = query.execute()
        return {"stations": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        return {"stations": [], "total": 0, "error": str(e)}

@router.get("/api/v1/gas-prices/blended")
async def get_blended_price(city: str = Query("")):
    """Average gas price across all stations."""
    try:
        res = supabase.table("gas_prices").select("*").order("-created_at").limit(200).execute()
        prices = res.data or []
        if not prices:
            return {"blended_price": 0, "currency": "PHP", "sample_size": 0}
        avg = sum(p.get("price", 0) for p in prices) / len(prices)
        return {"blended_price": round(avg, 2), "currency": "PHP", "sample_size": len(prices)}
    except Exception as e:
        return {"blended_price": 0, "sample_size": 0, "error": str(e)}

@router.post("/api/v1/gas-prices/stations/{station_id}/submit")
async def submit_price(station_id: str, data: Dict[str, Any]):
    """Submit a gas price for a station."""
    try:
        price = {
            "station_id": station_id,
            "fuel_type": data.get("fuel_type", "diesel"),
            "price": data.get("price", 0),
            "reported_by": data.get("user_email", "anonymous"),
        }
        res = supabase.table("gas_prices").insert(price).execute()
        return {"status": "success", "price_id": res.data[0].get("id") if res.data else None}
    except Exception as e:
        return {"status": "error", "message": str(e)}
