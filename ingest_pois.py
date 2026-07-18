import json
import sqlite3
import os

def ingest_pois():
    # Create a dedicated database for locations
    db = sqlite3.connect("para_poi.db")
    cursor = db.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            category TEXT,
            lat REAL,
            lon REAL
        )
    """)
    db.commit()

    data_dir = "./geojson_data"
    # We only want to process the Point data files
    files_to_process = ["POI.geojson", "schools.geojson"]
    
    total_inserted = 0

    for file in files_to_process:
        filepath = os.path.join(data_dir, file)
        if not os.path.exists(filepath):
            print(f"⚠️ {file} not found, skipping.")
            continue
            
        print(f"📖 Reading {file}...")
        with open(filepath, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)
            
        batch = []
        # STRICT RULE: No variable shadowing
        for feature in geojson_data.get("features", []):
            geom = feature.get("geometry", {})
            
            # We only care about Points
            if geom.get("type") != "Point":
                continue
                
            coords = geom.get("coordinates", [])
            if len(coords) < 2:
                continue
                
            lon, lat = coords[0], coords[1]
            
            # Filter: Only keep locations within the Philippines bounding box
            if not (4.0 <= lat <= 21.0 and 116.0 <= lon <= 127.0):
                continue

            props = feature.get("properties", {})
            # Extract name depending on the file format
            name = props.get("Name") or props.get("SchoolName") or props.get("name")
            category = props.get("Category") or "school"
            
            if name:
                batch.append((name, category, lat, lon))
                
        # Bulk insert for speed
        cursor.executemany("INSERT INTO locations (name, category, lat, lon) VALUES (?, ?, ?, ?)", batch)
        db.commit()
        total_inserted += len(batch)
        print(f"✅ Inserted {len(batch)} locations from {file}")

    print(f"\n🎉 Done! Total locations in database: {total_inserted}")
    db.close()

if __name__ == "__main__":
    ingest_pois()