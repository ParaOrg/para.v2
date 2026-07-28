"""Scrapers for the three external gas-price data sources.

Source split (see conversation / project notes for why):
  - DOE Oil Monitor PDF   -> authoritative "as of" date + aggregate Php range and
                             direction per fuel category. DOE's own weekly advisory
                             never breaks prices down by brand or RON grade, so it
                             cannot feed the per-brand table by itself.
  - fuelprice.ph          -> the only available source with actual per-brand,
                             per-fuel-type settled prices. Its own methodology states
                             it's built from official oil-company advisories
                             cross-checked against the DOE weekly report.
  - Rappler Business RSS  -> supplementary news citation, keyword-filtered for
                             rollback/hike coverage, shown as an "in the news" link.

All three are real, publicly reachable pages (verified live), but none expose a
formal API, so each parser is defensive: partial failures raise GasPriceSourceError
with enough detail to log, and never fabricate a number that wasn't actually found.
"""
import io
import json
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import httpx
import pdfplumber

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
REQUEST_TIMEOUT = 20.0

DOE_LISTING_URL = "https://doe.gov.ph/articles/group/liquid-fuels?category=Oil+Monitor&display_type=Card"
FUELPRICE_PH_URL = "https://www.fuelprice.ph/"
RAPPLER_BUSINESS_RSS_URL = "https://www.rappler.com/business/feed/"

# fuelprice.ph fuel key -> our fuel id. RON97 and Petron XCS aren't tracked by this
# source at all (most brands only publish 91/95) -- those stay unpopulated rather
# than being estimated.
FUELPRICE_FUEL_MAP = {
    "unleaded-91": "ron91",
    "premium-95": "ron95",
    "diesel": "diesel",
    "diesel-plus": "diesel_premium",
    "kerosene": "kerosene",
}

# fuelprice.ph brand name -> our station.brand id (frontend only understands these 7).
FUELPRICE_BRAND_MAP = {
    "Shell": "shell",
    "Petron": "petron",
    "Caltex": "caltex",
    "Seaoil": "seaoil",
    "Total Energies": "total",
    "Cleanfuel": "cleanfuel",
    "PTT": "ptt",
}

NEWS_KEYWORDS = [
    "fuel price", "fuel prices", "pump price", "pump prices", "oil price watch",
    "price rollback", "price hike", "diesel price", "gasoline price", "oil monitor",
]
ROLLBACK_WORDS = ["rollback", "decrease", "lower", "drop", "down", "cut"]
HIKE_WORDS = ["hike", "increase", "higher", "up ", "surge"]


class GasPriceSourceError(Exception):
    pass


def _parse_peso(text: str) -> float:
    """'₱86.74' / 'P86.74' / '86.74' -> 86.74"""
    cleaned = re.sub(r"[^\d.]", "", text)
    return float(cleaned)


def _extract_balanced_json(html: str, marker: str) -> str:
    """Extract a JS object literal starting right after `marker`, by counting
    braces rather than a regex, so embedded '};' style substrings elsewhere in
    the page can't truncate the match early. String literals are skipped over
    (respecting \\-escapes) so a brace *inside* a quoted value -- e.g. a status
    string that happens to contain '}' -- doesn't get miscounted as structural.
    """
    start = html.find(marker)
    if start == -1:
        raise GasPriceSourceError(f"marker not found: {marker!r}")
    start = html.find("{", start)
    if start == -1:
        raise GasPriceSourceError("no '{' after marker")

    depth = 0
    in_string = False
    escaped = False
    for i in range(start, len(html)):
        ch = html[i]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue
        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return html[start:i + 1]
    raise GasPriceSourceError("unbalanced braces while extracting JSON")


# ── DOE Oil Monitor ──────────────────────────────────────────────────────────

def _find_latest_doe_pdf_url(listing_html: str) -> str:
    match = re.search(r'href="(https://prod-cms\.doe\.gov\.ph/documents/d/guest/[^"]+)"', listing_html)
    if not match:
        raise GasPriceSourceError("could not find a DOE oil monitor PDF link on the listing page")
    return match.group(1)


def _parse_doe_pdf_text(text: str) -> dict:
    summary = {
        "as_of_date": None, "effective_start": None, "effective_end": None,
        "gasoline_change_min": None, "gasoline_change_max": None, "gasoline_direction": None,
        "diesel_change_min": None, "diesel_change_max": None, "diesel_direction": None,
        "kerosene_change_min": None, "kerosene_change_max": None, "kerosene_direction": None,
        "ytd_gasoline": None, "ytd_diesel": None, "ytd_kerosene": None,
        "source_url": DOE_LISTING_URL,
    }

    as_of = re.search(r"As of (\d{1,2}\s+\w+\s+\d{4})", text)
    if as_of:
        summary["as_of_date"] = datetime.strptime(as_of.group(1), "%d %B %Y").date().isoformat()

    effective = re.search(
        r"effective\s+(\d{1,2})\s*-\s*(\d{1,2})\s+(\w+)\s+(\d{4})", text
    )
    if effective:
        day_start, day_end, month, year = effective.groups()
        try:
            start = datetime.strptime(f"{day_start} {month} {year}", "%d %B %Y").date()
            end = datetime.strptime(f"{day_end} {month} {year}", "%d %B %Y").date()
            summary["effective_start"], summary["effective_end"] = start.isoformat(), end.isoformat()
        except ValueError:
            pass

    direction_word = re.search(r"Domestic pump prices\s+(increased|decreased|remained unchanged)", text)
    direction = None
    if direction_word:
        word = direction_word.group(1)
        direction = "increase" if word == "increased" else "decrease" if word == "decreased" else "no_change"

    # e.g. "increased by Php3.50 - Php3.65/L for gasoline, Php10.00 - Php10.68/L\nfor diesel,
    #       and Php11.60 - Php 11.77/L for kerosene."
    range_pattern = re.compile(
        r"Php\s*([\d.]+)\s*-\s*Php\s*([\d.]+)\s*/?\s*L\s*for\s+(gasoline|diesel|kerosene)",
        re.IGNORECASE,
    )
    for low, high, category in range_pattern.findall(text):
        key = category.lower()
        summary[f"{key}_change_min"] = float(low)
        summary[f"{key}_change_max"] = float(high)
        summary[f"{key}_direction"] = direction

    for category in ("gasoline", "diesel", "kerosene"):
        ytd = re.search(rf"P\s*([\d.]+)\s*/\s*liter for {category}", text, re.IGNORECASE)
        if ytd:
            summary[f"ytd_{category}"] = float(ytd.group(1))

    return summary


def fetch_doe_weekly_summary(client: httpx.Client | None = None) -> dict:
    """Fetch the latest DOE Oil Monitor PDF and parse its aggregate range summary.
    Raises GasPriceSourceError on any failure -- callers should catch, log, and
    keep serving the last known-good data rather than let this take the API down.
    """
    owns_client = client is None
    client = client or httpx.Client(headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT, follow_redirects=True)
    try:
        listing_resp = client.get(DOE_LISTING_URL)
        listing_resp.raise_for_status()
        pdf_url = _find_latest_doe_pdf_url(listing_resp.text)

        pdf_resp = client.get(pdf_url)
        pdf_resp.raise_for_status()

        text_parts = []
        with pdfplumber.open(io.BytesIO(pdf_resp.content)) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        full_text = "\n".join(text_parts)

        summary = _parse_doe_pdf_text(full_text)
        if not summary["as_of_date"]:
            raise GasPriceSourceError("parsed DOE PDF but found no 'As of' date -- layout may have changed")
        summary["source_url"] = pdf_url
        return summary
    except httpx.HTTPError as e:
        raise GasPriceSourceError(f"DOE fetch failed: {e}") from e
    finally:
        if owns_client:
            client.close()


# ── fuelprice.ph ──────────────────────────────────────────────────────────────

def _parse_fuelprice_verified_date(html: str) -> str | None:
    match = re.search(r"Verified\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})", html)
    if not match:
        return None
    try:
        return datetime.strptime(match.group(1), "%b %d, %Y").date().isoformat()
    except ValueError:
        return None


def fetch_fuelprice_ph_brands(client: httpx.Client | None = None) -> tuple[list[dict], str | None]:
    """Returns (rows, verified_date). Each row: {brand, fuel_id, price, prev_price, status}."""
    owns_client = client is None
    client = client or httpx.Client(headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT, follow_redirects=True)
    try:
        resp = client.get(FUELPRICE_PH_URL)
        resp.raise_for_status()
        html = resp.text

        raw_json = _extract_balanced_json(html, "const brandData =")
        brand_data = json.loads(raw_json)
        verified_date = _parse_fuelprice_verified_date(html)

        rows = []
        for fuel_key, entries in brand_data.items():
            fuel_id = FUELPRICE_FUEL_MAP.get(fuel_key)
            if not fuel_id:
                continue
            for entry in entries:
                brand = FUELPRICE_BRAND_MAP.get(entry.get("n"))
                if not brand:
                    continue
                try:
                    price = _parse_peso(entry["price"])
                except (KeyError, ValueError):
                    continue

                prev_price = None
                chg_match = re.search(r"([\d.]+)", entry.get("chg", ""))
                direction = entry.get("dir")
                if chg_match and direction in ("up", "down"):
                    delta = float(chg_match.group(1))
                    prev_price = price + delta if direction == "down" else price - delta

                rows.append({
                    "brand": brand,
                    "fuel_id": fuel_id,
                    "price": price,
                    "prev_price": prev_price,
                    "status": entry.get("status"),
                })

        if not rows:
            raise GasPriceSourceError("parsed fuelprice.ph but extracted zero brand/fuel rows -- layout may have changed")
        return rows, verified_date
    except httpx.HTTPError as e:
        raise GasPriceSourceError(f"fuelprice.ph fetch failed: {e}") from e
    finally:
        if owns_client:
            client.close()


# ── News (Rappler Business RSS) ─────────────────────────────────────────────

def _classify_direction(text: str) -> str:
    lower = text.lower()
    has_rollback = any(w in lower for w in ROLLBACK_WORDS)
    has_hike = any(w in lower for w in HIKE_WORDS)
    if has_rollback and not has_hike:
        return "rollback"
    if has_hike and not has_rollback:
        return "hike"
    if has_rollback and has_hike:
        return "mixed"
    return "unknown"


def fetch_rappler_fuel_news(client: httpx.Client | None = None, max_age_days: int = 14) -> list[dict]:
    owns_client = client is None
    client = client or httpx.Client(headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT, follow_redirects=True)
    try:
        resp = client.get(RAPPLER_BUSINESS_RSS_URL)
        resp.raise_for_status()
        root = ElementTree.fromstring(resp.content)

        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        matches = []
        for item in root.findall(".//item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            pub_date_raw = item.findtext("pubDate")
            if not title or not link:
                continue

            title_lower = title.lower()
            matched_keywords = [kw for kw in NEWS_KEYWORDS if kw in title_lower]
            if not matched_keywords:
                continue

            published_at = None
            if pub_date_raw:
                try:
                    dt = parsedate_to_datetime(pub_date_raw)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < cutoff:
                        continue
                    published_at = dt.date().isoformat()
                except (TypeError, ValueError):
                    pass

            matches.append({
                "title": title,
                "url": link,
                "published_at": published_at,
                "direction": _classify_direction(title),
                "matched_keywords": ", ".join(matched_keywords),
            })

        return matches
    except (httpx.HTTPError, ElementTree.ParseError) as e:
        raise GasPriceSourceError(f"Rappler RSS fetch failed: {e}") from e
    finally:
        if owns_client:
            client.close()
