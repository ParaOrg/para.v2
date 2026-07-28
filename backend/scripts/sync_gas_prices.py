"""Manually run the gas-price sync (DOE PDF + fuelprice.ph + Rappler news).

Usage (from backend/):
    python scripts/sync_gas_prices.py

This is the same code path the weekly scheduler calls (see main.py's lifespan),
so it's useful both for local testing and for a manually-triggered refresh.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import gas_price_db
from gas_price_sync import run_gas_price_sync


def main():
    conn = gas_price_db.get_connection()
    try:
        gas_price_db.init_gas_price_tables(conn)
        seeded = gas_price_db.seed_stations_from_poi(conn)
        if seeded:
            print(f"⛽ Seeded {seeded} gas stations from POI.geojson")
    finally:
        conn.close()

    results = run_gas_price_sync()
    print("\n⛽ Sync results:")
    for source, status in results.items():
        print(f"   {source}: {status}")

    failures = [s for s, status in results.items() if status != "success"]
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
