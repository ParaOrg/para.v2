#!/usr/bin/env python3
"""Create train stops reference data."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Train stations data
train_stations = {
    "MRT3": [
        "North Avenue", "Quezon Avenue", "GMA-Kamuning", "Araneta Center-Cubao",
        "Santolan-Annapolis", "Ortigas", "Shaw Boulevard", "Boni",
        "Guadalupe", "Buendia", "Ayala", "Magallanes",
        "Taft Avenue"
    ],
    "LRT1": [
        "Roosevelt", "Balintawak", "Monumento", "5th Avenue",
        "R. Papa", "Abad Santos", "Blumentritt", "Tayuman",
        "Bambang", "Doroteo Jose", "Carriedo", "Central Terminal",
        "United Nations", "Pedro Gil", "Quirino", "Vito Cruz",
        "Gil Puyat", "Libertad", "EDSA", "Baclaran"
    ],
    "LRT2": [
        "Santolan", "Katipunan", "Anonas", "Araneta Center-Cubao",
        "Betty Go-Belmonte", "Gilmore", "J. Ruiz", "V. Mapa",
        "Pureza", "Legarda", "Recto"
    ],
    "PNR": [
        "Tutuban", "Blumentritt", "Laon Laan", "España",
        "Santa Mesa", "Pandacan", "Paco", "San Andres",
        "Vito Cruz", "Buendia", "Pasay Road", "EDSA",
        "Nichols", "FTI", "Bicutan", "Sucat",
        "Alabang", "Muntinlupa", "San Pedro", "Pacita",
        "Biñan", "Santa Rosa", "Cabuyao", "Mamatid",
        "Calamba"
    ],
}

def insert_train_stops():
    print("🚆 Creating train stops...\n")
    
    inserted = 0
    skipped = 0
    
    for line, stations in train_stations.items():
        for i, station in enumerate(stations):
            route_name = f"{line} {station}"
            
            # Check if already exists
            check = supabase.table("transit_stops").select("id").eq("route_name", line).eq("name", station).limit(1).execute()
            
            if check.data:
                skipped += 1
                continue
            
            # Insert stop
            try:
                supabase.table("transit_stops").insert({
                    "name": station,
                    "vehicle_type": "train",
                    "route_name": line,
                    "stop_sequence": i + 1,
                }).execute()
                inserted += 1
            except Exception as e:
                print(f"   ⚠️ Error inserting {station}: {e}")
    
    print(f"\n📊 Inserted: {inserted}, Skipped: {skipped}")
    
    # Verify
    print("\n📊 Train stops by line:")
    for line in train_stations:
        res = supabase.table("transit_stops").select("name").eq("route_name", line).order("stop_sequence").execute()
        if res.data:
            print(f"   {line}: {len(res.data)} stops")
        else:
            print(f"   {line}: 0 stops")

if __name__ == "__main__":
    insert_train_stops()
