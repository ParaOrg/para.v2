import re
import json
import httpx
import os
import sqlite3
import asyncio
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

# --- Config ---
OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.2"
geolocator = Nominatim(user_agent="para_ph_transit_v1.1", timeout=5)

# --- RAG: Load Knowledge Base ---
KB_PATH = "knowledge_base.txt"
KB_CONTEXT = ""
if os.path.exists(KB_PATH):
    with open(KB_PATH, 'r', encoding='utf-8') as f:
        KB_CONTEXT = f.read()

# ==========================================
# 1. INTENT PARSER (Fast Regex First)
# ==========================================
async def parse_chat_intent_async(message: str) -> dict:
    # Try Regex first (Instant)
    message_lower = message.lower()
    info_keywords = ["fare", "schedule", "hours", "magkano", "kailan"]
    if any(kw in message_lower for kw in info_keywords):
        return {"intent": "INFO", "question": message}
        
    patterns = [r"(?:from|mula sa|sa)\s+([a-zA-Z\s]+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang)\s+([a-zA-Z\s]+)", r"([a-zA-Z\s]+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang)\s+([a-zA-Z\s]+)"]
    for pattern in patterns:
        match = re.search(pattern, message_lower)
        if match:
            return {"intent": "ROUTE", "origin": match.group(1).strip(), "destination": match.group(2).strip()}
            
    # Fallback to LLM only if regex fails
    try:
        system_prompt = """Categorize: "ROUTE" (A to B) or "INFO" (Question). Return JSON: {"intent": "...", "origin": "...", "destination": "..."} OR {"intent": "INFO", "question": "..."}"""
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL_NAME,
                "messages": [{"role": "user", "content": f"{system_prompt}\nMessage: '{message}'"}],
                "format": "json", "stream": False, "temperature": 0.1
            })
            if response.status_code == 200:
                return json.loads(response.json().get("message", {}).get("content", ""))
    except: pass
    return {"intent": "INFO", "question": message}

# ==========================================
# 2. RAG: CUSTOMER SERVICE AI
# ==========================================
async def ask_info_llm(question: str) -> str:
    if not KB_CONTEXT: return "Pasensya na, wala pa akong impormasyon tungkol diyan."
    system_prompt = f"Answer STRICTLY using this context: {KB_CONTEXT}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL_NAME,
                "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": question}],
                "stream": False, "temperature": 0.3
            })
            if response.status_code == 200:
                return response.json().get("message", {}).get("content", "May error sa AI.")
    except: return "Pasensya na, hindi ko masagot yan ngayon."

# ==========================================
# 3. LAZY SMART GEOCODER (Async & Fast)
# ==========================================
async def geocode_location(location_name: str) -> tuple:
    if not location_name: return None
    clean_name = location_name.lower().strip()
    
    # Connect to POI cache
    db_poi = sqlite3.connect("para_poi.db")
    cur_poi = db_poi.cursor()
    cur_poi.execute("CREATE TABLE IF NOT EXISTS geocode_cache (query TEXT PRIMARY KEY, lat REAL, lon REAL, display_name TEXT)")
    
    # 1. Check POI Cache (Instant)
    cur_poi.execute("SELECT lat, lon FROM geocode_cache WHERE query = ?", (clean_name,))
    cached = cur_poi.fetchone()
    if cached:
        print(f"📍 [POI CACHE] '{location_name}'")
        db_poi.close()
        return (cached[0], cached[1])
    db_poi.close()

    # 2. Check Llama's Acronym Memory (Instant, no LLM needed!)
    db_ml = sqlite3.connect("para_ml_data.db")
    cur_ml = db_ml.cursor()
    cur_ml.execute("SELECT formal_name FROM acronym_memory WHERE slang = ?", (clean_name,))
    memory = cur_ml.fetchone()
    
    search_query = location_name
    if memory:
        search_query = memory[0]
        print(f"🧠 [LLAMA MEMORY] '{location_name}' remembered as '{search_query}'")
    else:
        db_ml.close()
        # 3. If not in memory, ask Llama to expand it
        print(f"🧠 [ASKING LLAMA] Expanding '{location_name}'...")
        expanded = await _expand_location_queries(location_name)
        
        if expanded and len(expanded) > 0:
            search_query = expanded[0] # Take the first/best guess
            
            # SAVE TO LLAMA MEMORY FOR NEXT TIME!
            db_ml = sqlite3.connect("para_ml_data.db")
            cur_ml = db_ml.cursor()
            cur_ml.execute("INSERT OR IGNORE INTO acronym_memory (slang, formal_name) VALUES (?, ?)", (clean_name, search_query))
            db_ml.commit()
            print(f"💾 [SAVED TO MEMORY] '{location_name}' -> '{search_query}'")
            db_ml.close()
        else:
            db_ml.close()

    # 4. Try Direct Geocode with the formal name
    try:
        location = await asyncio.to_thread(geolocator.geocode, search_query, country_codes='ph')
        if location:
            coords = (location.latitude, location.longitude)
            print(f"✅ [GEOCODED] '{search_query}' -> {coords}")
            
            # Save to POI cache
            db_poi = sqlite3.connect("para_poi.db")
            cur_poi = db_poi.cursor()
            cur_poi.execute("INSERT OR REPLACE INTO geocode_cache (query, lat, lon, display_name) VALUES (?, ?, ?, ?)", 
                            (clean_name, coords[0], coords[1], location.address))
            db_poi.commit()
            db_poi.close()
            return coords
    except Exception as e:
        print(f"⚠️ Geocode error: {e}")

    return None
    
def _save_to_cache(query, lat, lon, name):
    db = sqlite3.connect("para_poi.db")
    cursor = db.cursor()
    cursor.execute("INSERT OR REPLACE INTO geocode_cache (query, lat, lon, display_name) VALUES (?, ?, ?, ?)", (query, lat, lon, name))
    db.commit()
    db.close()

async def _expand_location_queries(location_name: str) -> list:
    try:
        prompt = f"Give 2 formal search queries for '{location_name}' in Philippines. Return JSON array: ['q1', 'q2']"
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL_NAME,
                "messages": [{"role": "user", "content": prompt}],
                "format": "json", "stream": False, "temperature": 0.2
            })
            if response.status_code == 200:
                return json.loads(response.json().get("message", {}).get("content", "[]"))
    except: pass
    return []