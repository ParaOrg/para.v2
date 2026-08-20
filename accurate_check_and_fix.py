#!/usr/bin/env python3
"""Accurately parse routes with correct modes and fix database."""

from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Parse the routes from your message with CORRECT modes
routes_with_modes = [
    # Train routes
    ("MRT3", "Taft Avenue - North Avenue", "train"),
    ("LRT 1", "Baclaran - Roosevelt", "train"),
    ("LRT2", "Recto - Santolan", "train"),
    ("PNR", "Metro Commuter", "train"),
    
    # Bus routes (all the Bus entries)
    ("Bus", "Baclaran - Montalban via EDSA", "bus"),
    ("Bus", "Ayala Quiapo via Kamagong Taft", "bus"),
    ("Bus", "Baclaran SM Fairview via Lagro", "bus"),
    ("Bus", "Sta Maria - Baclaran NLEX EDSA", "bus"),
    ("Bus", "Baclaran Malanday via EDSA", "bus"),
    ("Bus", "Baclaran Navotas via Ayala", "bus"),
    ("Bus", "Baclaran Monumento via EDSA", "bus"),
    ("Bus", "Pandacan Sta Cruz via Quiapo", "bus"),
    ("Bus", "Grotto - NAIA via EDSA, Fairview", "bus"),
    ("Bus", "Ayala Novaliches via EDSA Buendia", "bus"),
    ("Bus", "Baclaran Malabon (Letre) via EDSA", "bus"),
    ("Bus", "Monumento Philcite via Ayala EDSA", "bus"),
    ("Bus", "FTI - Navotas Terminal via EDSA", "bus"),
    ("Bus", "Alabang Malabon (Letre) via EDSA", "bus"),
    ("Bus", "Ayala Malanday via EDSA", "bus"),
    ("Bus", "Malanday Sucat via EDSA", "bus"),
    ("Bus", "Moonwalk - Plaza Lawton", "bus"),
    ("Bus", "Alabang (Starmall) Lagro", "bus"),
    ("Bus", "Alabang - Plaza Lawton", "bus"),
    ("Bus", "Ayala Malabon via EDSA", "bus"),
    ("Bus", "FTI-Monumento via EDSA", "bus"),
    ("Bus", "Lagro - NAIA via Fairview", "bus"),
    ("Bus", "Alabang Monumento via EDSA", "bus"),
    ("Bus", "Ayala UE Caloocan via EDSA", "bus"),
    ("Bus", "Alabang Lawton via Sucat", "bus"),
    ("Bus", "Ayala Monumento via EDSA", "bus"),
    ("Bus", "Domestic Grotto via EDSA", "bus"),
    ("Bus", "Monumento Sucat via EDSA", "bus"),
    ("Bus", "Ayala NAIA", "bus"),
    ("Bus", "Alabang Navotas", "bus"),
    ("Bus", "Pandacan Quiapo", "bus"),
    ("Bus", "Leveriza Monumento", "bus"),
    ("Bus", "Taguig City Navotas", "bus"),
    ("Bus", "Ayala Lagro via EDSA", "bus"),
    ("Bus", "Ayala Grotto via EDSA", "bus"),
    ("Bus", "Alabang Fairview", "bus"),
    ("Bus", "Alabang Malanday", "bus"),
    ("Bus", "Ayala Balintawak", "bus"),
    ("Bus", "NAIA SM Fairview", "bus"),
    ("Bus", "San Mateo - Baclaran via EDSA, Ayala, Commonwealth Ave", "bus"),
    ("Bus", "Dasmarinas - Plaza Lawton via E. Aguinaldo Highway, Roxas Blvd", "bus"),
    ("Bus", "Eastwood Libis - Marriot Terminal via Acropolis", "bus"),
    ("Bus", "FTI - Tungko, SJDM via Lagro, C'wealth Ave", "bus"),
    ("Bus", "Norgry / Spalay-NAIA / BacIrn Via Comm Fairv Ed", "bus"),
    ("Bus", "Taguig - SM Fairview via Lagro Ayala Buendia EDSA", "bus"),
    ("Bus", "Baclaran-Malanday via EDSA, McArthur, Ayala", "bus"),
    ("Bus", "Norzagaray - Baclaran Via Commonwealth Ave", "bus"),
    ("Bus", "Pacita Complex (SP, Lag) - Letre via EDSA", "bus"),
    ("Bus", "Sapang Palay - Sta. Cruz via Marilao Exit", "bus"),
    ("Bus", "Alabang Muntinlupa-Lawton via SSH Taft Ave", "bus"),
    ("Bus", "Alabang-SM Fairview via Lagro Commonwealth", "bus"),
    ("Bus", "Sapang Palay - Sta Cruz (DJose) Sta Maria NE", "bus"),
    ("Bus", "Grotto - Baclaran via Commonwealth Ave, Ayala", "bus"),
    ("Bus", "Grotto - NAIA via EDSA, Ayala, Buendia Extn", "bus"),
    ("Bus", "Bagong Silang - NAIA via Maligaya Park, EDSA", "bus"),
    ("Bus", "Malanday MIA via Pasay Rtda MOA Coastal Road", "bus"),
    ("Bus", "Malanday Term - NAIA Via EDSA, Buendia, Ayala", "bus"),
    ("Bus", "Asturias-Ayala via Buendia Ave, Taft Ave", "bus"),
    ("Bus", "Ayala Ave-Ft Boni StaffHouse via Mckinly", "bus"),
    ("Bus", "Ayala Dasmarinas (Cavite) via Coastal Rd", "bus"),
    ("Bus", "Baclaran-Navotas Terminal via Edsa Ayala", "bus"),
    ("Bus", "Baclaran - SM Fairview via Lagro, Ayala", "bus"),
    ("Bus", "Baclaran-BgSilang via Edsa Commonwealth", "bus"),
    ("Bus", "Novaliches Pacita San Pedro via Malinta", "bus"),
    ("Bus", "Alabang-Novaliches via EDSA, MindanaoAve", "bus"),
    ("Bus", "Baclaran-Novaliches via EDSA Mindanao Ave", "bus"),
    ("Bus", "Baclaran-Nvaliches via EDSA Mind AveAyala", "bus"),
    ("Bus", "Malanday - Muntinlupa via Edsa, Monumento", "bus"),
    ("Bus", "Novaliches Baclaran via EDSA Mindanao Ave", "bus"),
    ("Bus", "Pandacan (Beata) - Quiapo via C. Palanca", "bus"),
    ("Bus", "Baclaran - SM Fairview via Lagro C'wealth", "bus"),
    ("Bus", "Baclaran SJDM via Commonwealth EDSA", "bus"),
    ("Bus", "Baclaran-SM Fairview via Quezon Ave", "bus"),
    ("Bus", "SM Fairview Ayala Leveriza via EDSA", "bus"),
    ("Bus", "Alabang Lawton via Zapote Coastal Rd", "bus"),
    ("Bus", "Baclaran-Navotas Terminal via EDSA", "bus"),
    ("Bus", "Monumento NAIA via EDSA Coastal Rd", "bus"),
    ("Bus", "Alabang - Navotas Terminal via EDSA", "bus"),
    ("Bus", "Alabang - Novaliches via EDSA, NLEX", "bus"),
    ("Bus", "Pacita Complex - SM Fairview via EDSA", "bus"),
    ("Bus", "Baclaran - Grotto via Commonwealth Ave", "bus"),
    ("Bus", "Pacita Complex - Navotas Term via EDSA", "bus"),
    ("Bus", "Baclaran - Minuyan via Commonwealth Ave", "bus"),
    ("Bus", "Baclaran Novaliches via EDSA Quirino", "bus"),
    ("Bus", "Baclaran-Malanday via Edsa, McArthur", "bus"),
    ("Bus", "EDSA Carousel", "bus"),
    
    # BGC Bus
    ("BGC Bus", "EDSA Ayala - Market! Market!", "bgc_bus"),
    ("BGC Bus", "EDSA Ayala - RCBC - Net One - Fort Victoria", "bgc_bus"),
    ("BGC Bus", "EDSA Ayala - Fort Victoria", "bgc_bus"),
    ("BGC Bus", "EDSA Ayala - BGC Turf - EDSA Ayala", "bgc_bus"),
    ("BGC Bus", "EDSA Ayala - Bonifacio - Crescent Park West", "bgc_bus"),
    
    # P2P
    ("P2P", "Vista Mall Daang Hari Bacoor - San Lorenzo Place", "p2p"),
    ("P2P", "Vista Mall Taguig - Trasierra Makati", "p2p"),
    ("P2P", "Starmall Alabang - Robinsons Galleria - Starmall Shaw", "p2p"),
    ("P2P", "PITX - Makati", "p2p"),
    ("P2P", "Sucat Interchange - Glorietta 3", "p2p"),
    ("P2P", "Vista Mall Daang Hari - Trasierra", "p2p"),
    ("P2P", "Robinsons Place Dasma - Trasierra", "p2p"),
    ("P2P", "Robinsons Place Malolos - Trinoma", "p2p"),
    ("P2P", "Robinsons Place Antipolo - Robinsons Galleria", "p2p"),
    ("P2P", "Santa Maria Bulacan to Trinoma", "p2p"),
    ("P2P", "Robinsons Tagapo - NAIA Terminals (1, 2, 3 & 4)", "p2p"),
    ("P2P", "SM Megamall - SM North - Trinoma - Park Square", "p2p"),
    ("P2P", "SM City Masinag - Greenbelt 5", "p2p"),
    ("P2P", "Robinsons Novaliches - Glorietta 3", "p2p"),
    ("P2P", "Noveleta Cavite - Makati Trasierra", "p2p"),
    ("P2P", "Robinsons Galleria - Glorietta 3", "p2p"),
    ("P2P", "Ayala Malls South Park - Greenbelt 5", "p2p"),
    ("P2P", "Southmall Las Pinas - Makati Circuit Lane", "p2p"),
    ("P2P", "Alabang Town Center - NAIA Terminals 1, 2, 3, 4", "p2p"),
    ("P2P", "Robinsons Galleria - Clark International Airport", "p2p"),
    ("P2P", "Robinsons Cainta - Trasierra Makati", "p2p"),
    ("P2P", "Robinsons Galleria - NAIA Terminal", "p2p"),
    ("P2P", "NAIA Terminal 3 - Clark International Airport", "p2p"),
    ("P2P", "NAIA Terminal Select Stops (Loop)", "p2p"),
    ("P2P", "Nuvali Transport Terminal - Makati Circuit Lane", "p2p"),
    ("P2P", "Alabang Town Center - Ayala Malls The 30th", "p2p"),
    ("P2P", "Eastwood - Makati CBD", "p2p"),
    ("P2P", "Alabang Town Center - Century City Mall", "p2p"),
    ("P2P", "Alabang Town Center - Greenbelt 1", "p2p"),
    ("P2P", "Araneta Center - NAIA", "p2p"),
    ("P2P", "Alabang Town Center - Lawton", "p2p"),
    ("P2P", "Camella Dasmarinas Highway - Starmall Alabang", "p2p"),
    ("P2P", "Camella Dasma Highway - San Lorenzo Place", "p2p"),
    ("P2P", "Clark International Airport - North Avenue", "p2p"),
    ("P2P", "Quezon City - Trinoma", "p2p"),
    ("P2P", "Starmall Alabang - NAIA Terminals 1 2 3 4", "p2p"),
    ("P2P", "UP Town Center - Glorietta 3", "p2p"),
    ("P2P", "Vista Mall Taguig - Starmall EDSA Shaw", "p2p"),
    
    # UV Express
    ("UV", "LAGRO - QUIAPO VIA SAUYO", "uv_express"),
    ("UV", "FTI - WALTERMART (PASONG TAMO MAKATI)", "uv_express"),
    ("UV", "EVER GOTESCO - SM NORTH/C.I.T. V. QUEZON A", "uv_express"),
    ("UV", "DEPARO - CUBAO", "uv_express"),
    ("UV", "BRGY FORTUNE (MARIKINA CITY) - CUBAO", "uv_express"),
    ("UV", "DEPARO - FAIRVIEW (ROBINSON)", "uv_express"),
    ("UV", "BF RESORT VILL - AYALA CENTER VIA COASTAL", "uv_express"),
    ("UV", "COASTAL MALL - SENATE OF PHILIPPINES", "uv_express"),
    ("UV", "BETTERLIVING (PARANAQUE) - ORTIGAS CENTER", "uv_express"),
    ("UV", "ALABANG - LAWTON VIA SM MALL OF ASIA", "uv_express"),
    ("UV", "AYALA - G. TUAZON", "uv_express"),
    ("UV", "AYALA CENTER - SUKI MARKET (MAYON)", "uv_express"),
    ("UV", "PASIG - QUIAPO", "uv_express"),
    ("UV", "BF RESORT VILL - AYALA CENTER VIA SKYWAY", "uv_express"),
    ("UV", "ANTIPOLO - AYALA", "uv_express"),
    ("UV", "BF PARANAQUE - AYALA CENTER", "uv_express"),
    ("UV", "SUCAT - QUIAPO", "uv_express"),
    ("UV", "ALABANG - BACLARAN", "uv_express"),
    ("UV", "5TH AVE/LRT - SM CENTER POINT", "uv_express"),
    ("UV", "DEPARO - CENTRAL INTEGRATED TERMINAL", "uv_express"),
    ("UV", "ANTIPOLO - SM Megamall", "uv_express"),
    ("UV", "PASIG - EDSA CENTRAL", "uv_express"),
    ("UV", "PASIG - AYALA CENTER", "uv_express"),
    ("UV", "NOVALICHES - TRINOMA", "uv_express"),
    ("UV", "SM FAIRVIEW - VITO CRUZ", "uv_express"),
    ("UV", "BAGUMBONG - BLUMENTRITT", "uv_express"),
    ("UV", "SM SOUTH MALL - QUIAPO", "uv_express"),
    ("UV", "BICUTAN - QUIAPO", "uv_express"),
    ("UV", "ALMAR SUBD - TM KALAW VIA COMMONWEALTH", "uv_express"),
    ("UV", "ALMANZA - AYALA CENTER VIA SLEX SKYWAY", "uv_express"),
    ("UV", "SUCAT - LAWTON", "uv_express"),
    ("UV", "PASIG - GREENHILLS", "uv_express"),
    ("UV", "ALMAR SUBD - TM KALAW VIA QUEZON AVENUE", "uv_express"),
    ("UV", "BAGONG SILANG - CUBAO", "uv_express"),
    ("UV", "CONCEPCION - AYALA", "uv_express"),
    ("UV", "TECHNOHUB (UP AYALA LAND) - BUENDIA", "uv_express"),
    ("UV", "NOVALICHES - CENTRAL INTEGRATED TERMINAL", "uv_express"),
    ("UV", "FTI - AYALA CENTER", "uv_express"),
    ("UV", "ROBINSON'S PLACE (NOVALICHES) - BUENDIA", "uv_express"),
    ("UV", "PASIG SAN JOAQUIN - ROBINSON'S GALLERIA", "uv_express"),
    ("UV", "MARIKINA - GREENHILLS SHOPPING CENTER V. SSS", "uv_express"),
    ("UV", "MARIKINA - CUBAO", "uv_express"),
    ("UV", "GREENHILLS SHOPPING CENTER - SM MEGAMALL", "uv_express"),
    ("UV", "FTI - QUIAPO", "uv_express"),
    ("UV", "G. TUAZON - AYALA (SAMPALOC)", "uv_express"),
    ("UV", "MINDANAO AVENUE - SM NORTH", "uv_express"),
    ("UV", "CONCEPCION - SM MEGA MALL", "uv_express"),
    ("UV", "LAGRO - TM KALAW", "uv_express"),
    ("UV", "DEPARO - BLUMENTRITT", "uv_express"),
    ("UV", "MARIKINA - MEGAMALL", "uv_express"),
    ("UV", "ROBINSONS (NOVALICHES) - VITO CRUZ", "uv_express"),
    ("UV", "MARKET MARKET - SM MOA V. MACAPAGAL BVLD", "uv_express"),
    ("UV", "FAIRVIEW - BUENDIA", "uv_express"),
    ("UV", "MARIMART - SM NORTH", "uv_express"),
    ("UV", "NOVALICHES - MRT NORTH EDSA(CIT)", "uv_express"),
    ("UV", "FESTIVAL MALL - AYALA CENTER", "uv_express"),
    ("UV", "DEPARO - SM NORTH/C.I.T.", "uv_express"),
    ("UV", "SUCAT (PQUE) - LAWTON/PARK&RIDE", "uv_express"),
    ("UV", "FESTIVAL MALL (ALABANG) - LAND MARK MAKATI", "uv_express"),
    ("UV", "BAGONG SILANG - SM NORTH/C.I.T.", "uv_express"),
    ("UV", "NOVALICHES (BAYAN) - SM NORTH", "uv_express"),
    ("UV", "MARIKINA - ORTIGAS", "uv_express"),
    ("UV", "FESTIVAL MALL - SM ASIA INTERMODAL TERM", "uv_express"),
    ("UV", "FESTIVAL MALL - PARK N RIDE (LAWTON)", "uv_express"),
    ("UV", "MARIKINA HEIGHTS - AYALA", "uv_express"),
]

def check_and_fix():
    print("🔍 Checking all routes with correct modes...\n")
    
    issues = 0
    fixed = 0
    missing = 0
    
    for prefix, route_name, expected_mode in routes_with_modes:
        # Check if route exists
        res = supabase.table("ph_route_reference").select("id, mode").eq("route_name", route_name).limit(1).execute()
        
        if not res.data:
            # Route is missing
            missing += 1
            print(f"  ❌ MISSING: {route_name} (should be {expected_mode})")
            
            # Insert it
            parts = route_name.split(" - ")
            origin = parts[0].strip() if parts else None
            destination = parts[-1].strip() if len(parts) > 1 else None
            if destination and " via " in destination:
                destination = destination.split(" via ")[0].strip()
            
            try:
                insert_res = supabase.table("ph_route_reference").insert({
                    "route_name": route_name,
                    "origin": origin,
                    "destination": destination,
                    "mode": expected_mode,
                    "source_file": "manual_population.csv",
                }).execute()
                if insert_res.data:
                    print(f"    ✅ Inserted with mode: {expected_mode}")
                    fixed += 1
            except Exception as e:
                print(f"    ⚠️ Insert error: {e}")
        else:
            current_mode = res.data[0]["mode"]
            if current_mode != expected_mode:
                issues += 1
                print(f"  ⚠️ WRONG MODE: {route_name} is '{current_mode}', should be '{expected_mode}'")
                
                # Fix the mode
                supabase.table("ph_route_reference").update({"mode": expected_mode}).eq("id", res.data[0]["id"]).execute()
                print(f"    ✅ Fixed to: {expected_mode}")
                fixed += 1
    
    print(f"\n📊 Results:")
    print(f"   ✅ Fixed: {fixed}")
    print(f"   ⚠️ Issues found: {issues}")
    print(f"   ❌ Missing: {missing}")
    print(f"   📋 Total routes checked: {len(routes_with_modes)}")
    
    # Final counts
    print(f"\n📊 FINAL MODE COUNTS:")
    modes = ['train', 'bus', 'jeepney', 'bgc_bus', 'p2p', 'uv_express']
    for mode in modes:
        count_res = supabase.table("ph_route_reference").select("count", count="exact").eq("mode", mode).limit(0).execute()
        count = count_res.count if hasattr(count_res, 'count') else 0
        print(f"   {mode}: {count}")

if __name__ == "__main__":
    check_and_fix()
