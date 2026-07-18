import re
import json
import httpx
import sqlite3

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL_NAME = "llama3.2"

async def parse_user_intent_async(message: str) -> dict:
    try:
        system_prompt = "Extract origin and destination. Return JSON: {'origin': '', 'destination': ''}"
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL_NAME,
                "messages": [{"role": "user", "content": f"{system_prompt}\nMessage: '{message}'"}],
                "format": "json", "stream": False, "temperature": 0.1
            })
            if response.status_code == 200:
                content = response.json().get("message", {}).get("content", "")
                llm_intent = json.loads(content)
                origin = llm_intent.get("origin", "").strip()
                destination = llm_intent.get("destination", "").strip()
                if origin and destination:
                    print(f"🧠 LLM Success: Origin='{origin}', Dest='{destination}'")
                    return {"origin": origin, "destination": destination}
    except Exception as e:
        print(f"⚠️ LLM Offline ({e}). Falling back to regex...")

    return _regex_fallback(message)

def _regex_fallback(message: str) -> dict:
    message_lower = message.lower()
    patterns = [
        r"(?:from|mula sa|sa)\s+([a-zA-Z\s]+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang)\s+([a-zA-Z\s]+)",
        r"([a-zA-Z\s]+?)\s+(?:to|papuntang|pa-|tungo sa|hanggang)\s+([a-zA-Z\s]+)"
    ]
    for pattern in patterns:
        match = re.search(pattern, message_lower)
        if match:
            return {"origin": match.group(1).strip(), "destination": match.group(2).strip()}
            
    return {"origin": "current location", "destination": "ayala"}

def geocode_location(location_name: str) -> tuple:
    """
    Queries the SQLite POI database for exact coordinates.
    """
    if not location_name or location_name.lower() == "current location":
        print("📍 Defaulting to 'current location' (Ateneo/Katipunan)")
        return (14.6375, 121.0756)

    try:
        db = sqlite3.connect("para_poi.db")
        cursor = db.cursor()
        # Search for the name. ORDER BY LENGTH ensures exact matches rank higher.
        cursor.execute("""
            SELECT lat, lon FROM locations 
            WHERE name LIKE ? 
            ORDER BY LENGTH(name) ASC 
            LIMIT 1
        """, (f"%{location_name}%",))
        result = cursor.fetchone()
        db.close()
        
        if result:
            lat, lon = result
            print(f"📍 DB Match: '{location_name}' -> ({lat}, {lon})")
            return (lat, lon)
    except Exception as e:
        print(f"⚠️ DB Error: {e}")

    print(f"⚠️ WARNING: Could not find '{location_name}' in the POI database.")
    return None