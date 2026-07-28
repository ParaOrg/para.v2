from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class RouteRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    dest_lat: float
    dest_lng: float
    modes: Optional[List[str]] = Field(default_factory=lambda: ["jeepney", "lrt", "mrt", "bus", "uv_express", "walk"])

class RouteStep(BaseModel):
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
    success: bool
    total_distance_m: float
    total_duration_min: float
    total_fare: float
    steps: List[RouteStep]
    message: str
    path_nodes: Optional[List[str]] = None  # NEW: To save the exact path for ML

class ChatMessage(BaseModel):
    user_id: str
    message: str

class ChatResponse(BaseModel):
    reply_text: str
    route_data: Optional[RouteResponse] = None
    alternatives: Optional[List[RouteResponse]] = []
    origin: str = ""       # NEW: For frontend feedback
    destination: str = ""  # NEW: For frontend feedback

class FeedbackRequest(BaseModel):
    user_id: str
    route_id: str
    rating: int
    comment: str = ""
    origin_name: str = ""          # NEW: For ML learning
    destination_name: str = ""     # NEW: For ML learning
    route_nodes: List[str] = []    # NEW: For ML learning
    total_fare: float = 0.0        # NEW: For ML learning
    total_time: float = 0.0        # NEW: For ML learning

class ChatResponse(BaseModel):
    reply_text: str
    route_data: Optional[RouteResponse] = None
    alternatives: Optional[List[RouteResponse]] = [] # NEW: For Yen's Algorithm
    origin: str = ""       # NEW: For the frontend feedback system
    destination: str = ""  # NEW: For the frontend feedback system

# ==========================================
# NEW: TELEMETRY MODELS
# ==========================================
class TelemetryPing(BaseModel):
    device_id: str
    lat: float
    lng: float
    speed_kmh: float = 0.0
    heading: float = 0.0
    trip_id: Optional[str] = None

class TelemetryBatch(BaseModel):
    pings: List[TelemetryPing]

class TrafficSegmentResponse(BaseModel):
    route_name: str
    from_node: str
    to_node: str
    congestion_factor: float
    observed_speed_kmh: Optional[float] = None
    color: str = "#22c55e"

class SimulateRequest(BaseModel):
    route_name: Optional[str] = None
    count: int = 1