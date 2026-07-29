import re
import json
import httpx
import os
import sqlite3
import asyncio
from geopy.geocoders import Nominatim

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.2"
geolocator = Nominatim(user_agent="para_ph_transit_v1.1", timeout=5)
GEO_DB = "para_geo_knowledge.db"

KB_PATH = "knowledge_base.txt"
KB_CONTEXT = ""
if os.path.exists(KB_PATH):
    with open(KB_PATH, 'r', encoding='utf-8') as f:
        KB_CONTEXT = f.read()

# ═══════════════════════════════════════════════
# INTENT PARSER
# ═══════════════════════════════════════════════
async def parse_chat_intent_async(message: str) -> dict:
    msg = message.lower()
    if any(kw in msg for kw in ["fare","schedule","hours","magkano","kailan","operating"]):
        return {"intent":"INFO","question":message}
    patterns = [
        r"(?:from|mula sa|sa|galing)\s+(.+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang|punta)\s+(.+)",
        r"(.+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang|punta)\s+(.+)"
    ]
    for p in patterns:
        m = re.search(p, msg)
        if m:
            return {"intent":"ROUTE","origin":m.group(1).strip(),"destination":m.group(2).strip()}
    try:
        async with httpx.AsyncClient(timeout=5.0) as c:
            r = await c.post(OLLAMA_URL, json={"model":MODEL_NAME,"messages":[{"role":"user","content":f'Classify: "ROUTE" (from A to B) or "INFO" (question). Return JSON: {{"intent":"ROUTE","origin":"...","destination":"..."}} or {{"intent":"INFO","question":"..."}}\nMessage: "{message}"'}],"format":"json","stream":False,"temperature":0})
            if r.status_code==200:
                return json.loads(r.json().get("message",{}).get("content","{}"))
    except: pass
    return {"intent":"INFO","question":message}

# ═══════════════════════════════════════════════
# RAG CUSTOMER SERVICE
# ═══════════════════════════════════════════════
async def ask_info_llm(question: str) -> str:
    if not KB_CONTEXT: return "Wala pang impormasyon."
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.post(OLLAMA_URL, json={"model":MODEL_NAME,"messages":[{"role":"system","content":f"Answer using this: {KB_CONTEXT}"},{"role":"user","content":question}],"stream":False,"temperature":0.3})
            if r.status_code==200: return r.json().get("message",{}).get("content","")
    except: pass
    return "Hindi masagot ngayon."

# ═══════════════════════════════════════════════
# LLM NAME EXPANDER (returns formal name only)
# ═══════════════════════════════════════════════
async def _llm_geocode(location_name: str) -> str:
    clean = location_name.lower().strip()
    
    # 1. Exact DB match
    db = sqlite3.connect(GEO_DB)
    c = db.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS geo_knowledge (slang TEXT PRIMARY KEY, formal_name TEXT, area TEXT, lat REAL, lng REAL, category TEXT)")
    c.execute("SELECT formal_name FROM geo_knowledge WHERE slang=?", (clean,))
    row = c.fetchone()
    db.close()
    if row: return row[0]
    
    # 2. Partial match
    db = sqlite3.connect(GEO_DB)
    c = db.cursor()
    c.execute("SELECT formal_name FROM geo_knowledge WHERE slang LIKE ? OR formal_name LIKE ? LIMIT 1", (f"%{clean}%", f"%{clean}%"))
    row = c.fetchone()
    db.close()
    if row: return row[0]
    
    # 3. LLM expansion
    db = sqlite3.connect(GEO_DB)
    c = db.cursor()
    c.execute("SELECT slang, formal_name FROM geo_knowledge ORDER BY category LIMIT 30")
    db_knowledge = "\n".join([f"- {r[0]} → {r[1]}" for r in c.fetchall()])
    db.close()
    
    prompt = f"""Convert this location reference to a formal Metro Manila place name. Return ONLY the name.

Known mappings:
{db_knowledge}

Input: "{location_name}"
Name:"""
    
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            r = await c.post(OLLAMA_URL, json={
                "model": MODEL_NAME, "messages": [{"role":"user","content":prompt}],
                "stream": False, "temperature": 0.1
            })
            if r.status_code == 200:
                name = r.json().get("message",{}).get("content","").strip().strip('"')
                if name and name.lower() != clean:
                    db = sqlite3.connect(GEO_DB)
                    db.execute("INSERT OR IGNORE INTO geo_knowledge (slang, formal_name, category) VALUES (?,?,?)", (clean, name, "llm"))
                    db.commit(); db.close()
                    print(f"💾 [LEARNED] '{clean}' -> '{name}'")
                    return name
    except: pass
    return location_name

# ═══════════════════════════════════════════════
# SMART GEOCODER (LLM name + Nominatim coords)
# ═══════════════════════════════════════════════
async def geocode_location(location_name: str) -> tuple:
    if not location_name: return None
    clean = location_name.lower().strip()
    
    # 1. POI Cache
    db = sqlite3.connect("para_poi.db")
    c = db.cursor()
    c.execute("CREATE TABLE IF NOT EXISTS geocode_cache (query TEXT PRIMARY KEY, lat REAL, lon REAL, display_name TEXT)")
    c.execute("SELECT lat,lon FROM geocode_cache WHERE query=?",(clean,))
    row = c.fetchone()
    if row:
        print(f"📍 [CACHE] '{location_name}'")
        db.close()
        return (row[0],row[1])
    db.close()
    
    # 2. Acronym Memory (with coords)
    db = sqlite3.connect("para_ml_data.db")
    c = db.cursor()
    c.execute("SELECT formal_name,lat,lng FROM acronym_memory WHERE slang=?",(clean,))
    row = c.fetchone()
    db.close()
    if row and row[1] and row[2]:
        print(f"🧠 [MEMORY] '{location_name}' -> {row[0]}")
        return (row[1],row[2])
    
    # 3. LLM expands name → Nominatim geocodes it
    print(f"🧠 [LLM GEO] '{location_name}'...")
    formal = await _llm_geocode(location_name)
    print(f"   -> '{formal}'")
    
    if formal.lower() != clean:
        db = sqlite3.connect("para_ml_data.db")
        db.execute("INSERT OR REPLACE INTO acronym_memory (slang, formal_name) VALUES (?,?)", (clean, formal))
        db.commit(); db.close()
        print(f"💾 [SAVED] '{location_name}' -> '{formal}'")
    
    try:
        loc = await asyncio.to_thread(geolocator.geocode, f"{formal}, Metro Manila, Philippines")
        if loc:
            coords = (loc.latitude, loc.longitude)
            print(f"✅ [GEOCODED] '{formal}' -> {coords}")
            db = sqlite3.connect("para_poi.db")
            db.execute("INSERT OR REPLACE INTO geocode_cache VALUES (?,?,?,?)", (clean, coords[0], coords[1], loc.address))
            db.commit(); db.close()
            db = sqlite3.connect("para_ml_data.db")
            db.execute("UPDATE acronym_memory SET lat=?, lng=? WHERE slang=?", (coords[0], coords[1], clean))
            db.commit(); db.close()
            return coords
    except Exception as e:
        print(f"⚠️ Geocode error: {e}")
    
    return None