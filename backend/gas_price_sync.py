"""Orchestrates the weekly gas-price refresh and blends stored data into the
shape the frontend's /api/v1/gas-prices/blended endpoint returns.

run_gas_price_sync() is the single entry point called by both the APScheduler
job (main.py) and the manual CLI runner (scripts/sync_gas_prices.py), so there
is exactly one code path that writes price data.
"""
from datetime import datetime

import httpx

import gas_price_db as db
from gas_price_sources import (
    GasPriceSourceError,
    fetch_doe_weekly_summary,
    fetch_fuelprice_ph_brands,
    fetch_rappler_fuel_news,
)

FUEL_META = {
    "ron91":          {"label": "Gasoline RON 91", "short": "RON 91"},
    "ron95":          {"label": "Gasoline RON 95", "short": "RON 95"},
    "ron97":          {"label": "Gasoline RON 97", "short": "RON 97"},
    "xcs":            {"label": "Petron XCS",      "short": "XCS"},
    "diesel":         {"label": "Diesel (Common)", "short": "Diesel"},
    "diesel_premium": {"label": "Diesel Premium",  "short": "Premium"},
    "kerosene":       {"label": "Kerosene",         "short": "Kero"},
}

BRAND_META = {
    "shell":     {"name": "Shell",         "color": "#E8C200"},
    "seaoil":    {"name": "SeaOil",        "color": "#1A56DB"},
    "caltex":    {"name": "Caltex",        "color": "#C8102E"},
    "ptt":       {"name": "PTT",           "color": "#009A44"},
    "cleanfuel": {"name": "Cleanfuel",     "color": "#00B2A9"},
    "total":     {"name": "TotalEnergies", "color": "#EF3340"},
    "petron":    {"name": "Petron",        "color": "#003087"},
}

# Data older than this is flagged `stale: true` in the API response rather than
# silently presented as current -- DOE/fuelprice.ph publish weekly, so two missed
# weekly runs is a real signal something's wrong with the pipeline.
STALE_AFTER_DAYS = 10


def run_gas_price_sync() -> dict:
    """Runs all three scrapers against the live sources and persists whatever
    succeeds. Each source is independent: one failing (e.g. a site layout
    change) doesn't block the others, and the last known-good data for that
    source simply stays in place until the next successful run.
    """
    conn = db.get_connection()
    results = {}
    try:
        with httpx.Client(headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            )
        }, timeout=20.0, follow_redirects=True) as client:

            try:
                summary = fetch_doe_weekly_summary(client)
                db.upsert_doe_summary(conn, summary)
                conn.commit()
                db.log_sync(conn, "doe_pdf", "success", f"as_of={summary['as_of_date']}")
                results["doe_pdf"] = "success"
            except GasPriceSourceError as e:
                db.log_sync(conn, "doe_pdf", "error", str(e))
                results["doe_pdf"] = f"error: {e}"

            try:
                rows, verified_date = fetch_fuelprice_ph_brands(client)
                for row in rows:
                    db.upsert_official_price(
                        conn, row["brand"], row["fuel_id"], row["price"],
                        row["prev_price"], row["status"], verified_date,
                    )
                conn.commit()
                db.log_sync(conn, "fuelprice_ph", "success", f"{len(rows)} brand/fuel rows, verified={verified_date}")
                results["fuelprice_ph"] = "success"
            except GasPriceSourceError as e:
                db.log_sync(conn, "fuelprice_ph", "error", str(e))
                results["fuelprice_ph"] = f"error: {e}"

            try:
                news_items = fetch_rappler_fuel_news(client)
                for item in news_items:
                    db.insert_news_item(
                        conn, item["title"], item["url"], item["published_at"],
                        item["direction"], item["matched_keywords"],
                    )
                conn.commit()
                db.log_sync(conn, "rappler_news", "success", f"{len(news_items)} matching articles")
                results["rappler_news"] = "success"
            except GasPriceSourceError as e:
                db.log_sync(conn, "rappler_news", "error", str(e))
                results["rappler_news"] = f"error: {e}"
    finally:
        conn.close()

    return results


def _compute_staleness(content_date_values: list) -> tuple:
    """Staleness has to be judged by how current the *published* data is
    (verified_date / as_of_date), not by when our scraper last ran -- a scrape
    that runs today but finds a source that hasn't published in 7 weeks is
    still stale, even though fetched_at says "today".
    """
    parsed = []
    for v in content_date_values:
        if not v:
            continue
        try:
            parsed.append(datetime.fromisoformat(v))
        except (TypeError, ValueError):
            continue
    if not parsed:
        return True, None
    newest = max(parsed)
    age_days = (datetime.utcnow() - newest).days
    return age_days > STALE_AFTER_DAYS, age_days


def blend_gas_prices(conn=None) -> dict:
    """Builds the /api/v1/gas-prices/blended response: brand-level official
    prices (from fuelprice.ph) blended with community reports (3+ within 7
    days replaces the official figure for that brand+fuel, per the page's own
    stated policy), plus DOE's aggregate range for context.
    """
    owns_conn = conn is None
    conn = conn or db.get_connection()
    try:
        official_rows = db.get_official_prices(conn)
        doe_summary = db.get_latest_doe_summary(conn)
        community_by_brand = db.get_community_prices_by_brand(conn)
        news = db.get_latest_news(conn, limit=1)

        # brand -> fuel_id -> {price, prev_price, source}
        blended_by_brand: dict = {}
        used_community = False
        for row in official_rows:
            brand, fuel_id = row["brand"], row["fuel_id"]
            entry = {"price": row["price"], "prev_price": row["prev_price"], "source": "official"}

            community = community_by_brand.get(brand, {}).get(fuel_id)
            if community:
                entry = {
                    "price": community["community_avg"],
                    "prev_price": row["price"],  # last official price becomes the comparison baseline
                    "source": "community",
                }
                used_community = True

            blended_by_brand.setdefault(brand, {})[fuel_id] = entry

        stations = []
        for brand, meta in BRAND_META.items():
            prices = blended_by_brand.get(brand, {})
            if not prices:
                continue
            stations.append({"id": brand, "name": meta["name"], "color": meta["color"], "prices": prices})

        # Averages: mean price/prev_price per fuel across brands that have data.
        averages = []
        for fuel_id, meta in FUEL_META.items():
            values = [
                (s["prices"][fuel_id]["price"], s["prices"][fuel_id]["prev_price"])
                for s in stations if fuel_id in s["prices"]
            ]
            if not values:
                continue
            prices_only = [p for p, _ in values]
            prev_only = [pp for _, pp in values if pp is not None]
            averages.append({
                "id": fuel_id,
                "label": meta["label"],
                "short": meta["short"],
                "price": round(sum(prices_only) / len(prices_only), 2),
                "prev_price": round(sum(prev_only) / len(prev_only), 2) if prev_only else None,
            })

        # Judged against the per-brand grid data specifically (fuelprice.ph's
        # verified_date) since that's what `averages`/`stations` below actually
        # render -- DOE's own as_of_date can be current even when fuelprice.ph's
        # brand breakdown has gone stale, and averaging the two together would
        # mask exactly that gap.
        content_dates = [r.get("verified_date") for r in official_rows]
        stale, age_days = _compute_staleness(content_dates)

        if doe_summary and doe_summary.get("as_of_date"):
            last_updated = datetime.fromisoformat(doe_summary["as_of_date"]).strftime("%B %d, %Y")
        else:
            last_updated = "unknown"

        source = "DOE Oil Monitor + fuelprice.ph"
        if used_community:
            source += " + Community Reports"

        return {
            "source": source,
            "last_updated": last_updated,
            "stale": stale,
            "data_age_days": age_days,
            "averages": averages,
            "stations": stations,
            "doe_summary": doe_summary,
            "news": news,
        }
    finally:
        if owns_conn:
            conn.close()
