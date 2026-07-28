from pathlib import Path

import pytest

import gas_price_db as db

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "fixtures_gas"
POI_SAMPLE = FIXTURES_DIR / "poi_sample.geojson"


@pytest.fixture
def conn(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    c = db.get_connection()
    db.init_gas_price_tables(c)
    yield c
    c.close()


class TestSeedStationsFromPoi:
    def test_seeds_only_fuel_category_with_supported_brands(self, conn):
        seeded = db.seed_stations_from_poi(conn, POI_SAMPLE)
        stations = db.get_stations(conn)

        # 5 features in the fixture: 2x duplicate Shell, 1x Petron, 1x Flying V
        # (unsupported brand), 1x Chowking (not fuel). Dedup collapses the two
        # identical Shell coordinates into one row.
        assert seeded == 2
        assert len(stations) == 2
        brands = {s["brand"] for s in stations}
        assert brands == {"shell", "petron"}

    def test_is_idempotent_on_second_call(self, conn):
        db.seed_stations_from_poi(conn, POI_SAMPLE)
        second_run = db.seed_stations_from_poi(conn, POI_SAMPLE)
        assert second_run == 0
        assert len(db.get_stations(conn)) == 2

    def test_builds_readable_address_from_raw_tags(self, conn):
        db.seed_stations_from_poi(conn, POI_SAMPLE)
        shell = next(s for s in db.get_stations(conn) if s["brand"] == "shell")
        assert "North Bay Blvd" in shell["address"]
        assert "Navotas" in shell["address"]

    def test_missing_poi_file_is_a_safe_noop(self, conn, tmp_path):
        seeded = db.seed_stations_from_poi(conn, tmp_path / "does_not_exist.geojson")
        assert seeded == 0
        assert db.get_stations(conn) == []


class TestCommunityPriceBlending:
    def _make_station(self, conn, brand="shell"):
        return db.insert_station(conn, brand, f"{brand.title()} Station", "Test Address", 14.6, 121.0)

    def test_below_min_reports_does_not_qualify(self, conn):
        station_id = self._make_station(conn)
        db.insert_price_report(conn, station_id, "ron95", 90.0)
        db.insert_price_report(conn, station_id, "ron95", 91.0)  # only 2 reports

        by_station = db.get_community_prices_by_station(conn)
        by_brand = db.get_community_prices_by_brand(conn)
        assert by_station == {}
        assert by_brand == {}

    def test_three_or_more_reports_within_window_qualifies(self, conn):
        station_id = self._make_station(conn)
        for price in (90.0, 91.0, 92.0):
            db.insert_price_report(conn, station_id, "ron95", price)

        by_station = db.get_community_prices_by_station(conn)
        assert by_station[station_id]["ron95"]["report_count"] == 3
        assert by_station[station_id]["ron95"]["community_avg"] == pytest.approx(91.0)

        by_brand = db.get_community_prices_by_brand(conn)
        assert by_brand["shell"]["ron95"]["report_count"] == 3

    def test_reports_outside_window_are_excluded(self, conn):
        station_id = self._make_station(conn)
        conn.execute(
            "INSERT INTO gas_price_reports (station_id, fuel_type, price, created_at) "
            "VALUES (?, 'ron95', 90.0, datetime('now', '-30 days'))",
            (station_id,),
        )
        conn.execute(
            "INSERT INTO gas_price_reports (station_id, fuel_type, price, created_at) "
            "VALUES (?, 'ron95', 91.0, datetime('now', '-30 days'))",
            (station_id,),
        )
        conn.execute(
            "INSERT INTO gas_price_reports (station_id, fuel_type, price, created_at) "
            "VALUES (?, 'ron95', 92.0, datetime('now', '-30 days'))",
            (station_id,),
        )
        conn.commit()

        assert db.get_community_prices_by_station(conn) == {}

    def test_aggregates_across_multiple_stations_of_same_brand(self, conn):
        station_a = self._make_station(conn, brand="petron")
        station_b = self._make_station(conn, brand="petron")
        db.insert_price_report(conn, station_a, "diesel", 80.0)
        db.insert_price_report(conn, station_b, "diesel", 82.0)
        db.insert_price_report(conn, station_a, "diesel", 81.0)

        by_brand = db.get_community_prices_by_brand(conn)
        assert by_brand["petron"]["diesel"]["report_count"] == 3

        # But per-station view keeps them separate, and neither station alone hits 3.
        by_station = db.get_community_prices_by_station(conn)
        assert by_station == {}


class TestStationExists:
    def test_true_for_seeded_station_false_otherwise(self, conn):
        station_id = db.insert_station(conn, "shell", "Test", "Addr", 14.6, 121.0)
        assert db.station_exists(conn, station_id) is True
        assert db.station_exists(conn, station_id + 999) is False
