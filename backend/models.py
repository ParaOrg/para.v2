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
    direction: Optional[str] = None  # Compass direction of travel, e.g. "N", "SE"

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


# ==========================================
# GAS PRICES
# ==========================================
GAS_BRANDS = {"shell", "seaoil", "caltex", "ptt", "cleanfuel", "total", "petron"}
GAS_FUEL_TYPES = {"ron91", "ron95", "ron97", "xcs", "diesel", "diesel_premium", "kerosene"}


class AddStationRequest(BaseModel):
    brand: str
    name: str
    address: str = ""
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class SubmitPriceReportRequest(BaseModel):
    fuel_type: str
    price: float = Field(ge=30, le=200)  # sanity bounds -- matches the frontend's own input min/max

class ChatResponse(BaseModel):
    reply_text: str
    route_data: Optional[RouteResponse] = None
    alternatives: Optional[List[RouteResponse]] = [] # NEW: For Yen's Algorithm
    origin: str = ""       # NEW: For the frontend feedback system
    destination: str = ""  # NEW: For the frontend feedback system