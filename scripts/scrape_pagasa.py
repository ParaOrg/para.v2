#!/usr/bin/env python3
"""
PAGASA Advisory Scraper — Article-based
Fetches PAGASA articles/press releases with advisory content
"""

import re
import json
import sys
from datetime import datetime

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Run: source scripts/.venv/bin/activate && pip install requests beautifulsoup4")
    sys.exit(1)

# Comprehensive PAGASA article/press release URLs
ARTICLE_URLS = [
    # Tropical Cyclones
    "https://pagasa.dost.gov.ph/article/222",  # Tropical Storm Maymay
    # Weather Outlooks
    "https://pagasa.dost.gov.ph/article/220",  # SONA Weather Outlook
    "https://pagasa.dost.gov.ph/article/218",  # Independence Day
    "https://pagasa.dost.gov.ph/article/212",  # Undas 2025
    "https://pagasa.dost.gov.ph/article/210",  # Labor Day
    # Press Releases
    "https://pagasa.dost.gov.ph/press-release/219",  # Typhoon and Flood Awareness Week
    "https://pagasa.dost.gov.ph/press-release/217",  # Independence Day Weather
    "https://pagasa.dost.gov.ph/press-release/216",  # El Nino Advisory
    "https://pagasa.dost.gov.ph/press-release/214",  # Onset of Rainy Season
    "https://pagasa.dost.gov.ph/press-release/213",  # Southwest Monsoon
]

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
})

advisories = []

for url in ARTICLE_URLS:
    try:
        res = session.get(url, timeout=15)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, "html.parser")

        # Title from article-content div
        title_div = soup.find("div", class_="article-content")
        title = title_div.get_text(strip=True) if title_div else "PAGASA Advisory"

        # Clean title — cut at date pattern
        title = re.split(r"\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}", title)[0].strip()
        title = title[:80]

        # Body from content-container
        body_div = soup.find("div", class_="content-container")
        if body_div:
            description = body_div.get_text(strip=True)[:300]
        else:
            panel = soup.find("div", class_="panel-pagasa")
            description = panel.get_text(strip=True)[:300] if panel else title

        if len(description) > 30 and "browser does not support" not in description:
            advisories.append({
                "id": f"pagasa-{len(advisories) + 1}",
                "type": "Weather",
                "accent": "#F93F74",
                "bg": "rgba(249, 63, 116, 0.1)",
                "title": title,
                "description": description,
                "updated": "PAGASA Official",
                "source_url": url,
                "source_name": "PAGASA",
            })
            print(f"OK: {title[:60]}")
    except Exception as e:
        print(f"FAIL: {url} — {e}")

result = {
    "advisories": advisories[:10],
    "scraped_at": datetime.now().isoformat(),
    "source": "PAGASA Articles",
}

with open("src/utils/pagasaAdvisories.json", "w") as f:
    json.dump(result, f, indent=2, ensure_ascii=False)

print(f"\nSaved {len(advisories)} advisories")
