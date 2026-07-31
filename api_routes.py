"""
api_routes.py - Main API endpoints
"""

from fastapi import APIRouter, Request
import json
import uuid
import networkx as nx
import numpy as np
from typing import Optional, Dict, List, Any

from graph_engine import haversine, SPEED_WALK_KMH, find_route
from llm_engine import parse_chat_intent, normalize_location
from models import ChatMessage, ChatResponse, RouteRequest, RouteResponse, RouteStep

router = APIRouter()

@router.post("/chat")
async def chat(request: ChatMessage, req: Request):
    try:
        G = req.app.state.G
        
        intent = parse_chat_intent(request.message)
        
        # Handle casual interactions
        if intent.get('intent') == 'greeting':
            return ChatResponse(reply_text="Kumusta! 👋 Ako si Para PH, ang iyong commuting assistant.\n\nSabihin mo lang kung saan ka galing at papunta:\n• from UPD to UST\n• from Cubao to Makati\n• from Ateneo to DLSU\n\nAno ang maitutulong ko sa'yo ngayon?")
        
        if intent.get('intent') == 'help':
            return ChatResponse(reply_text="🚐 Heto ang mga kaya kong gawin:\n\n1. **Humanap ng ruta** - Sabihin mo lang: 'from [pinanggalingan] to [pupuntahan]'\n2. Kilalanin ang mga lugar - Alam ko ang mga universities, malls, stations, at landmarks sa Metro Manila\n3. Magbigay ng oras at pamasahe - Kasama ang estimated travel time at fare\n\nSubukan mo: 'from UPD to UST' o 'from Cubao to Makati'")
        
        if intent.get('intent') == 'about':
            return ChatResponse(reply_text="🚐 Ako si Para PH - ang iyong multi-modal commuting assistant para sa Metro Manila!\n\nAlam ko ang mga ruta ng jeep, bus, LRT, MRT, at UV Express. Ginagamit ko ang Dijkstra algorithm para mahanap ang pinakamabilis na ruta para sa'yo.\n\nGawa ako ng ParaOrg, isang grupo ng mga estudyante na gustong mapabuti ang commuting experience sa Pilipinas. 🇵🇭")
        
        if intent.get('intent') == 'unknown':
            return ChatResponse(reply_text="""🚐 Para PH - Ang iyong commuting assistant!

Pwede mong gawin ang mga sumusunod:

1. 🔍 Maghanap ng ruta - I-type: 'from UPD to UST' o 'from Cubao to Makati'
2. 🚀 Simulan ang commute - After maghanap ng ruta, pindutin ang 'Start Tracked Commute' para i-track ang byahe mo
3. 📤 Mag-upload ng bagong ruta - Pumunta sa Upload tab para magdagdag ng jeep/bus route
4. 💬 Magtanong - I-type ang 'help' para sa tulong

Ano ang gusto mong gawin ngayon?""")
        
        origin_raw = intent.get('origin', '')
        dest_raw = intent.get('destination', '')
        
        if not origin_raw or not dest_raw:
            return ChatResponse(reply_text="Please specify both origin and destination. Example: 'from UPD to UST'")
        
        origin_geo = normalize_location(origin_raw)
        dest_geo = normalize_location(dest_raw)
        
        if not origin_geo or not dest_geo:
            return ChatResponse(
                reply_text=f"Could not find one or both locations.\nOrigin: {origin_raw}\nDestination: {dest_raw}"
            )
        
        route = find_route(
            G,
            origin_geo['lat'], origin_geo['lon'],
            dest_geo['lat'], dest_geo['lon']
        )
        
        if not route:
            return ChatResponse(
                reply_text=f"Walang nakitang ruta from '{origin_raw}' to '{dest_raw}'."
            )
        
        # Format clean response
        reply_lines = [f"📍 {origin_raw} ➡️ {dest_raw}"]
        reply_lines.append(f"✅ {route['message']}")
        reply_lines.append("")
        
        # Add segments (merged)
# In the chat endpoint, filter out tiny segments
        for seg in route.get('segments', []):
            if seg.get('is_transfer'):
                time_min = seg.get('time_min', 0)
                if time_min > 0.5:  # Only show walks > 30 seconds
                    reply_lines.append(f"  🚶 Walk {time_min:.0f} min")
            else:
                route_name = seg.get('route', '')
                # Skip virtual routes and empty names
                if route_name in ['WALK_TO_ROUTE', 'WALK_TO_DEST', 'WALK_TRANSFER', '']:
                    continue
                time_min = seg.get('time_min', 0)
                fare = seg.get('fare', 0)
                # Only show segments with meaningful time or distance
                if time_min > 0.5 or seg.get('distance_m', 0) > 100:
                    reply_lines.append(f"  🚌 {route_name} ({time_min:.0f} min, ₱{fare:.0f})")
        
        # If no segments shown, show at least something
        if len(reply_lines) <= 3:
            reply_lines.append("  Route found but no segments to display")
        
        return ChatResponse(
            reply_text="\n".join(reply_lines),
            route_data=route,
            origin=origin_raw,
            destination=dest_raw
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ChatResponse(reply_text=f"Error: {str(e)}")

@router.post("/route", response_model=RouteResponse)
async def calculate_route(request: RouteRequest, req: Request):
    """Calculate route between two points"""
    G = req.app.state.G
    
    route = find_route(
        G,
        request.origin_lat, request.origin_lng,
        request.dest_lat, request.dest_lng
    )
    
    if not route:
        return RouteResponse(
            success=False,
            total_distance_m=0,
            total_duration_min=0,
            total_fare=0,
            steps=[],
            path_nodes=[],
            message="No route found"
        )
    
    steps = []
    # In api_routes.py, update the display format:
    for seg in route.get('segments', []):
        if seg.get('is_transfer'):
            time_min = seg.get('time_min', 0)
            if time_min > 0.5:  # Only show walks > 30 seconds
                reply_lines.append(f"  🚶 Walk {time_min:.0f} min")
            # Skip tiny walks
        else:
            route_name = seg.get('route', '')
            # Clean up route name
            route_name = route_name.replace('WALK_TO_ROUTE', '').replace('WALK_TO_DEST', '')
            if not route_name:
                continue
            time_min = seg.get('time_min', 0)
            fare = seg.get('fare', 0)
            reply_lines.append(f"  🚌 {route_name} ({time_min:.0f} min, ₱{fare:.0f})")
    
    return RouteResponse(
        success=True,
        total_distance_m=route.get('total_distance_m', 0),
        total_duration_min=route.get('total_time_min', 0),
        total_fare=route.get('total_fare', 0),
        steps=steps,
        path_nodes=route.get('path', []),
        message=route.get('message', 'Route found')
    )