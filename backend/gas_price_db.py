"""SQLite schema, station seeding, and query helpers for the gas-prices feature.

Shares para_ml_data.db with the rest of the backend (see main.py / api_routes.py)
rather than opening a second database file.
"""
import json
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "para_ml_data.db"
POI_PATH = BASE_DIR / "data" / "geojson_data" / "POI.geojson"

# The 7 brands the frontend map/report flow understands (frontend/src/components/GasPrice/*.jsx).
# OpenStreetMap brand tags -> our station.brand id.
OSM_BRAND_MAP = {
    "shell": "shell",
    "petron": "petron",
    "caltex": "caltex",
    "seaoil": "seaoil",
    "sea oil": "seaoil",
    "ptt": "ptt",
    "cleanfuel": "cleanfuel",
    "clean fuel": "cleanfuel",
    "total": "total",
    "totalenergies": "total",
    "total energies": "total",
}

FUEL_IDS = ["ron91", "ron95", "ron97", "xcs", "diesel", "diesel_premium", "kerosene"]


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_gas_price_tables(conn: sqlite3.Connection) -> None:
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS gas_stations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            brand TEXT NOT NULL,
            name TEXT NOT NULL,
            address TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            source TEXT NOT NULL DEFAULT 'osm_poi',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    # Latest settled per-brand, per-fuel price from the aggregator source (fuelprice.ph).
    # One row per (brand, fuel_id) -- always the most recent snapshot; prev_price is
    # taken from the source's own week-on-week figure rather than recomputed locally,
    # so a missed sync week doesn't corrupt the delta.
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gas_price_official (
            brand TEXT NOT NULL,
            fuel_id TEXT NOT NULL,
            price REAL NOT NULL,
            prev_price REAL,
            status TEXT,
            verified_date TEXT,
            source TEXT NOT NULL DEFAULT 'fuelprice_ph',
            fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (brand, fuel_id)
        )
    """)

    # DOE's own weekly advisory: an aggregate Php range + direction per fuel category
    # (DOE's PDF never breaks this down by brand or RON grade -- see gas_price_sources.py).
    cur.execute("""
        CREATE TABLE IF NOT EXISTS doe_weekly_summary (
            as_of_date TEXT PRIMARY KEY,
            effective_start TEXT,
            effective_end TEXT,
            gasoline_change_min REAL,
            gasoline_change_max REAL,
            gasoline_direction TEXT,
            diesel_change_min REAL,
            diesel_change_max REAL,
            diesel_direction TEXT,
            kerosene_change_min REAL,
            kerosene_change_max REAL,
            kerosene_direction TEXT,
            ytd_gasoline REAL,
            ytd_diesel REAL,
            ytd_kerosene REAL,
            source_url TEXT,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS gas_price_news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            published_at TEXT,
            direction TEXT,
            matched_keywords TEXT,
            fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS gas_price_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            station_id INTEGER NOT NULL REFERENCES gas_stations(id),
            fuel_type TEXT NOT NULL,
            price REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS gas_price_sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_at TEXT NOT NULL DEFAULT (datetime('now')),
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            detail TEXT
        )
    """)

    conn.commit()


def _build_address(raw_tags: dict) -> str:
    parts = []
    house = raw_tags.get("addr:housenumber")
    street = raw_tags.get("addr:street")
    if house and street:
        parts.append(f"{house} {street}")
    elif street:
        parts.append(street)
    city = raw_tags.get("addr:city")
    if city:
        parts.append(city)
    elif raw_tags.get("addr:province"):
        parts.append(raw_tags["addr:province"])
    return ", ".join(parts) if parts else "Metro Manila"


def seed_stations_from_poi(conn: sqlite3.Connection, poi_path: Path = POI_PATH) -> int:
    """Populate gas_stations from the real, geocoded fuel POIs already in the repo
    (OpenStreetMap data, backend/data/geojson_data/POI.geojson). No-ops if OSM-sourced
    stations already exist, so it's safe to call on every startup.
    """
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM gas_stations WHERE source = 'osm_poi'")
    if cur.fetchone()[0] > 0:
        return 0

    if not poi_path.exists():
        return 0

    with open(poi_path, encoding="utf-8") as f:
        data = json.load(f)

    seen = set()
    rows = []
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        if props.get("Category") != "fuel":
            continue
        raw_tags = props.get("Raw_Tags") or {}
        brand_raw = (raw_tags.get("brand") or props.get("Name") or "").strip().lower()
        brand = OSM_BRAND_MAP.get(brand_raw)
        if not brand:
            continue

        lat, lng = props.get("Latitude"), props.get("Longitude")
        if lat is None or lng is None:
            continue

        dedupe_key = (brand, round(lat, 5), round(lng, 5))
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        name = props.get("Name") or brand.title()
        address = _build_address(raw_tags)
        rows.append((brand, name, address, lat, lng))

    cur.executemany(
        "INSERT INTO gas_stations (brand, name, address, lat, lng, source) VALUES (?, ?, ?, ?, ?, 'osm_poi')",
        rows,
    )
    conn.commit()
    return len(rows)


# ── Writes used by the sync pipeline ────────────────────────────────────────

def upsert_official_price(conn, brand, fuel_id, price, prev_price, status, verified_date, source="fuelprice_ph"):
    conn.execute("""
        INSERT INTO gas_price_official (brand, fuel_id, price, prev_price, status, verified_date, source, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(brand, fuel_id) DO UPDATE SET
            price=excluded.price, prev_price=excluded.prev_price, status=excluded.status,
            verified_date=excluded.verified_date, source=excluded.source, fetched_at=excluded.fetched_at
    """, (brand, fuel_id, price, prev_price, status, verified_date, source))


def upsert_doe_summary(conn, summary: dict):
    conn.execute("""
        INSERT INTO doe_weekly_summary (
            as_of_date, effective_start, effective_end,
            gasoline_change_min, gasoline_change_max, gasoline_direction,
            diesel_change_min, diesel_change_max, diesel_direction,
            kerosene_change_min, kerosene_change_max, kerosene_direction,
            ytd_gasoline, ytd_diesel, ytd_kerosene, source_url, fetched_at
        ) VALUES (
            :as_of_date, :effective_start, :effective_end,
            :gasoline_change_min, :gasoline_change_max, :gasoline_direction,
            :diesel_change_min, :diesel_change_max, :diesel_direction,
            :kerosene_change_min, :kerosene_change_max, :kerosene_direction,
            :ytd_gasoline, :ytd_diesel, :ytd_kerosene, :source_url, datetime('now')
        )
        ON CONFLICT(as_of_date) DO UPDATE SET
            effective_start=excluded.effective_start, effective_end=excluded.effective_end,
            gasoline_change_min=excluded.gasoline_change_min, gasoline_change_max=excluded.gasoline_change_max,
            gasoline_direction=excluded.gasoline_direction,
            diesel_change_min=excluded.diesel_change_min, diesel_change_max=excluded.diesel_change_max,
            diesel_direction=excluded.diesel_direction,
            kerosene_change_min=excluded.kerosene_change_min, kerosene_change_max=excluded.kerosene_change_max,
            kerosene_direction=excluded.kerosene_direction,
            ytd_gasoline=excluded.ytd_gasoline, ytd_diesel=excluded.ytd_diesel, ytd_kerosene=excluded.ytd_kerosene,
            source_url=excluded.source_url, fetched_at=excluded.fetched_at
    """, summary)


def insert_news_item(conn, title, url, published_at, direction, matched_keywords):
    conn.execute("""
        INSERT OR IGNORE INTO gas_price_news (title, url, published_at, direction, matched_keywords)
        VALUES (?, ?, ?, ?, ?)
    """, (title, url, published_at, direction, matched_keywords))


def log_sync(conn, source, status, detail=""):
    conn.execute(
        "INSERT INTO gas_price_sync_log (source, status, detail) VALUES (?, ?, ?)",
        (source, status, detail),
    )
    conn.commit()


def insert_station(conn, brand, name, address, lat, lng) -> int:
    cur = conn.execute(
        "INSERT INTO gas_stations (brand, name, address, lat, lng, source) VALUES (?, ?, ?, ?, ?, 'user_added')",
        (brand, name, address, lat, lng),
    )
    conn.commit()
    return cur.lastrowid


def insert_price_report(conn, station_id, fuel_type, price):
    conn.execute(
        "INSERT INTO gas_price_reports (station_id, fuel_type, price) VALUES (?, ?, ?)",
        (station_id, fuel_type, price),
    )
    conn.commit()


# ── Reads used by the API endpoints ─────────────────────────────────────────

def get_stations(conn) -> list:
    return [dict(r) for r in conn.execute("SELECT * FROM gas_stations ORDER BY id")]


def station_exists(conn, station_id) -> bool:
    return conn.execute("SELECT 1 FROM gas_stations WHERE id = ?", (station_id,)).fetchone() is not None


def get_official_prices(conn) -> list:
    return [dict(r) for r in conn.execute("SELECT * FROM gas_price_official")]


def get_latest_doe_summary(conn):
    row = conn.execute(
        "SELECT * FROM doe_weekly_summary ORDER BY as_of_date DESC LIMIT 1"
    ).fetchone()
    return dict(row) if row else None


def get_latest_news(conn, limit=1) -> list:
    return [
        dict(r) for r in conn.execute(
            "SELECT * FROM gas_price_news ORDER BY published_at DESC, fetched_at DESC LIMIT ?",
            (limit,),
        )
    ]


def get_community_prices_by_station(conn, min_reports=3, window_days=7) -> dict:
    """station_id -> {fuel_type: {community_avg, report_count}} using only reports
    from the last `window_days`, and only where at least `min_reports` were received
    (matches the '3+ reports within 7 days' rule shown in the gas-prices page copy).
    """
    rows = conn.execute(f"""
        SELECT station_id, fuel_type, AVG(price) AS avg_price, COUNT(*) AS report_count
        FROM gas_price_reports
        WHERE created_at >= datetime('now', '-{int(window_days)} days')
        GROUP BY station_id, fuel_type
        HAVING COUNT(*) >= ?
    """, (min_reports,)).fetchall()

    result: dict = {}
    for r in rows:
        result.setdefault(r["station_id"], {})[r["fuel_type"]] = {
            "community_avg": r["avg_price"],
            "report_count": r["report_count"],
        }
    return result


def get_community_prices_by_brand(conn, min_reports=3, window_days=7) -> dict:
    """brand -> {fuel_type: {community_avg, report_count}}, aggregating reports
    across every physical station of that brand. This is what actually decides
    whether a brand's column in the comparison table shows the official price or
    a community-reported one -- see get_community_prices_by_station for the
    per-physical-station version used by the map's station info panel instead.
    """
    rows = conn.execute(f"""
        SELECT s.brand AS brand, r.fuel_type AS fuel_type, AVG(r.price) AS avg_price, COUNT(*) AS report_count
        FROM gas_price_reports r
        JOIN gas_stations s ON s.id = r.station_id
        WHERE r.created_at >= datetime('now', '-{int(window_days)} days')
        GROUP BY s.brand, r.fuel_type
        HAVING COUNT(*) >= ?
    """, (min_reports,)).fetchall()

    result: dict = {}
    for r in rows:
        result.setdefault(r["brand"], {})[r["fuel_type"]] = {
            "community_avg": r["avg_price"],
            "report_count": r["report_count"],
        }
    return result


def get_sync_status(conn) -> list:
    """Most recent log entry per source -- used to compute data staleness."""
    return [
        dict(r) for r in conn.execute("""
            SELECT source, status, detail, MAX(run_at) AS run_at
            FROM gas_price_sync_log
            GROUP BY source
        """)
    ]
