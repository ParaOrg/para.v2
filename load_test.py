"""
Load test — 10k concurrent users hitting all endpoints.
"""

import asyncio
import aiohttp
import json
import random
import time
from datetime import datetime

API = "https://para-ph-api.onrender.com"
TOTAL_USERS = 10000
CONCURRENCY = 100  # parallel requests

results = {
    "health": {"ok": 0, "fail": 0, "latency": []},
    "signup": {"ok": 0, "fail": 0, "latency": []},
    "commute_save": {"ok": 0, "fail": 0, "latency": []},
    "fare_report": {"ok": 0, "fail": 0, "latency": []},
    "community_thread": {"ok": 0, "fail": 0, "latency": []},
    "poi_add": {"ok": 0, "fail": 0, "latency": []},
    "routes_public": {"ok": 0, "fail": 0, "latency": []},
    "fare_stats": {"ok": 0, "fail": 0, "latency": []},
}

async def do_request(session, method, url, data=None):
    start = time.time()
    try:
        if method == "GET":
            async with session.get(url) as res:
                latency = time.time() - start
                return res.status, latency
        else:
            async with session.post(url, json=data) as res:
                latency = time.time() - start
                return res.status, latency
    except Exception as e:
        return 0, time.time() - start

async def simulate_user(session, user_id):
    email = f"load-{user_id}@test.com"
    phone = f"0917{user_id:07d}"
    tasks = []

    # Health
    status, lat = await do_request(session, "GET", f"{API}/health")
    results["health"]["ok" if status == 200 else "fail"] += 1
    results["health"]["latency"].append(lat)

    # Signup
    status, lat = await do_request(session, "POST", f"{API}/auth/signup", {"email": email, "name": f"User{user_id}"})
    results["signup"]["ok" if status == 200 else "fail"] += 1
    results["signup"]["latency"].append(lat)

    # Commute save
    status, lat = await do_request(session, "POST", f"{API}/commute/save", {
        "client_log_id": f"load-{user_id}-{int(time.time())}",
        "route_name": "Load Test Route",
        "user_email": email,
        "total_time_sec": random.randint(60, 3600),
    })
    results["commute_save"]["ok" if status == 200 else "fail"] += 1
    results["commute_save"]["latency"].append(lat)

    # Fare report
    status, lat = await do_request(session, "POST", f"{API}/fare/report", {
        "user_email": email,
        "mode": random.choice(["jeepney", "bus", "train"]),
        "fare_amount": random.uniform(10, 50),
        "city": "Metro Manila",
    })
    results["fare_report"]["ok" if status == 200 else "fail"] += 1
    results["fare_report"]["latency"].append(lat)

    # Community thread
    status, lat = await do_request(session, "POST", f"{API}/community/threads", {
        "user_email": email,
        "author_name": f"User{user_id}",
        "title": f"Load Test {user_id}",
        "content": "Testing",
    })
    results["community_thread"]["ok" if status == 200 else "fail"] += 1
    results["community_thread"]["latency"].append(lat)

    # POI add
    status, lat = await do_request(session, "POST", f"{API}/poi/add", {
        "canonical_name": f"Load POI {user_id}",
        "category": "test",
        "lat": 14.5 + random.random(),
        "lng": 120.9 + random.random(),
    })
    results["poi_add"]["ok" if status == 200 else "fail"] += 1
    results["poi_add"]["latency"].append(lat)

    # Routes public
    status, lat = await do_request(session, "GET", f"{API}/routes/public")
    results["routes_public"]["ok" if status == 200 else "fail"] += 1
    results["routes_public"]["latency"].append(lat)

    # Fare stats
    status, lat = await do_request(session, "GET", f"{API}/fare/stats?city=Metro%20Manila")
    results["fare_stats"]["ok" if status == 200 else "fail"] += 1
    results["fare_stats"]["latency"].append(lat)

async def main():
    print(f"🔥 Load test: {TOTAL_USERS} users, {CONCURRENCY} concurrent")
    print(f"⏱  Start: {datetime.now().strftime('%H:%M:%S')}")
    start_time = time.time()

    semaphore = asyncio.Semaphore(CONCURRENCY)
    connector = aiohttp.TCPConnector(limit=CONCURRENCY)

    async with aiohttp.ClientSession(connector=connector) as session:
        async def bounded(user_id):
            async with semaphore:
                await simulate_user(session, user_id)

        # Process in batches
        batch_size = 100
        for batch_start in range(0, TOTAL_USERS, batch_size):
            batch = range(batch_start, min(batch_start + batch_size, TOTAL_USERS))
            await asyncio.gather(*[bounded(i) for i in batch])
            if (batch_start + batch_size) % 1000 == 0:
                elapsed = time.time() - start_time
                print(f"  {batch_start + batch_size}/{TOTAL_USERS} done ({elapsed:.0f}s)")

    elapsed = time.time() - start_time
    print(f"\n⏱  Complete: {elapsed:.1f}s")
    print(f"📊 Rate: {TOTAL_USERS / elapsed:.0f} users/sec")
    print(f"\n{'Endpoint':<20} {'OK':<6} {'Fail':<6} {'Avg Lat':<10} {'Max Lat'}")
    print("-" * 55)
    for name, r in results.items():
        avg = sum(r["latency"]) / max(len(r["latency"]), 1) * 1000
        mx = max(r["latency"]) * 1000 if r["latency"] else 0
        print(f"{name:<20} {r['ok']:<6} {r['fail']:<6} {avg:.0f}ms     {mx:.0f}ms")

if __name__ == "__main__":
    asyncio.run(main())
