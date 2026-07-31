"""
llm_engine.py - Semantic Parsing & Geocoding
"""

import re
import sqlite3
import json
from typing import Optional, Dict
import httpx
from geopy.geocoders import Nominatim
from geopy.extra.rate_limiter import RateLimiter
import logging
import hashlib
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Metro Manila bounds
MM_LAT_MIN, MM_LAT_MAX = 14.35, 14.80
MM_LON_MIN, MM_LON_MAX = 120.90, 121.20

# Gazetteer
GAZETTEER = {
    # Additional verified coordinates
    "divisoria": "Divisoria, Manila",
    "binondo": "Binondo, Manila",
    "north avenue": "North Avenue MRT Station, Quezon City",
    "edsa": "EDSA MRT Station, Pasay",
    "taft": "Taft Avenue LRT Station, Manila",
    "ortigas": "Ortigas Center, Pasig",
    "eastwood": "Eastwood City, Quezon City",
    "katipunan": "Katipunan Avenue, Quezon City",
    "philcoa": "Philcoa, Quezon City",
    "venice": "Venice Grand Canal, Taguig",
    "makati": "Makati City",
    "pasig": "Pasig City",
    "quezon city": "Quezon City",
    "manila": "Manila City",
    "taguig": "Taguig City",
    "paranaque": "Paranaque City",
    "pasay": "Pasay City",
    "mandaluyong": "Mandaluyong City",
    "san juan": "San Juan City",
    "marikina": "Marikina City",
    "caloocan": "Caloocan City",
    "malabon": "Malabon City",
    "navotas": "Navotas City",
    "valenzuela": "Valenzuela City",

    # Universities
    "ateneo": "Ateneo de Manila University, Katipunan, Quezon City",
    "admu": "Ateneo de Manila University, Katipunan, Quezon City",
    "dlsu": "De La Salle University, Taft Avenue, Manila",
    "lasalle": "De La Salle University, Taft Avenue, Manila",
    "feu": "Far Eastern University, Manila",
    "ue": "University of the East, Manila",
    "nu": "National University, Manila",
    "pup": "Polytechnic University of the Philippines, Manila",
    "mapua": "Mapua University, Manila",
    
    # Malls/Areas
    "sm north": "SM City North EDSA, Quezon City",
    "trinoma": "TriNoma, Quezon City",
    "megamall": "SM Megamall, Ortigas",
    "moa": "SM Mall of Asia, Pasay",
    "glorietta": "Glorietta, Makati",
    "greenbelt": "Greenbelt, Makati",
    "bgc": "Bonifacio Global City, Taguig",
    "ortigas": "Ortigas Center, Pasig",
    "eastwood": "Eastwood City, Quezon City",
    "venice": "Venice Grand Canal, Taguig",
    
    # Transport hubs
    "cubao": "Araneta Center Cubao, Quezon City",
    "buendia": "Buendia Terminal, Makati",
    "pitx": "PITX, Paranaque",
    
    # Churches/Landmarks
    "quiapo": "Quiapo Church, Manila",
    "baclaran": "Baclaran Church, Pasay",
    "luneta": "Rizal Park, Manila",
    "intramuros": "Intramuros, Manila",
    "divisoria": "Divisoria, Manila",
    "binondo": "Binondo, Manila",
    
    # Stations
    "north avenue": "North Avenue MRT Station, Quezon City",
    "edsa": "EDSA MRT Station, Pasay",
    "taft": "Taft Avenue LRT Station, Manila",

    "upd": "University of the Philippines Diliman",
    "up": "University of the Philippines",
    "ust": "University of Santo Tomas",
    "moa": "Mall of Asia",
    "bgc": "Bonifacio Global City",
    "katips": "Katipunan Avenue",
    "q ave": "Quezon Avenue",
    "taft": "Taft Avenue",
    "cubao": "Araneta Center Cubao",
    "ortigas": "Ortigas Center",
    "edsa station": "EDSA MRT Station, Pasay",
    "edsa mrt": "EDSA MRT Station, Pasay",
    "north ave": "North Avenue MRT Station, Quezon City",
    "north ave station": "North Avenue MRT Station, Quezon City",
    "taft station": "Taft Avenue LRT Station, Manila",
    "taft lrt": "Taft Avenue LRT Station, Manila",
    "buendia station": "Buendia MRT Station, Makati",
    "ayala station": "Ayala MRT Station, Makati",
    "shaw station": "Shaw Boulevard MRT Station, Mandaluyong",
    "boni station": "Boni MRT Station, Mandaluyong",
    "ortigas station": "Ortigas MRT Station, Mandaluyong",
    "santolan station": "Santolan LRT Station, Pasig",
    "katipunan station": "Katipunan LRT Station, Quezon City",
    "anons station": "Anonas LRT Station, Quezon City",
    "cubao station": "Cubao MRT/LRT Station, Quezon City",
    "gateway": "Gateway Mall Cubao, Quezon City",
    "farmers": "Farmers Plaza Cubao, Quezon City",
    "valenzuela": "Valenzuela City",
    "divisoria": "Divisoria, Manila",
    "binondo": "Binondo, Manila",
    "philcoa": "Philcoa, Quezon City",
    "commonwealth": "Commonwealth Avenue, Quezon City",
    "espana": "España Boulevard, Manila",
    "aurora": "Aurora Boulevard, Quezon City",
    "marcos highway": "Marcos Highway, Marikina",
    "makati": "Makati Central Business District",
    "megamall": "SM Megamall, Ortigas",
    "buendia": "Buendia Terminal, Makati",
    "ortigas": "Ortigas Center, Pasig",
    "greenbelt": "Greenbelt, Makati",
    "edsa": "EDSA MRT Station, Pasay",
    "eastwood": "Eastwood City, Quezon City",
    "venice": "Venice Grand Canal, Taguig",
    "commonwealth": "Commonwealth Avenue, Quezon City",
    "espana": "España Boulevard, Manila",
    "aurora": "Aurora Boulevard, Quezon City",
    "marcos highway": "Marcos Highway, Marikina",
    "mall of asia": "SM Mall of Asia",
    "sm megamall": "SM Megamall",
    "sm north edsa": "SM City North EDSA",
    "la salle": "De La Salle University",
    "up diliman": "University of the Philippines Diliman",
}


def _lookup_poi_db(query: str) -> Optional[Dict]:
    """Look up a POI in the local database (instant)"""
    try:
        conn = sqlite3.connect("para_poi.db")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT lat, lon, formal_name FROM poi_locations WHERE name = ?",
            (query.lower().strip(),)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                'found': True,
                'lat': row[0],
                'lon': row[1],
                'display_name': row[2],
                'query': query,
                'source': 'poi_db'
            }
    except:
        pass
    return None

def _cache_poi_db(query: str, lat: float, lon: float, display_name: str):
    """Cache a geocoded location to the POI database"""
    try:
        conn = sqlite3.connect("para_poi.db")
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR IGNORE INTO poi_locations (name, formal_name, lat, lon, category, source) VALUES (?, ?, ?, ?, 'auto', 'nominatim')",
            (query.lower().strip(), display_name, lat, lon)
        )
        conn.commit()
        conn.close()
    except:
        pass

# In-memory cache
_cache = {}

def _get_cache_key(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()


def _init_sqlite():
    """Initialize SQLite cache with correct schema"""
    conn = sqlite3.connect("para_poi.db")
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS geocache (
            query_hash TEXT PRIMARY KEY,
            query TEXT,
            lat REAL,
            lon REAL,
            display_name TEXT,
            bbox TEXT,
            source TEXT DEFAULT 'nominatim',
            confidence REAL DEFAULT 0.8,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

# Initialize on import
_init_sqlite()

def _get_sqlite_cache(key: str) -> Optional[Dict]:
    try:
        conn = sqlite3.connect("para_poi.db")
        cursor = conn.cursor()
        cursor.execute(
            "SELECT lat, lon, display_name, query FROM geocache WHERE query_hash = ?",
            (key,)
        )
        row = cursor.fetchone()
        conn.close()
        if row:
            return {
                'found': True,
                'lat': row[0],
                'lon': row[1],
                'display_name': row[2],
                'query': row[3]
            }
    except Exception as e:
        logger.warning(f"⚠️ SQLite cache read error: {e}")
    return None

def _set_sqlite_cache(key: str, value: Dict):
    try:
        conn = sqlite3.connect("para_poi.db")
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO geocache (query_hash, lat, lon, display_name, query) VALUES (?, ?, ?, ?, ?)",
            (key, value['lat'], value['lon'], value['display_name'], value['query'])
        )
        conn.commit()
        conn.close()
    except Exception as e:
        logger.warning(f"⚠️ SQLite cache write error: {e}")

def normalize_location(query: str) -> Optional[Dict]:
    """Normalize location using gazetteer and Nominatim"""
    if not query:
        return None
    
    query_lower = query.lower().strip()
    
    # Check gazetteer
    if query_lower in GAZETTEER:
        formal = GAZETTEER[query_lower]
        logger.info(f"📝 Gazetteer: '{query_lower}' -> '{formal}'")
        # Check POI database first (instant)
        result = _lookup_poi_db(query_lower)
        if result:
            logger.info(f"✅ POI DB hit: '{query_lower}' -> ({result['lat']:.5f}, {result['lon']:.5f})")
            return result
        # Fallback to geocoding only if not in DB
        result = _geocode(formal)
        if result:
            return result
    
    # Always search within Metro Manila context
    # Try with "Metro Manila" first (more reliable)
    result = _geocode(f"{query}, Metro Manila, Philippines")
    if result:
        return result
    
    # Fallback: try bare query
    result = _geocode(query)
    if result:
        return result
    
    logger.warning(f"⚠️ Could not geocode: '{query}'")
    return None

def _geocode(query: str) -> Optional[Dict]:
    """Geocode using Nominatim with caching"""
    if not query:
        return None
    
    cache_key = _get_cache_key(query)
    
    # Check memory cache
    if cache_key in _cache:
        return _cache[cache_key]
    
    # Check SQLite cache
    cached = _get_sqlite_cache(cache_key)
    if cached:
        _cache[cache_key] = cached
        return cached
    
    try:
        geolocator = Nominatim(user_agent="para_ph_v2", timeout=10)
        geocode = RateLimiter(geolocator.geocode, min_delay_seconds=1.0, max_retries=2)
        
        # Use Metro Manila viewbox to bias results
        geocode_with_bounds = RateLimiter(
            geolocator.geocode,
            min_delay_seconds=1.0,
            max_retries=2
        )
        location = geocode_with_bounds(
            query,
            exactly_one=True,
            limit=1,
            viewbox=[(14.35, 120.90), (14.80, 121.20)],
            bounded=False
        )
        
        if location:
            lat, lon = location.latitude, location.longitude
            
            # Validate bounds
            if MM_LAT_MIN <= lat <= MM_LAT_MAX and MM_LON_MIN <= lon <= MM_LON_MAX:
                result = {
                    'found': True,
                    'lat': lat,
                    'lon': lon,
                    'display_name': location.address,
                    'query': query
                }
                _cache[cache_key] = result
                _set_sqlite_cache(cache_key, result)
                logger.info(f"✅ Geocoded: '{query}' -> ({lat:.5f}, {lon:.5f})")
                return result
            else:
                logger.warning(f"⚠️ Location outside Metro Manila: {lat}, {lon}")
    except Exception as e:
        logger.warning(f"⚠️ Geocoding failed for '{query}': {e}")
    
    return None

def parse_chat_intent(text: str) -> Dict:
    """Parse chat message for origin/destination or casual questions"""
    text = text.lower().strip()
    
    # Handle greetings and casual questions
    greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'kumusta', 'yo']
    if any(text.startswith(g) for g in greetings):
        return {'intent': 'greeting'}
    
    help_phrases = ['help', 'what can you do', 'how to', 'ano', 'paano', 'tulong']
    if any(h in text for h in help_phrases):
        return {'intent': 'help'}
    
    about_phrases = ['who are you', 'what are you', 'sino ka', 'ano ka']
    if any(a in text for a in about_phrases):
        return {'intent': 'about'}
    
    # Route patterns
    patterns = [
        r'from\s+(.+?)\s+to\s+(.+)',
        r'(.+?)\s+(?:to|papuntang|pa)\s+(.+)',
        r'pumunta\s+(?:ng|sa)\s+(.+?)\s+(?:mula|galing)\s+(?:sa|ng)\s+(.+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            groups = match.groups()
            if len(groups) >= 2:
                # Handle "punta ng X mula sa Y" (reversed)
                if 'mula' in text or 'galing' in text:
                    return {
                        'origin': groups[1].strip(),
                        'destination': groups[0].strip(),
                        'intent': 'route'
                    }
                return {
                    'origin': groups[0].strip(),
                    'destination': groups[1].strip(),
                    'intent': 'route'
                }
    
    # Single location - try to find routes nearby
    single_patterns = [
        r'(?:routes?|jeep(?:ney)?s?|sakayan)\s+(?:near|malapit|sa)\s+(.+)',
        r'(?:ano|what)(?:.*?)(?:jeep|sakay|route)(?:.*?)(?:to|papuntang|sa)\s+(.+)',
    ]
    
    for pattern in single_patterns:
        match = re.search(pattern, text)
        if match:
            return {
                'destination': match.group(1).strip(),
                'intent': 'nearby_routes'
            }
    
    return {'intent': 'unknown', 'text': text}