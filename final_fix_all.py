#!/usr/bin/env python3
"""Final fix - insert truly missing routes and fix remaining mode issues."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# The 11 truly missing routes from CSV
missing_routes = [
    ("Ayala Balintawak", "jeepney"),
    ("CUBAO KALAYAAN - SM LAGRO", "jeepney"),
    ("Fort West", "jeepney"),
    ("Guadalupe Pateros", "jeepney"),
    ("Guadalupe-Makati", "jeepney"),
    ("LIBERTAD - PRC", "jeepney"),
    ("MONUMENTO-MUNOZ via BALINTAWAK", "jeepney"),
    ("Malabon - Monumento via Letre", "jeepney"),
    ("PASIG CITY-MARIKINA CITY", "jeepney"),
    ("PIER SOUTH-FAIRVIEW DAHLIA-PHILCOA", "jeepney"),
    ("Pasig-Taytay", "jeepney"),
]

# Bus routes from your message that should be bus but might be jeepney
bus_routes_from_message = [
    "Baclaran - Montalban via EDSA",
    "Ayala Quiapo via Kamagong Taft",
    "Baclaran SM Fairview via Lagro",
    "Sta Maria - Baclaran NLEX EDSA",
    "Baclaran Malanday via EDSA",
    "Baclaran Navotas via Ayala",
    "Baclaran Monumento via EDSA",
    "Pandacan Sta Cruz via Quiapo",
    "Grotto - NAIA via EDSA, Fairview",
    "Ayala Novaliches via EDSA Buendia",
    "Baclaran Malabon (Letre) via EDSA",
    "Monumento Philcite via Ayala EDSA",
    "FTI - Navotas Terminal via EDSA",
    "Alabang Malabon (Letre) via EDSA",
    "Ayala Malanday via EDSA",
    "Malanday Sucat via EDSA",
    "Moonwalk - Plaza Lawton",
    "Alabang (Starmall) Lagro",
    "Alabang - Plaza Lawton",
    "Ayala Malabon via EDSA",
    "FTI-Monumento via EDSA",
    "Lagro - NAIA via Fairview",
    "Alabang Monumento via EDSA",
    "Ayala UE Caloocan via EDSA",
    "Alabang Lawton via Sucat",
    "Ayala Monumento via EDSA",
    "Domestic Grotto via EDSA",
    "Monumento Sucat via EDSA",
    "Ayala NAIA",
    "Alabang Navotas",
    "Pandacan Quiapo",
    "Leveriza Monumento",
    "Taguig City Navotas",
    "Ayala Lagro via EDSA",
    "Ayala Grotto via EDSA",
    "Alabang Fairview",
    "Alabang Malanday",
    "Ayala Balintawak",
    "NAIA SM Fairview",
    "San Mateo - Baclaran via EDSA, Ayala, Commonwealth Ave",
    "Dasmarinas - Plaza Lawton via E. Aguinaldo Highway, Roxas Blvd",
    "Eastwood Libis - Marriot Terminal via Acropolis",
    "FTI - Tungko, SJDM via Lagro, C'wealth Ave",
    "Taguig - SM Fairview via Lagro Ayala Buendia EDSA",
    "Baclaran-Malanday via EDSA, McArthur, Ayala",
    "Norzagaray - Baclaran Via Commonwealth Ave",
    "Pacita Complex (SP, Lag) - Letre via EDSA",
    "Sapang Palay - Sta. Cruz via Marilao Exit",
    "Alabang Muntinlupa-Lawton via SSH Taft Ave",
    "Alabang-SM Fairview via Lagro Commonwealth",
    "Sapang Palay - Sta Cruz (DJose) Sta Maria NE",
    "Grotto - Baclaran via Commonwealth Ave, Ayala",
    "Grotto - NAIA via EDSA, Ayala, Buendia Extn",
    "Bagong Silang - NAIA via Maligaya Park, EDSA",
    "Malanday MIA via Pasay Rtda MOA Coastal Road",
    "Malanday Term - NAIA Via EDSA, Buendia, Ayala",
    "Asturias-Ayala via Buendia Ave, Taft Ave",
    "Ayala Ave-Ft Boni StaffHouse via Mckinly",
    "Ayala Dasmarinas (Cavite) via Coastal Rd",
    "Baclaran-Navotas Terminal via Edsa Ayala",
    "Baclaran - SM Fairview via Lagro, Ayala",
    "Baclaran-BgSilang via Edsa Commonwealth",
    "Novaliches Pacita San Pedro via Malinta",
    "Alabang-Novaliches via EDSA, MindanaoAve",
    "Baclaran-Novaliches via EDSA Mindanao Ave",
    "Baclaran-Nvaliches via EDSA Mind AveAyala",
    "Malanday - Muntinlupa via Edsa, Monumento",
    "Novaliches Baclaran via EDSA Mindanao Ave",
    "Pandacan (Beata) - Quiapo via C. Palanca",
    "Baclaran - SM Fairview via Lagro C'wealth",
    "Baclaran SJDM via Commonwealth EDSA",
    "Baclaran-SM Fairview via Quezon Ave",
    "SM Fairview Ayala Leveriza via EDSA",
    "Alabang Lawton via Zapote Coastal Rd",
    "Baclaran-Navotas Terminal via EDSA",
    "Monumento NAIA via EDSA Coastal Rd",
    "Alabang - Navotas Terminal via EDSA",
    "Alabang - Novaliches via EDSA, NLEX",
    "Pacita Complex - SM Fairview via EDSA",
    "Baclaran - Grotto via Commonwealth Ave",
    "Pacita Complex - Navotas Term via EDSA",
    "Baclaran - Minuyan via Commonwealth Ave",
    "Baclaran Novaliches via EDSA Quirino",
    "Baclaran-Malanday via Edsa, McArthur",
    "EDSA Carousel",
]

def insert_missing():
    print("📥 Inserting 11 truly missing routes...\n")
    inserted = 0
    
    for route_name, mode in missing_routes:
        parts = route_name.split(" - ")
        origin = parts[0].strip() if parts else None
        destination = parts[-1].strip() if len(parts) > 1 else None
        
        # Check if exists
        check = supabase.table("ph_route_reference").select("id").eq("route_name", route_name).limit(1).execute()
        if check.data:
            print(f"   ⏭️ Already exists: {route_name}")
            continue
        
        try:
            res = supabase.table("ph_route_reference").insert({
                "route_name": route_name,
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "source_file": "full_jeepney_routes.csv",
            }).execute()
            if res.data:
                inserted += 1
                print(f"   ✅ {route_name}")
        except Exception as e:
            print(f"   ⚠️ {route_name}: {e}")
    
    print(f"\n   Inserted: {inserted}")

def fix_bus_modes():
    print("\n🚌 Fixing bus modes...\n")
    fixed = 0
    
    for route_name in bus_routes_from_message:
        res = supabase.table("ph_route_reference").select("id, mode").eq("route_name", route_name).limit(1).execute()
        if res.data:
            current_mode = res.data[0]["mode"]
            if current_mode != "bus":
                supabase.table("ph_route_reference").update({"mode": "bus"}).eq("id", res.data[0]["id"]).execute()
                fixed += 1
                print(f"   ✅ {route_name}: {current_mode} → bus")
    
    print(f"\n   Fixed: {fixed}")

def final_counts():
    print("\n📊 FINAL COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    total = 0
    
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        total += count
        print(f"   {mode}: {count}")
    
    print(f"   Total: {total}")

if __name__ == "__main__":
    insert_missing()
    fix_bus_modes()
    final_counts()
