import sqlite3
from types import SimpleNamespace

import httpx
import respx

import llm_engine
from llm_engine import (
    ask_info_llm,
    geocode_location,
    parse_chat_intent_async,
)


class TestParseChatIntent:
    async def test_info_keyword_short_circuits_before_any_network_call(self):
        result = await parse_chat_intent_async("Magkano ang pamasahe?")
        assert result == {"intent": "INFO", "question": "Magkano ang pamasahe?"}

    async def test_route_regex_match_short_circuits_before_any_network_call(self):
        result = await parse_chat_intent_async("From Ayala to Alabang")
        assert result["intent"] == "ROUTE"
        assert result["origin"] == "ayala"
        assert result["destination"] == "alabang"

    async def test_llm_fallback_on_unmatched_message(self):
        with respx.mock(assert_all_called=True) as mock:
            mock.post(llm_engine.OLLAMA_URL).mock(
                return_value=httpx.Response(
                    200,
                    json={"message": {"content": '{"intent": "ROUTE", "origin": "x", "destination": "y"}'}},
                )
            )
            result = await parse_chat_intent_async("asdfghjkl qwerty")

        assert result == {"intent": "ROUTE", "origin": "x", "destination": "y"}

    async def test_llm_fallback_returns_default_on_network_error(self):
        with respx.mock:
            respx.post(llm_engine.OLLAMA_URL).mock(side_effect=httpx.ConnectError("no ollama"))
            result = await parse_chat_intent_async("asdfghjkl qwerty")

        assert result == {"intent": "INFO", "question": "asdfghjkl qwerty"}


class TestAskInfoLlm:
    async def test_returns_placeholder_when_no_knowledge_base(self, monkeypatch):
        monkeypatch.setattr(llm_engine, "KB_CONTEXT", "")
        result = await ask_info_llm("Anong oras magbukas?")
        assert "wala pa akong impormasyon" in result

    async def test_returns_llm_answer_when_knowledge_base_present(self, monkeypatch):
        monkeypatch.setattr(llm_engine, "KB_CONTEXT", "Jeepneys run 5am-10pm.")
        with respx.mock:
            respx.post(llm_engine.OLLAMA_URL).mock(
                return_value=httpx.Response(200, json={"message": {"content": "5am to 10pm."}})
            )
            result = await ask_info_llm("Anong oras magbukas?")
        assert result == "5am to 10pm."

    async def test_returns_fallback_message_on_network_error(self, monkeypatch):
        monkeypatch.setattr(llm_engine, "KB_CONTEXT", "Jeepneys run 5am-10pm.")
        with respx.mock:
            respx.post(llm_engine.OLLAMA_URL).mock(side_effect=httpx.ConnectError("no ollama"))
            result = await ask_info_llm("Anong oras magbukas?")
        assert "Pasensya na" in result


class TestGeocodeLocation:
    async def test_empty_input_returns_none(self):
        assert await geocode_location("") is None
        assert await geocode_location(None) is None

    async def test_poi_cache_hit_skips_geocoder(self, isolated_db, monkeypatch):
        db = sqlite3.connect(str(llm_engine.POI_DB_PATH))
        db.execute(
            "CREATE TABLE IF NOT EXISTS geocode_cache (query TEXT PRIMARY KEY, lat REAL, lon REAL, display_name TEXT)"
        )
        db.execute(
            "INSERT INTO geocode_cache (query, lat, lon, display_name) VALUES (?, ?, ?, ?)",
            ("cubao", 14.62, 121.05, "Cubao, QC"),
        )
        db.commit()
        db.close()

        def _fail_if_called(*a, **k):
            raise AssertionError("geolocator should not be called on a cache hit")

        monkeypatch.setattr(llm_engine.geolocator, "geocode", _fail_if_called)

        result = await geocode_location("Cubao")
        assert result == (14.62, 121.05)

    async def test_acronym_memory_hit_then_geocodes_and_caches(self, isolated_db, monkeypatch):
        db = sqlite3.connect(str(llm_engine.ML_DB_PATH))
        db.execute("CREATE TABLE IF NOT EXISTS acronym_memory (slang TEXT PRIMARY KEY, formal_name TEXT)")
        db.execute(
            "INSERT INTO acronym_memory (slang, formal_name) VALUES (?, ?)",
            ("pitx", "Parañaque Integrated Terminal Exchange"),
        )
        db.commit()
        db.close()

        fake_location = SimpleNamespace(latitude=14.5, longitude=121.0, address="PITX, Parañaque")
        monkeypatch.setattr(llm_engine.geolocator, "geocode", lambda query, country_codes=None: fake_location)

        result = await geocode_location("pitx")

        assert result == (14.5, 121.0)
        db = sqlite3.connect(str(llm_engine.POI_DB_PATH))
        cached = db.execute("SELECT lat, lon FROM geocode_cache WHERE query = ?", ("pitx",)).fetchone()
        db.close()
        assert cached == (14.5, 121.0)

    async def test_unknown_location_expands_via_llm_then_geocodes(self, isolated_db, monkeypatch):
        monkeypatch.setattr(llm_engine, "_expand_location_queries", lambda name: _async_return(["Admu, Quezon City"]))
        fake_location = SimpleNamespace(latitude=14.64, longitude=121.08, address="Ateneo de Manila University")
        monkeypatch.setattr(llm_engine.geolocator, "geocode", lambda query, country_codes=None: fake_location)

        result = await geocode_location("admu")

        assert result == (14.64, 121.08)
        db = sqlite3.connect(str(llm_engine.ML_DB_PATH))
        saved = db.execute("SELECT formal_name FROM acronym_memory WHERE slang = ?", ("admu",)).fetchone()
        db.close()
        assert saved == ("Admu, Quezon City",)

    async def test_geocoder_returns_nothing(self, isolated_db, monkeypatch):
        monkeypatch.setattr(llm_engine, "_expand_location_queries", lambda name: _async_return([]))
        monkeypatch.setattr(llm_engine.geolocator, "geocode", lambda query, country_codes=None: None)

        result = await geocode_location("nowhere land")
        assert result is None

    async def test_geocoder_exception_returns_none(self, isolated_db, monkeypatch):
        monkeypatch.setattr(llm_engine, "_expand_location_queries", lambda name: _async_return([]))

        def _raise(*a, **k):
            raise RuntimeError("geocoder blew up")

        monkeypatch.setattr(llm_engine.geolocator, "geocode", _raise)

        result = await geocode_location("somewhere")
        assert result is None


async def _async_return(value):
    return value


class TestExpandLocationQueries:
    async def test_returns_parsed_list_on_success(self):
        with respx.mock:
            respx.post(llm_engine.OLLAMA_URL).mock(
                return_value=httpx.Response(200, json={"message": {"content": '["Query 1", "Query 2"]'}})
            )
            result = await llm_engine._expand_location_queries("pitx")
        assert result == ["Query 1", "Query 2"]

    async def test_returns_empty_list_on_network_error(self):
        with respx.mock:
            respx.post(llm_engine.OLLAMA_URL).mock(side_effect=httpx.ConnectError("no ollama"))
            result = await llm_engine._expand_location_queries("pitx")
        assert result == []
