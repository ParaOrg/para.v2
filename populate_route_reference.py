#!/usr/bin/env python3
"""
Populate ph_route_reference table with all routes from the reference CSV data.
Uses Supabase via the existing config.py setup.
"""

import os
import sys
import csv
from pathlib import Path
from supabase import create_client

# Load config
sys.path.insert(0, str(Path(__file__).parent))
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Route data from your message - organized by mode
routes_data = {
    "train": [
        {"route_name": "Taft Avenue - North Avenue", "origin": "Taft Avenue", "destination": "North Avenue"},
        {"route_name": "Baclaran - Roosevelt", "origin": "Baclaran", "destination": "Roosevelt"},
        {"route_name": "Recto - Santolan", "origin": "Recto", "destination": "Santolan"},
        {"route_name": "Metro Commuter", "origin": None, "destination": None},
    ],
    "bus": [
        {"route_name": "Baclaran - Montalban via EDSA", "origin": "Baclaran", "destination": "Montalban"},
        {"route_name": "Ayala Quiapo via Kamagong Taft", "origin": "Ayala", "destination": "Quiapo"},
        {"route_name": "Baclaran SM Fairview via Lagro", "origin": "Baclaran", "destination": "SM Fairview"},
        {"route_name": "Sta Maria - Baclaran NLEX EDSA", "origin": "Sta Maria", "destination": "Baclaran"},
        {"route_name": "Baclaran Malanday via EDSA", "origin": "Baclaran", "destination": "Malanday"},
        {"route_name": "Baclaran Navotas via Ayala", "origin": "Baclaran", "destination": "Navotas"},
        {"route_name": "Baclaran Monumento via EDSA", "origin": "Baclaran", "destination": "Monumento"},
        {"route_name": "Pandacan Sta Cruz via Quiapo", "origin": "Pandacan", "destination": "Sta Cruz"},
        {"route_name": "Grotto - NAIA via EDSA, Fairview", "origin": "Grotto", "destination": "NAIA"},
        {"route_name": "Ayala Novaliches via EDSA Buendia", "origin": "Ayala", "destination": "Novaliches"},
        {"route_name": "Baclaran Malabon (Letre) via EDSA", "origin": "Baclaran", "destination": "Malabon (Letre)"},
        {"route_name": "Monumento Philcite via Ayala EDSA", "origin": "Monumento", "destination": "Philcite"},
        {"route_name": "FTI - Navotas Terminal via EDSA", "origin": "FTI", "destination": "Navotas Terminal"},
        {"route_name": "Alabang Malabon (Letre) via EDSA", "origin": "Alabang", "destination": "Malabon (Letre)"},
        {"route_name": "Ayala Malanday via EDSA", "origin": "Ayala", "destination": "Malanday"},
        {"route_name": "Malanday Sucat via EDSA", "origin": "Malanday", "destination": "Sucat"},
        {"route_name": "Moonwalk - Plaza Lawton", "origin": "Moonwalk", "destination": "Plaza Lawton"},
        {"route_name": "Alabang (Starmall) Lagro", "origin": "Alabang (Starmall)", "destination": "Lagro"},
        {"route_name": "Alabang - Plaza Lawton", "origin": "Alabang", "destination": "Plaza Lawton"},
        {"route_name": "Ayala Malabon via EDSA", "origin": "Ayala", "destination": "Malabon"},
        {"route_name": "FTI-Monumento via EDSA", "origin": "FTI", "destination": "Monumento"},
        {"route_name": "Lagro - NAIA via Fairview", "origin": "Lagro", "destination": "NAIA"},
        {"route_name": "Alabang Monumento via EDSA", "origin": "Alabang", "destination": "Monumento"},
        {"route_name": "Ayala UE Caloocan via EDSA", "origin": "Ayala", "destination": "UE Caloocan"},
        {"route_name": "Alabang Lawton via Sucat", "origin": "Alabang", "destination": "Lawton"},
        {"route_name": "Ayala Monumento via EDSA", "origin": "Ayala", "destination": "Monumento"},
        {"route_name": "Domestic Grotto via EDSA", "origin": "Domestic", "destination": "Grotto"},
        {"route_name": "Monumento Sucat via EDSA", "origin": "Monumento", "destination": "Sucat"},
        {"route_name": "Ayala NAIA", "origin": "Ayala", "destination": "NAIA"},
        {"route_name": "Alabang Navotas", "origin": "Alabang", "destination": "Navotas"},
        {"route_name": "Pandacan Quiapo", "origin": "Pandacan", "destination": "Quiapo"},
        {"route_name": "Leveriza Monumento", "origin": "Leveriza", "destination": "Monumento"},
        {"route_name": "Taguig City Navotas", "origin": "Taguig City", "destination": "Navotas"},
        {"route_name": "Ayala Lagro via EDSA", "origin": "Ayala", "destination": "Lagro"},
        {"route_name": "Ayala Grotto via EDSA", "origin": "Ayala", "destination": "Grotto"},
        {"route_name": "Alabang Fairview", "origin": "Alabang", "destination": "Fairview"},
        {"route_name": "Alabang Malanday", "origin": "Alabang", "destination": "Malanday"},
        {"route_name": "Ayala Balintawak", "origin": "Ayala", "destination": "Balintawak"},
        {"route_name": "NAIA SM Fairview", "origin": "NAIA", "destination": "SM Fairview"},
        {"route_name": "San Mateo - Baclaran via EDSA, Ayala, Commonwealth Ave", "origin": "San Mateo", "destination": "Baclaran"},
        {"route_name": "Dasmarinas - Plaza Lawton via E. Aguinaldo Highway, Roxas Blvd", "origin": "Dasmarinas", "destination": "Plaza Lawton"},
        {"route_name": "Eastwood Libis - Marriot Terminal via Acropolis", "origin": "Eastwood Libis", "destination": "Marriot Terminal"},
        {"route_name": "FTI - Tungko, SJDM via Lagro, C'wealth Ave", "origin": "FTI", "destination": "Tungko, SJDM"},
        {"route_name": "Taguig - SM Fairview via Lagro Ayala Buendia EDSA", "origin": "Taguig", "destination": "SM Fairview"},
        {"route_name": "Baclaran-Malanday via EDSA, McArthur, Ayala", "origin": "Baclaran", "destination": "Malanday"},
        {"route_name": "Norzagaray - Baclaran Via Commonwealth Ave", "origin": "Norzagaray", "destination": "Baclaran"},
        {"route_name": "Pacita Complex (SP, Lag) - Letre via EDSA", "origin": "Pacita Complex", "destination": "Letre"},
        {"route_name": "Sapang Palay - Sta. Cruz via Marilao Exit", "origin": "Sapang Palay", "destination": "Sta. Cruz"},
        {"route_name": "Alabang Muntinlupa-Lawton via SSH Taft Ave", "origin": "Alabang Muntinlupa", "destination": "Lawton"},
        {"route_name": "Alabang-SM Fairview via Lagro Commonwealth", "origin": "Alabang", "destination": "SM Fairview"},
        {"route_name": "Sapang Palay - Sta Cruz (DJose) Sta Maria NE", "origin": "Sapang Palay", "destination": "Sta Cruz (DJose)"},
        {"route_name": "Grotto - Baclaran via Commonwealth Ave, Ayala", "origin": "Grotto", "destination": "Baclaran"},
        {"route_name": "Grotto - NAIA via EDSA, Ayala, Buendia Extn", "origin": "Grotto", "destination": "NAIA"},
        {"route_name": "Bagong Silang - NAIA via Maligaya Park, EDSA", "origin": "Bagong Silang", "destination": "NAIA"},
        {"route_name": "Malanday MIA via Pasay Rtda MOA Coastal Road", "origin": "Malanday", "destination": "MIA"},
        {"route_name": "Malanday Term - NAIA Via EDSA, Buendia, Ayala", "origin": "Malanday Term", "destination": "NAIA"},
        {"route_name": "Asturias-Ayala via Buendia Ave, Taft Ave", "origin": "Asturias", "destination": "Ayala"},
        {"route_name": "Ayala Ave-Ft Boni StaffHouse via Mckinly", "origin": "Ayala Ave", "destination": "Ft Boni StaffHouse"},
        {"route_name": "Ayala Dasmarinas (Cavite) via Coastal Rd", "origin": "Ayala", "destination": "Dasmarinas (Cavite)"},
        {"route_name": "Baclaran-Navotas Terminal via Edsa Ayala", "origin": "Baclaran", "destination": "Navotas Terminal"},
        {"route_name": "Baclaran - SM Fairview via Lagro, Ayala", "origin": "Baclaran", "destination": "SM Fairview"},
        {"route_name": "Baclaran-BgSilang via Edsa Commonwealth", "origin": "Baclaran", "destination": "BgSilang"},
        {"route_name": "Novaliches Pacita San Pedro via Malinta", "origin": "Novaliches", "destination": "Pacita San Pedro"},
        {"route_name": "Alabang-Novaliches via EDSA, MindanaoAve", "origin": "Alabang", "destination": "Novaliches"},
        {"route_name": "Baclaran-Novaliches via EDSA Mindanao Ave", "origin": "Baclaran", "destination": "Novaliches"},
        {"route_name": "Malanday - Muntinlupa via Edsa, Monumento", "origin": "Malanday", "destination": "Muntinlupa"},
        {"route_name": "Novaliches Baclaran via EDSA Mindanao Ave", "origin": "Novaliches", "destination": "Baclaran"},
        {"route_name": "Pandacan (Beata) - Quiapo via C. Palanca", "origin": "Pandacan (Beata)", "destination": "Quiapo"},
        {"route_name": "Baclaran - SM Fairview via Lagro C'wealth", "origin": "Baclaran", "destination": "SM Fairview"},
        {"route_name": "Baclaran SJDM via Commonwealth EDSA", "origin": "Baclaran", "destination": "SJDM"},
        {"route_name": "Baclaran-SM Fairview via Quezon Ave", "origin": "Baclaran", "destination": "SM Fairview"},
        {"route_name": "SM Fairview Ayala Leveriza via EDSA", "origin": "SM Fairview", "destination": "Ayala Leveriza"},
        {"route_name": "Alabang Lawton via Zapote Coastal Rd", "origin": "Alabang", "destination": "Lawton"},
        {"route_name": "Baclaran-Navotas Terminal via EDSA", "origin": "Baclaran", "destination": "Navotas Terminal"},
        {"route_name": "Monumento NAIA via EDSA Coastal Rd", "origin": "Monumento", "destination": "NAIA"},
        {"route_name": "Alabang - Navotas Terminal via EDSA", "origin": "Alabang", "destination": "Navotas Terminal"},
        {"route_name": "Alabang - Novaliches via EDSA, NLEX", "origin": "Alabang", "destination": "Novaliches"},
        {"route_name": "Pacita Complex - SM Fairview via EDSA", "origin": "Pacita Complex", "destination": "SM Fairview"},
        {"route_name": "Baclaran - Grotto via Commonwealth Ave", "origin": "Baclaran", "destination": "Grotto"},
        {"route_name": "Pacita Complex - Navotas Term via EDSA", "origin": "Pacita Complex", "destination": "Navotas Term"},
        {"route_name": "Baclaran - Minuyan via Commonwealth Ave", "origin": "Baclaran", "destination": "Minuyan"},
        {"route_name": "Baclaran Novaliches via EDSA Quirino", "origin": "Baclaran", "destination": "Novaliches"},
        {"route_name": "Baclaran-Malanday via Edsa, McArthur", "origin": "Baclaran", "destination": "Malanday"},
        {"route_name": "EDSA Carousel", "origin": "EDSA", "destination": "EDSA"},
    ],
    "jeepney": [
        {"route_name": "CUBAO-STOPnSHOP", "origin": "Cubao", "destination": "Stop n Shop"},
        {"route_name": "Camarin-Trinoma", "origin": "Camarin", "destination": "Trinoma"},
        {"route_name": "Dian - Libertad", "origin": "Dian", "destination": "Libertad"},
        {"route_name": "FRISCO-REMEDIOS", "origin": "Frisco", "destination": "Remedios"},
        {"route_name": "CUBAO - PADILLA", "origin": "Cubao", "destination": "Padilla"},
        {"route_name": "CUBAO DIVISORIA", "origin": "Cubao", "destination": "Divisoria"},
        {"route_name": "CUBAO-STA.LUCIA", "origin": "Cubao", "destination": "Sta. Lucia"},
        {"route_name": "Libertad-PCampa", "origin": "Libertad", "destination": "P. Campa"},
        {"route_name": "MUNOZ-PANTRANCO", "origin": "Munoz", "destination": "Pantranco"},
        {"route_name": "Namayan Vergara", "origin": "Namayan", "destination": "Vergara"},
        {"route_name": "PATEROS - AYALA", "origin": "Pateros", "destination": "Ayala"},
        {"route_name": "FTI - Kayaman C", "origin": "FTI", "destination": "Kayaman C"},
        {"route_name": "Frisco-Sta Cruz", "origin": "Frisco", "destination": "Sta Cruz"},
        {"route_name": "LIBERTAD - PRC", "origin": "Libertad", "destination": "PRC"},
        {"route_name": "Lagro SM North", "origin": "Lagro", "destination": "SM North"},
        {"route_name": "MONUMENTO-PIER", "origin": "Monumento", "destination": "Pier"},
        {"route_name": "MURPHY - CUBAO", "origin": "Murphy", "destination": "Cubao"},
        {"route_name": "CUBAO - QUIAPO", "origin": "Cubao", "destination": "Quiapo"},
        {"route_name": "CUBAO - V CRUZ", "origin": "Cubao", "destination": "V Cruz"},
        {"route_name": "CUBAO - V. LUNA", "origin": "Cubao", "destination": "V. Luna"},
        {"route_name": "CUBAO-T KALAW", "origin": "Cubao", "destination": "T Kalaw"},
        {"route_name": "Parang - Recto", "origin": "Parang", "destination": "Recto"},
        {"route_name": "SM NORTH LAGRO", "origin": "SM North", "destination": "Lagro"},
        {"route_name": "Taytay-Rosario", "origin": "Taytay", "destination": "Rosario"},
        {"route_name": "Alabang Almanza", "origin": "Alabang", "destination": "Almanza"},
        {"route_name": "MURPHY - QMART", "origin": "Murphy", "destination": "QMart"},
        {"route_name": "Monumento Polo", "origin": "Monumento", "destination": "Polo"},
        {"route_name": "PROJ 2&3-QMART", "origin": "Proj 2&3", "destination": "QMart"},
        {"route_name": "Lagro Philcoa", "origin": "Lagro", "destination": "Philcoa"},
        {"route_name": "Molino-Zapote", "origin": "Molino", "destination": "Zapote"},
        {"route_name": "Munoz - Luzon", "origin": "Munoz", "destination": "Luzon"},
        {"route_name": "Navotas Recto", "origin": "Navotas", "destination": "Recto"},
        {"route_name": "Galas-Barbosa", "origin": "Galas", "destination": "Barbosa"},
        {"route_name": "CUBAO - PARANG", "origin": "Cubao", "destination": "Parang"},
        {"route_name": "PIER-MALANDAY", "origin": "Pier", "destination": "Malanday"},
        {"route_name": "RECTO - GASAK", "origin": "Recto", "destination": "Gasak"},
        {"route_name": "Angono Rosario", "origin": "Angono", "destination": "Rosario"},
        {"route_name": "Angono-Pasig", "origin": "Angono", "destination": "Pasig"},
        {"route_name": "CUBAO TAYTAY", "origin": "Cubao", "destination": "Taytay"},
        {"route_name": "Pasig-Cubao", "origin": "Pasig", "destination": "Cubao"},
        {"route_name": "SM MOA NAIA", "origin": "SM MOA", "destination": "NAIA"},
        {"route_name": "Sucat-SM MOA", "origin": "Sucat", "destination": "SM MOA"},
        {"route_name": "CUBAO-B.BAYAN", "origin": "Cubao", "destination": "B. Bayan"},
        {"route_name": "MCU-LIBERTAD", "origin": "MCU", "destination": "Libertad"},
        {"route_name": "NICHOLS-IKOT", "origin": "Nichols", "destination": "Ikot"},
        {"route_name": "NOVA-CAMARIN", "origin": "Nova", "destination": "Camarin"},
        {"route_name": "Pasig-Taytay", "origin": "Pasig", "destination": "Taytay"},
        {"route_name": "CUBAO-LIBIS", "origin": "Cubao", "destination": "Libis"},
        {"route_name": "CUBAO-ROCES", "origin": "Cubao", "destination": "Roces"},
        {"route_name": "Imus Zapote", "origin": "Imus", "destination": "Zapote"},
        {"route_name": "LAGRO-CUBAO", "origin": "Lagro", "destination": "Cubao"},
        {"route_name": "QI Kalaw", "origin": "QI", "destination": "Kalaw"},
        {"route_name": "UP - MRT", "origin": "UP", "destination": "MRT"},
        {"route_name": "NOVA-TALA", "origin": "Nova", "destination": "Tala"},
        {"route_name": "UP - IKOT", "origin": "UP", "destination": "UP"},
        {"route_name": "LIBERTAD-EVANGELISTA", "origin": "Libertad", "destination": "Evangelista"},
        {"route_name": "Libertad - Pasay Rd.", "origin": "Libertad", "destination": "Pasay Rd."},
        {"route_name": "MARIKINA - MONTALBAN", "origin": "Marikina", "destination": "Montalban"},
        {"route_name": "Marikina - San Mateo", "origin": "Marikina", "destination": "San Mateo"},
        {"route_name": "Guadalupe Delpan MRT", "origin": "Guadalupe", "destination": "Delpan MRT"},
        {"route_name": "L. Guinto - Pandacan", "origin": "L. Guinto", "destination": "Pandacan"},
        {"route_name": "BACLARAN - DIVISORIA", "origin": "Baclaran", "destination": "Divisoria"},
        {"route_name": "SHAW BLVD - ORTIGAS", "origin": "Shaw Blvd", "destination": "Ortigas"},
        {"route_name": "Blumentritt - Frisco", "origin": "Blumentritt", "destination": "Frisco"},
        {"route_name": "DAPITAN - PIER SOUTH", "origin": "Dapitan", "destination": "Pier South"},
        {"route_name": "DIVISORIA - STA CRUZ", "origin": "Divisoria", "destination": "Sta Cruz"},
        {"route_name": "BEL AIR - WASHINGTON", "origin": "Bel Air", "destination": "Washington"},
        {"route_name": "BLUMENTRITT - QUIAPO", "origin": "Blumentritt", "destination": "Quiapo"},
        {"route_name": "BUENDIA LRT - SM MOA", "origin": "Buendia LRT", "destination": "SM MOA"},
        {"route_name": "Binangonan-Shaw Blvd", "origin": "Binangonan", "destination": "Shaw Blvd"},
        {"route_name": "CUBAO - SSS VILLAGE", "origin": "Cubao", "destination": "SSS Village"},
        {"route_name": "KATIPUNAN - UP GATE", "origin": "Katipunan", "destination": "UP Gate"},
        {"route_name": "MONUMENTO-PIER", "origin": "Monumento", "destination": "Pier"},
        {"route_name": "CUBAO - QUIAPO", "origin": "Cubao", "destination": "Quiapo"},
        {"route_name": "CUBAO - V CRUZ", "origin": "Cubao", "destination": "V Cruz"},
        {"route_name": "CUBAO - V. LUNA", "origin": "Cubao", "destination": "V. Luna"},
        {"route_name": "CUBAO-T KALAW", "origin": "Cubao", "destination": "T Kalaw"},
        {"route_name": "Parang - Recto", "origin": "Parang", "destination": "Recto"},
        {"route_name": "SM NORTH LAGRO", "origin": "SM North", "destination": "Lagro"},
        {"route_name": "Taytay-Rosario", "origin": "Taytay", "destination": "Rosario"},
        {"route_name": "Alabang Almanza", "origin": "Alabang", "destination": "Almanza"},
        {"route_name": "MURPHY - QMART", "origin": "Murphy", "destination": "QMart"},
        {"route_name": "Monumento Polo", "origin": "Monumento", "destination": "Polo"},
        {"route_name": "PROJ 2&3-QMART", "origin": "Proj 2&3", "destination": "QMart"},
        {"route_name": "Lagro Philcoa", "origin": "Lagro", "destination": "Philcoa"},
        {"route_name": "Molino-Zapote", "origin": "Molino", "destination": "Zapote"},
        {"route_name": "Munoz - Luzon", "origin": "Munoz", "destination": "Luzon"},
        {"route_name": "Navotas Recto", "origin": "Navotas", "destination": "Recto"},
        {"route_name": "Galas-Barbosa", "origin": "Galas", "destination": "Barbosa"},
        {"route_name": "CUBAO - PARANG", "origin": "Cubao", "destination": "Parang"},
        {"route_name": "PIER-MALANDAY", "origin": "Pier", "destination": "Malanday"},
        {"route_name": "RECTO - GASAK", "origin": "Recto", "destination": "Gasak"},
        {"route_name": "Angono Rosario", "origin": "Angono", "destination": "Rosario"},
        {"route_name": "Angono-Pasig", "origin": "Angono", "destination": "Pasig"},
        {"route_name": "CUBAO TAYTAY", "origin": "Cubao", "destination": "Taytay"},
        {"route_name": "Pasig-Cubao", "origin": "Pasig", "destination": "Cubao"},
        {"route_name": "SM MOA NAIA", "origin": "SM MOA", "destination": "NAIA"},
        {"route_name": "Sucat-SM MOA", "origin": "Sucat", "destination": "SM MOA"},
        {"route_name": "CUBAO-B.BAYAN", "origin": "Cubao", "destination": "B. Bayan"},
        {"route_name": "MCU-LIBERTAD", "origin": "MCU", "destination": "Libertad"},
        {"route_name": "NICHOLS-IKOT", "origin": "Nichols", "destination": "Ikot"},
        {"route_name": "NOVA-CAMARIN", "origin": "Nova", "destination": "Camarin"},
        {"route_name": "Pasig-Taytay", "origin": "Pasig", "destination": "Taytay"},
        {"route_name": "CUBAO-LIBIS", "origin": "Cubao", "destination": "Libis"},
        {"route_name": "CUBAO-ROCES", "origin": "Cubao", "destination": "Roces"},
        {"route_name": "Imus Zapote", "origin": "Imus", "destination": "Zapote"},
        {"route_name": "LAGRO-CUBAO", "origin": "Lagro", "destination": "Cubao"},
        {"route_name": "QI Kalaw", "origin": "QI", "destination": "Kalaw"},
        {"route_name": "UP - MRT", "origin": "UP", "destination": "MRT"},
        {"route_name": "NOVA-TALA", "origin": "Nova", "destination": "Tala"},
        {"route_name": "UP - IKOT", "origin": "UP", "destination": "UP"},
    ],
    "bgc_bus": [
        {"route_name": "EDSA Ayala - Market! Market!", "origin": "EDSA Ayala", "destination": "Market! Market!"},
        {"route_name": "EDSA Ayala - RCBC - Net One - Fort Victoria", "origin": "EDSA Ayala", "destination": "Fort Victoria"},
        {"route_name": "EDSA Ayala - Fort Victoria", "origin": "EDSA Ayala", "destination": "Fort Victoria"},
        {"route_name": "EDSA Ayala - BGC Turf - EDSA Ayala", "origin": "EDSA Ayala", "destination": "BGC Turf"},
        {"route_name": "EDSA Ayala - Bonifacio - Crescent Park West", "origin": "EDSA Ayala", "destination": "Crescent Park West"},
    ],
    "p2p": [
        {"route_name": "PITX - Makati", "origin": "PITX", "destination": "Makati"},
        {"route_name": "Robinsons Galleria - Glorietta 3", "origin": "Robinsons Galleria", "destination": "Glorietta 3"},
        {"route_name": "Eastwood - Makati CBD", "origin": "Eastwood", "destination": "Makati CBD"},
        {"route_name": "Araneta Center - NAIA", "origin": "Araneta Center", "destination": "NAIA"},
        {"route_name": "Alabang Town Center - Lawton", "origin": "Alabang Town Center", "destination": "Lawton"},
    ],
    "uv_express": [
        {"route_name": "LAGRO - QUIAPO VIA SAUYO", "origin": "Lagro", "destination": "Quiapo"},
        {"route_name": "DEPARO - CUBAO", "origin": "Deparo", "destination": "Cubao"},
        {"route_name": "ANTIPOLO - AYALA", "origin": "Antipolo", "destination": "Ayala"},
        {"route_name": "PASIG - QUIAPO", "origin": "Pasig", "destination": "Quiapo"},
        {"route_name": "NOVALICHES - TRINOMA", "origin": "Novaliches", "destination": "Trinoma"},
    ],
}

def check_existing():
    """Check if ph_route_reference table exists and has data"""
    try:
        res = supabase.table("ph_route_reference").select("count", count="exact").limit(0).execute()
        count = res.count if hasattr(res, 'count') else 0
        print(f"ph_route_reference table exists, current rows: {count}")
        return True
    except Exception as e:
        print(f"ph_route_reference table check failed: {e}")
        return False

def populate():
    """Insert routes into ph_route_reference table"""
    total_inserted = 0
    total_skipped = 0
    
    for mode, routes in routes_data.items():
        print(f"\n📥 Inserting {len(routes)} {mode} routes...")
        
        for route in routes:
            try:
                # Check if route already exists
                existing = supabase.table("ph_route_reference").select("id").eq("route_name", route["route_name"]).limit(1).execute()
                
                if existing.data:
                    total_skipped += 1
                    continue
                
                # Insert new route
                data = {
                    "route_name": route["route_name"],
                    "origin": route.get("origin"),
                    "destination": route.get("destination"),
                    "mode": mode,
                    "source_file": "manual_population.csv",
                }
                
                res = supabase.table("ph_route_reference").insert(data).execute()
                
                if res.data:
                    total_inserted += 1
                    if total_inserted % 20 == 0:
                        print(f"  ✅ Inserted {total_inserted} routes so far...")
                else:
                    total_skipped += 1
                    
            except Exception as e:
                total_skipped += 1
                if "duplicate" not in str(e).lower():
                    print(f"  ⚠️ Error inserting {route['route_name']}: {e}")
    
    print(f"\n{'='*50}")
    print(f"📊 Summary:")
    print(f"   ✅ Inserted: {total_inserted}")
    print(f"   ⏭️ Skipped (duplicates/errors): {total_skipped}")
    print(f"   📈 Total routes in data: {sum(len(r) for r in routes_data.values())}")
    print(f"{'='*50}")

if __name__ == "__main__":
    print("🔍 Checking ph_route_reference table...")
    if check_existing():
        populate()
    else:
        print("❌ Table not found. Creating ph_route_reference table...")
        print("Please create the table first with this SQL:")
        print("""
CREATE TABLE IF NOT EXISTS ph_route_reference (
    id SERIAL PRIMARY KEY,
    route_name TEXT NOT NULL UNIQUE,
    origin TEXT,
    destination TEXT,
    mode TEXT NOT NULL,
    agency TEXT,
    source_file TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
        """)
