import json

def prepare_jeep_routes(input_file: str, output_file: str):
    with open(input_file, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)

    for feature in geojson_data.get("features", []):
        props = feature.setdefault("properties", {})
        props["type"] = "jeep"
        props["mode"] = "jeep"
        
        # TEMP FIX: Default to True to ensure routes connect. 
        # We will refine one-way logic after we confirm the base graph works.
        props["bidirectional"] = True 

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_data, f, indent=2)
    print(f"✅ Processed {len(geojson_data['features'])} routes. Saved to {output_file}")

if __name__ == "__main__":
    prepare_jeep_routes("routes.geojson", "routes_processed.geojson")