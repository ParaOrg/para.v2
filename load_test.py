"""
Load test: 1000 concurrent users hitting the /chat endpoint with text queries.
"""

import asyncio
import aiohttp
import time
import random
from collections import defaultdict

BASE_URL = "https://para-ph-api.onrender.com"
CONCURRENT_USERS = 1000
TIMEOUT_SECONDS = 30

TEST_MESSAGES = [
    "from Cubao to Makati",
    "from Alabang to Quezon City",
    "from Pasay to Manila",
    "from BGC to Ortigas",
    "from Fairview to Baclaran",
    "from Sucat to Monumento",
    "from Recto to Santolan",
    "from Taft to Cubao",
    "from Ayala to Lagro",
    "from Novaliches to EDSA",
]

results = defaultdict(list)
latencies = []
errors = []
status_codes = defaultdict(int)

async def send_request(session, user_id):
    message = random.choice(TEST_MESSAGES)
    url = f"{BASE_URL}/chat"
    payload = {
        "message": message,
        "user_id": f"loadtest_{user_id}",
    }
    
    start = time.time()
    try:
        async with session.post(url, json=payload, timeout=TIMEOUT_SECONDS) as resp:
            latency_ms = (time.time() - start) * 1000
            latencies.append(latency_ms)
            status_codes[resp.status] += 1
            
            if resp.status == 200:
                data = await resp.json()
                has_route = bool(data.get("route_data"))
                results["route_found"].append(1 if has_route else 0)
            else:
                body = await resp.text()
                errors.append(f"User {user_id}: HTTP {resp.status} - {body[:200]}")
    except asyncio.TimeoutError:
        latencies.append(TIMEOUT_SECONDS * 1000)
        errors.append(f"User {user_id}: TIMEOUT after {TIMEOUT_SECONDS}s")
        status_codes["timeout"] += 1
    except Exception as e:
        latencies.append((time.time() - start) * 1000)
        errors.append(f"User {user_id}: {type(e).__name__}: {e}")
        status_codes["error"] += 1

async def main():
    print(f"🚀 Starting load test: {CONCURRENT_USERS} concurrent users")
    print(f"📍 Target: {BASE_URL}/chat")
    print(f"📊 {len(TEST_MESSAGES)} unique text queries")
    print()
    
    start_time = time.time()
    
    connector = aiohttp.TCPConnector(limit=CONCURRENT_USERS, limit_per_host=CONCURRENT_USERS)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [send_request(session, i) for i in range(CONCURRENT_USERS)]
        await asyncio.gather(*tasks)
    
    total_time = time.time() - start_time
    
    print("=" * 60)
    print("📊 LOAD TEST REPORT")
    print("=" * 60)
    print(f"Total users:        {CONCURRENT_USERS}")
    print(f"Total time:         {total_time:.2f}s")
    print(f"Requests/sec:       {CONCURRENT_USERS / total_time:.1f}")
    print()
    
    print("Status codes:")
    for code, count in sorted(status_codes.items(), key=lambda x: str(x[0])):
        print(f"  {code}: {count}")
    print()
    
    if latencies:
        latencies_sorted = sorted(latencies)
        print("Latency (ms):")
        print(f"  Min:     {latencies_sorted[0]:.0f}")
        print(f"  Median:  {latencies_sorted[len(latencies_sorted)//2]:.0f}")
        print(f"  P90:     {latencies_sorted[int(len(latencies_sorted)*0.9)]:.0f}")
        print(f"  P95:     {latencies_sorted[int(len(latencies_sorted)*0.95)]:.0f}")
        print(f"  P99:     {latencies_sorted[int(len(latencies_sorted)*0.99)]:.0f}")
        print(f"  Max:     {latencies_sorted[-1]:.0f}")
    print()
    
    if results.get("route_found"):
        found = sum(results["route_found"])
        total = len(results["route_found"])
        print(f"Routes found: {found}/{total} ({found/total*100:.0f}%)")
    print()
    
    if errors:
        print(f"❌ Errors: {len(errors)}")
        for err in errors[:10]:
            print(f"   {err}")
        if len(errors) > 10:
            print(f"   ...and {len(errors) - 10} more")
    else:
        print("✅ No errors")

if __name__ == "__main__":
    asyncio.run(main())
