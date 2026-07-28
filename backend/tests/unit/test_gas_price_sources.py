from pathlib import Path

import httpx
import pdfplumber
import pytest
import respx

import gas_price_sources as sources

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures_gas"


def _read(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


class TestParsePeso:
    @pytest.mark.parametrize("raw,expected", [
        ("₱86.74", 86.74),
        ("P86.74", 86.74),
        ("86.74", 86.74),
        ("₱1,530", 1530.0),
    ])
    def test_strips_currency_symbols_and_commas(self, raw, expected):
        assert sources._parse_peso(raw) == expected


class TestExtractBalancedJson:
    def test_extracts_object_stopping_at_matching_brace(self):
        html = 'const brandData = {"a": {"b": 1}, "c": "});"};\nmore html'
        result = sources._extract_balanced_json(html, "const brandData =")
        assert result == '{"a": {"b": 1}, "c": "});"}'

    def test_raises_when_marker_missing(self):
        with pytest.raises(sources.GasPriceSourceError):
            sources._extract_balanced_json("<html></html>", "const brandData =")


class TestDoePdfParsing:
    """Parses the real DOE Oil Monitor PDF fixture (downloaded live, verified
    2026-07-27) end to end through pdfplumber, so this test breaks the moment
    DOE's actual wording/layout drifts from what the parser expects.
    """

    @pytest.fixture(scope="class")
    def pdf_text(self):
        with pdfplumber.open(FIXTURES_DIR / "doe_oil_monitor_sample.pdf") as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)

    def test_parses_as_of_date(self, pdf_text):
        summary = sources._parse_doe_pdf_text(pdf_text)
        assert summary["as_of_date"] == "2026-07-21"

    def test_parses_effective_range(self, pdf_text):
        summary = sources._parse_doe_pdf_text(pdf_text)
        assert summary["effective_start"] == "2026-07-21"
        assert summary["effective_end"] == "2026-07-27"

    def test_parses_direction_and_ranges_per_category(self, pdf_text):
        summary = sources._parse_doe_pdf_text(pdf_text)
        assert summary["gasoline_direction"] == "increase"
        assert summary["gasoline_change_min"] == 3.5
        assert summary["gasoline_change_max"] == 3.65
        assert summary["diesel_direction"] == "increase"
        assert summary["diesel_change_min"] == 10.0
        assert summary["diesel_change_max"] == 10.68
        assert summary["kerosene_direction"] == "increase"
        assert summary["kerosene_change_min"] == 11.6
        assert summary["kerosene_change_max"] == 11.77

    def test_parses_year_to_date_totals(self, pdf_text):
        summary = sources._parse_doe_pdf_text(pdf_text)
        assert summary["ytd_gasoline"] == 49.92
        assert summary["ytd_diesel"] == 50.43
        assert summary["ytd_kerosene"] == 48.39

    def test_missing_as_of_date_does_not_crash(self):
        summary = sources._parse_doe_pdf_text("some unrelated PDF text with no dates")
        assert summary["as_of_date"] is None
        assert summary["gasoline_direction"] is None


class TestFetchDoeWeeklySummary:
    def test_fetches_listing_then_pdf_and_parses(self):
        pdf_bytes = (FIXTURES_DIR / "doe_oil_monitor_sample.pdf").read_bytes()
        listing_html = _read("doe_listing_sample.html")

        with respx.mock:
            respx.get(sources.DOE_LISTING_URL).mock(return_value=httpx.Response(200, text=listing_html))
            respx.get(url__regex=r"https://prod-cms\.doe\.gov\.ph/.*").mock(
                return_value=httpx.Response(200, content=pdf_bytes)
            )
            summary = sources.fetch_doe_weekly_summary()

        assert summary["as_of_date"] == "2026-07-21"
        assert summary["source_url"].startswith("https://prod-cms.doe.gov.ph/")

    def test_raises_gas_price_source_error_on_http_failure(self):
        with respx.mock:
            respx.get(sources.DOE_LISTING_URL).mock(side_effect=httpx.ConnectError("unreachable"))
            with pytest.raises(sources.GasPriceSourceError):
                sources.fetch_doe_weekly_summary()

    def test_raises_when_no_pdf_link_found(self):
        with respx.mock:
            respx.get(sources.DOE_LISTING_URL).mock(return_value=httpx.Response(200, text="<html>no pdf here</html>"))
            with pytest.raises(sources.GasPriceSourceError):
                sources.fetch_doe_weekly_summary()


class TestFetchFuelpricePhBrands:
    def test_parses_real_fixture_into_rows(self):
        html = _read("fuelprice_ph_sample.html")
        with respx.mock:
            respx.get(sources.FUELPRICE_PH_URL).mock(return_value=httpx.Response(200, text=html))
            rows, verified_date = sources.fetch_fuelprice_ph_brands()

        assert verified_date == "2026-06-02"
        assert len(rows) > 0
        assert all(row["brand"] in sources.FUELPRICE_BRAND_MAP.values() for row in rows)
        assert all(row["fuel_id"] in sources.FUELPRICE_FUEL_MAP.values() for row in rows)

        shell_ron91 = next(r for r in rows if r["brand"] == "shell" and r["fuel_id"] == "ron91")
        assert shell_ron91["price"] == 86.74
        assert shell_ron91["status"] == "Settled"
        # dir="down", chg="↓ ₱4.76" -> price went DOWN from a higher previous price
        assert shell_ron91["prev_price"] == pytest.approx(86.74 + 4.76)

    def test_ignores_brands_and_fuels_outside_frontend_support(self):
        html = _read("fuelprice_ph_sample.html")
        with respx.mock:
            respx.get(sources.FUELPRICE_PH_URL).mock(return_value=httpx.Response(200, text=html))
            rows, _ = sources.fetch_fuelprice_ph_brands()

        # Flying V/Jetti/etc. aren't in the frontend's 7-brand set; lpg isn't a tracked fuel row.
        assert not any(row["fuel_id"] == "lpg" for row in rows)
        brands_seen = {row["brand"] for row in rows}
        assert brands_seen.issubset(set(sources.FUELPRICE_BRAND_MAP.values()))

    def test_raises_when_brand_data_script_missing(self):
        with respx.mock:
            respx.get(sources.FUELPRICE_PH_URL).mock(return_value=httpx.Response(200, text="<html>redesigned page</html>"))
            with pytest.raises(sources.GasPriceSourceError):
                sources.fetch_fuelprice_ph_brands()


class TestFetchRapplerFuelNews:
    def test_real_fixture_currently_has_no_matching_headlines(self):
        # Confirms the keyword filter doesn't false-positive on an ordinary
        # business-desk RSS feed with no fuel-price coverage in it.
        xml_bytes = (FIXTURES_DIR / "rappler_business_sample.xml").read_bytes()
        with respx.mock:
            respx.get(sources.RAPPLER_BUSINESS_RSS_URL).mock(return_value=httpx.Response(200, content=xml_bytes))
            matches = sources.fetch_rappler_fuel_news()
        assert matches == []

    def test_matches_and_classifies_a_rollback_headline(self):
        from email.utils import format_datetime
        from datetime import datetime, timezone

        pub_date = format_datetime(datetime.now(timezone.utc))
        rss = f"""<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <item>
            <title>Big fuel price rollback set for Tuesday</title>
            <link>https://www.rappler.com/business/fuel-rollback-example/</link>
            <pubDate>{pub_date}</pubDate>
          </item>
          <item>
            <title>Unrelated story about bank secrecy</title>
            <link>https://www.rappler.com/business/unrelated/</link>
            <pubDate>{pub_date}</pubDate>
          </item>
        </channel></rss>"""

        with respx.mock:
            respx.get(sources.RAPPLER_BUSINESS_RSS_URL).mock(return_value=httpx.Response(200, text=rss))
            matches = sources.fetch_rappler_fuel_news()

        assert len(matches) == 1
        assert matches[0]["direction"] == "rollback"
        assert "fuel-rollback-example" in matches[0]["url"]

    def test_ignores_articles_older_than_max_age(self):
        from email.utils import format_datetime
        from datetime import datetime, timezone, timedelta

        old_date = format_datetime(datetime.now(timezone.utc) - timedelta(days=60))
        rss = f"""<?xml version="1.0"?>
        <rss version="2.0"><channel>
          <item>
            <title>Fuel price hike expected next week</title>
            <link>https://www.rappler.com/business/old-hike-story/</link>
            <pubDate>{old_date}</pubDate>
          </item>
        </channel></rss>"""

        with respx.mock:
            respx.get(sources.RAPPLER_BUSINESS_RSS_URL).mock(return_value=httpx.Response(200, text=rss))
            matches = sources.fetch_rappler_fuel_news(max_age_days=14)

        assert matches == []
