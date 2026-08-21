#!/usr/bin/env python3
"""Check if any jeepney routes were accidentally deleted."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def check_for_deleted():
    print("🔍 Checking for potentially deleted routes...\n")
    
    # The original 889 routes should all still exist
    # Let's check some known jeepney routes
    test_jeepney_routes = [
        "CUBAO-STOPnSHOP",
        "Camarin-Trinoma",
        "Dian - Libertad",
        "FRISCO-REMEDIOS",
        "Baliwag Malinta",
        "CUBAO - PADILLA",
        "CUBAO DIVISORIA",
        "CUBAO-STA.LUCIA",
        "Libertad-PCampa",
        "MUNOZ-PANTRANCO",
        "Namayan Vergara",
        "PATEROS - AYALA",
        "FTI - Kayaman C",
        "Frisco-Sta Cruz",
        "LIBERTAD - PRC",
        "Lagro SM North",
        "MONUMENTO-PIER",
        "MURPHY - CUBAO",
        "CUBAO - QUIAPO",
        "CUBAO - V CRUZ",
        "CUBAO - V. LUNA",
        "CUBAO-T KALAW",
        "Parang - Recto",
        "SM NORTH LAGRO",
        "Taytay-Rosario",
        "Alabang Almanza",
        "MURPHY - QMART",
        "Montalban Wawa",
        "Monumento Polo",
        "PROJ 2&3-QMART",
        "Lagro Philcoa",
        "Molino-Zapote",
        "Munoz - Luzon",
        "Navotas Recto",
        "Galas-Barbosa",
        "Gate5-Unimart",
        "LAGRO-PHILCOA",
        "LIBERTAD-DIAN",
        "Antipolo-Pasig",
        "Baliwag Bocaue",
        "CAINTA - CUBAO",
        "CUBAO - PARANG",
        "PIER-MALANDAY",
        "RECTO - GASAK",
        "YALE CM RECTO",
        "Angono Rosario",
        "Angono-Pasig",
        "CUBAO TAYTAY",
        "MUNOZ-PROJ8",
        "NOVA-DEPARO",
    ]
    
    found = 0
    missing = []
    
    for route_name in test_jeepney_routes:
        res = supabase.table("ph_route_reference").select("id, mode").eq("route_name", route_name).limit(1).execute()
        if res.data:
            found += 1
            mode = res.data[0].get("mode")
            if mode != "jeepney":
                print(f"  ⚠️ {route_name}: mode is '{mode}' (should be jeepney)")
        else:
            missing.append(route_name)
    
    print(f"\n📊 Results:")
    print(f"  ✅ Found: {found}/{len(test_jeepney_routes)}")
    print(f"  ❌ Missing: {len(missing)}")
    
    if missing:
        print("\n❌ Missing routes:")
        for name in missing:
            print(f"  • {name}")
    
    # Check if the total makes sense
    total = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
    total_count = total.count if hasattr(total, 'count') else 0
    
    print(f"\n📊 Total routes now: {total_count}")
    print(f"   Original: 889")
    print(f"   Added: 26")
    print(f"   Expected: 915")
    print(f"   Actual: {total_count}")
    
    if total_count < 889:
        print(f"\n🚨 ALERT: {889 - total_count} routes appear to be MISSING!")
    elif total_count == 889:
        print(f"\n⚠️ No new routes were added - the 26 'new' routes were already in the 889")
    elif total_count == 915:
        print(f"\n✅ All routes accounted for (889 original + 26 new)")
    else:
        print(f"\n⚠️ Unexpected total: {total_count}")

if __name__ == "__main__":
    check_for_deleted()
