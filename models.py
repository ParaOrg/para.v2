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
    action: str  # "walk", "board", "alight", "transfer"
    vehicle_type: Optional[str] = None
    route_name: Optional[str] = None
    from_node: str
    to_node: str
    distance_m: float
    duration_min: float
    fare: float = 0.0
    geometry: List[List[float]]  # [[lng, lat], ...]

class RouteResponse(BaseModel):
    success: bool
    total_distance_m: float
    total_duration_min: float
    total_fare: float
    steps: List[RouteStep]
    message: str = "Route found."

class ChatMessage(BaseModel):
    user_id: str
    message: str

class ChatResponse(BaseModel):
    reply_text: str
    route_data: Optional[RouteResponse] = None

class FeedbackRequest(BaseModel):
    user_id: str
    route_id: str
    rating: int  # 1 (thumbs down) to 5 (thumbs up)
    comment: Optional[str] = ""