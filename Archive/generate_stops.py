import json
import os
import math

def calculate_distance(lon1, lat1, lon2, lat2):
    """Calculate Haversine distance in kilometers."""
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def generate_dense_stops():
    # Automatically detect the correct filename based on your setup
    filename = "jeep_routes_07162026.geojson" if os.path.exists("jeep_routes_07162026.geojson") else "routes.geojson"
    
    if not os.path.exists(filename):
        print(f"❌ Error: {filename} not found! Please ensure your route data is in the same folder.")
        return

    with open(filename, "r", encoding="utf-8") as f:
        routes_data = json.load(f)

    generated_stops = {"type": "FeatureCollection", "features": []}
    seen_coordinates = set()
    stop_counter = 1
    
    # 🎯 TARGET DENSITY: Place a stop approximately every X meters along the route.
    # 400 meters is the sweet spot: dense enough for "hop on/off anywhere", 
    # but not so dense that it creates thousands of redundant micro-stops.
    DISTANCE_THRESHOLD_KM = 0.4 

    for feature in routes_data.get("features", []):
        geom = feature["geometry"]
        # Fallback to route_name if route_long_name isn't present
        route_name = feature["properties"].get("route_long_name", feature["properties"].get("route_name", "Unknown Route"))
        
        # 1. Flatten coordinates to properly handle both LineString and MultiLineString
        coords_list = []
        if geom["type"] == "MultiLineString":
            for line in geom["coordinates"]:
                coords_list.extend(line)
        else:
            coords_list = geom["coordinates"]
            
        if len(coords_list) < 2:
            continue

        cumulative_distance = 0.0
        last_stop_point = coords_list[0]
        
        # 2. Always guarantee a stop at the Start
        start_point = coords_list[0]
        coord_tuple = (round(start_point[0], 5), round(start_point[1], 5))
        if coord_tuple not in seen_coordinates:
            seen_coordinates.add(coord_tuple)
            generated_stops["features"].append({
                "type": "Feature",
                "properties": {"id": f"STOP_{stop_counter:04d}", "name": f"{route_name} (Start)"},
                "geometry": {"type": "Point", "coordinates": [start_point[0], start_point[1]]}
            })
            stop_counter += 1

        # 3. Walk the route and place stops at regular distance intervals
        for i in range(1, len(coords_list)):
            current_point = coords_list[i]
            dist = calculate_distance(last_stop_point[0], last_stop_point[1], current_point[0], current_point[1])
            cumulative_distance += dist
            
            if cumulative_distance >= DISTANCE_THRESHOLD_KM:
                # Rounding to 5 decimals (~1 meter precision) is the magic trick:
                # If two different routes cross at this exact spot, they will share 
                # the SAME stop ID, creating a natural, free transfer point in the graph!
                coord_tuple = (round(current_point[0], 5), round(current_point[1], 5))
                
                if coord_tuple not in seen_coordinates:
                    seen_coordinates.add(coord_tuple)
                    generated_stops["features"].append({
                        "type": "Feature",
                        "properties": {"id": f"STOP_{stop_counter:04d}", "name": f"{route_name} (Stop)"},
                        "geometry": {"type": "Point", "coordinates": [current_point[0], current_point[1]]}
                    })
                    stop_counter += 1
                
                # Reset distance counter and move the reference point forward
                cumulative_distance = 0.0
                last_stop_point = current_point

        # 4. Always guarantee a stop at the End (if not already added by the loop)
        end_point = coords_list[-1]
        coord_tuple = (round(end_point[0], 5), round(end_point[1], 5))
        if coord_tuple not in seen_coordinates:
            seen_coordinates.add(coord_tuple)
            generated_stops["features"].append({
                "type": "Feature",
                "properties": {"id": f"STOP_{stop_counter:04d}", "name": f"{route_name} (End)"},
                "geometry": {"type": "Point", "coordinates": [end_point[0], end_point[1]]}
            })
            stop_counter += 1

    # Save the generated stops
    with open("stops.geojson", "w", encoding="utf-8") as f:
        json.dump(generated_stops, f, indent=2)
        
    print(f"✅ Success! Generated {stop_counter - 1} dense stops (approx. every {DISTANCE_THRESHOLD_KM*1000:.0f}m).")
    print("💡 CRITICAL NEXT STEP: Restart your FastAPI backend (main.py) now so it loads this new, highly-connected stops.geojson!")

if __name__ == "__main__":
    generate_dense_stops()