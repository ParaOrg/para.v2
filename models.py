"""
models.py - Pydantic models for API
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

# ============ CHAT MODELS ============
class ChatMessage(BaseModel):
    """Chat message from user"""
    user_id: Optional[str] = "guest"
    message: str
    session_id: Optional[str] = None
    timestamp: Optional[datetime] = None

class ChatResponse(BaseModel):
    """Chat response from system"""
    reply_text: str
    route_data: Optional[Dict] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    alternatives: Optional[List[Dict]] = None
    task_id: Optional[str] = None
    status: str = "completed"

# ============ ROUTE MODELS ============
class RouteRequest(BaseModel):
    """Route calculation request"""
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    user_id: Optional[str] = "guest"
    mode: Optional[str] = "transit"

class RouteStep(BaseModel):
    """Single step in a route"""
    action: str
    vehicle_type: str
    route_name: str
    from_node: str
    to_node: str
    distance_m: float
    duration_min: float
    fare: float
    geometry: List[List[float]]

class RouteResponse(BaseModel):
    """Route calculation response"""
    success: bool
    total_distance_m: float
    total_duration_min: float
    total_fare: float
    steps: List[RouteStep]
    path_nodes: List[str]
    message: str
    alternatives: Optional[List[Dict]] = None

# ============ FEEDBACK MODELS ============
class FeedbackRequest(BaseModel):
    """User feedback on a route"""
    user_id: str
    route_id: str
    rating: int
    comment: Optional[str] = None
    route_nodes: Optional[List[str]] = None
    origin_name: Optional[str] = None
    destination_name: Optional[str] = None
    total_fare: Optional[float] = None
    total_time: Optional[float] = None
    timestamp: Optional[datetime] = None

# ============ TELEMETRY MODELS ============
class TelemetryPing(BaseModel):
    """GPS ping from device"""
    device_id: str
    lat: float
    lng: float
    speed_kmh: Optional[float] = 0
    heading: Optional[float] = 0
    trip_id: Optional[str] = None
    timestamp: Optional[datetime] = None

class TelemetryBatch(BaseModel):
    """Batch of GPS pings"""
    pings: List[TelemetryPing]
    device_id: Optional[str] = None

class SimulateRequest(BaseModel):
    """Simulate telemetry data"""
    route_name: str
    count: int = 10

# ============ TASK MODELS ============
class TaskStatusResponse(BaseModel):
    """Task status response for async operations"""
    task_id: str
    status: str
    progress: Optional[int] = 0
    result: Optional[Dict] = None
    error: Optional[str] = None
    completed_at: Optional[str] = None

# ============ GEOCODING MODELS ============
class GeoRequest(BaseModel):
    """Geocoding request"""
    location: str
    user_id: Optional[str] = "guest"
    bounds: Optional[Dict] = None

class GeoResponse(BaseModel):
    """Geocoding response"""
    found: bool
    lat: Optional[float] = None
    lon: Optional[float] = None
    display_name: Optional[str] = None
    source: Optional[str] = None
    confidence: Optional[float] = 0

# ============ ADMIN MODELS ============
class RouteMetadata(BaseModel):
    """Route metadata for admin"""
    name: str
    mode: str
    type: str
    oneway: bool
    bidirectional: bool
    file: str
    source: str
    edge_count: int = 0

class RouteListResponse(BaseModel):
    """List of routes for admin"""
    routes: List[RouteMetadata]
    total: int