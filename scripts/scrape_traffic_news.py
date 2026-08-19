#!/usr/bin/env python3
"""
Traffic & Transport News Scraper — Free RSS Feeds
No API key required
"""

import json
import re
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Run: source scripts/.venv/bin/activate && pip install requests beautifulsoup4")
    exit(1)

# Free RSS feeds — no API key needed
RSS_FEEDS = [
    # Metro Manila traffic
    "https://news.google.com/rss/search?q=Metro+Manila+traffic+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
    # EDSA traffic
    "https://news.google.com/rss/search?q=EDSA+traffic+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
    # MMDA advisories
    "https://news.google.com/rss/search?q=MMDA+advisory+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
    # LRT/MRT news
    "https://news.google.com/rss/search?q=LRT+MRT+news+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
    # Jeepney modernization
    "https://news.google.com/rss/search?q=jeepney+modernization+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
    # Transport strike
    "https://news.google.com/rss/search?q=transport+strike+Philippines+when:2d&hl=en-PH&gl=PH&ceid=PH:en",
]

session = requests.Session()
session.headers.update({"User-Agent": "Mozilla/5.0"})

advisories = []

for feed_url in RSS_FEEDS:
    try:
        res = session.get(feed_url, timeout=15)
        soup = BeautifulSoup(res.text, "xml")

        items = soup.find_all("item")[:5]  # Top 5 per feed

        for item in items:
            title = item.find("title").get_text(strip=True) if item.find("title") else "Traffic News"
            link = item.find("link").get_text(strip=True) if item.find("link") else ""
            pub_date = item.find("pubDate")
            updated = pub_date.get_text(strip=True) if pub_date else "Recent"

            description = item.find("description")
            desc_text = description.get_text(strip=True) if description else title
            # Strip HTML tags from description
            desc_soup = BeautifulSoup(desc_text, "html.parser")
            desc_text = desc_soup.get_text(strip=True)[:200]

            # Classify
            combined = (title + " " + desc_text).lower()
            if any(kw in combined for kw in ["traffic", "congestion", "accident", "road", "mmda", "edsa", "jeep", "lrt", "mrt", "train", "bus", "transport", "strike"]):
                advisories.append({
                    "id": f"traffic-{len(advisories) + 1}",
                    "type": "Traffic",
                    "accent": "#F1BA0F",
                    "bg": "rgba(255, 204, 0, 0.1)",
                    "title": title[:80],
                    "description": desc_text,
                    "updated": updated,
                    "source_url": link,
                    "source_name": "Google News",
                })
                print(f"OK: {title[:60]}")
    except Exception as e:
        print(f"FAIL: {feed_url} — {e}")

result = {
    "advisories": advisories[:10],
    "scraped_at": datetime.now().isoformat(),
    "source": "Google News RSS",
}

with open("src/utils/trafficAdvisories.json", "w") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"\nSaved {len(advisories)} traffic advisories")
