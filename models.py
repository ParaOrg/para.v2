from pydantic import BaseModel
from typing import List

class RouteRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float

class RouteStep(BaseModel):
    route_name: str
    mode: str
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    distance_km: float
    time_mins: float
    fare: float
    polyline: List[List[float]]

class RouteResponse(BaseModel):
    total_fare: float
    total_time_mins: float
    total_distance_km: float
    steps: List[RouteStep]
    
class FeedbackRequest(BaseModel):
    start_lat: float
    start_lng: float
    end_lat: float
    end_lng: float
    suggested_steps: str
    estimated_time: float
    estimated_fare: float
    is_approved: bool