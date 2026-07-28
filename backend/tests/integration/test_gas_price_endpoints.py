import gas_price_db as gas_db


class TestBlendedEndpoint:
    def test_returns_empty_but_valid_shape_with_no_data(self, client, isolated_db):
        response = client.get("/api/v1/gas-prices/blended")
        assert response.status_code == 200
        body = response.json()
        assert body["averages"] == []
        assert body["stations"] == []
        assert body["stale"] is True

    def test_blends_official_prices_into_averages_and_stations(self, client, isolated_db):
        conn = gas_db.get_connection()
        gas_db.upsert_official_price(conn, "shell", "ron95", 90.0, 95.0, "Settled", "2026-07-20")
        gas_db.upsert_official_price(conn, "petron", "ron95", 88.0, 93.0, "Settled", "2026-07-20")
        conn.commit()
        conn.close()

        body = client.get("/api/v1/gas-prices/blended").json()
        avg = next(a for a in body["averages"] if a["id"] == "ron95")
        assert avg["price"] == 89.0  # mean of 90.0 and 88.0

        shell = next(s for s in body["stations"] if s["id"] == "shell")
        assert shell["prices"]["ron95"]["price"] == 90.0
        assert shell["prices"]["ron95"]["source"] == "official"

    def test_community_reports_replace_official_price_once_threshold_met(self, client, isolated_db):
        conn = gas_db.get_connection()
        gas_db.upsert_official_price(conn, "shell", "ron95", 90.0, 95.0, "Settled", "2026-07-20")
        station_id = gas_db.insert_station(conn, "shell", "Shell EDSA", "EDSA", 14.6, 121.0)
        for price in (85.0, 86.0, 87.0):
            gas_db.insert_price_report(conn, station_id, "ron95", price)
        conn.close()

        body = client.get("/api/v1/gas-prices/blended").json()
        shell = next(s for s in body["stations"] if s["id"] == "shell")
        assert shell["prices"]["ron95"]["source"] == "community"
        assert shell["prices"]["ron95"]["price"] == 86.0
        assert "Community Reports" in body["source"]


class TestStationsEndpoint:
    def test_list_includes_community_prices_per_station(self, client, isolated_db):
        conn = gas_db.get_connection()
        station_id = gas_db.insert_station(conn, "petron", "Petron QC", "QC", 14.65, 121.05)
        for price in (80.0, 81.0, 82.0):
            gas_db.insert_price_report(conn, station_id, "diesel", price)
        conn.close()

        response = client.get("/api/v1/gas-prices/stations")
        assert response.status_code == 200
        station = next(s for s in response.json() if s["id"] == station_id)
        assert station["community_prices"]["diesel"]["report_count"] == 3

    def test_add_station_rejects_unknown_brand(self, client, isolated_db):
        response = client.post("/api/v1/gas-prices/stations", json={
            "brand": "not_a_real_brand", "name": "Fake Station", "lat": 14.6, "lng": 121.0,
        })
        assert response.status_code == 400

    def test_add_station_rejects_blank_name(self, client, isolated_db):
        response = client.post("/api/v1/gas-prices/stations", json={
            "brand": "shell", "name": "   ", "lat": 14.6, "lng": 121.0,
        })
        assert response.status_code == 400

    def test_add_station_succeeds_and_is_then_listed(self, client, isolated_db):
        response = client.post("/api/v1/gas-prices/stations", json={
            "brand": "caltex", "name": "Caltex Ortigas", "address": "Ortigas Ave", "lat": 14.58, "lng": 121.06,
        })
        assert response.status_code == 200
        new_id = response.json()["id"]

        stations = client.get("/api/v1/gas-prices/stations").json()
        assert any(s["id"] == new_id and s["brand"] == "caltex" for s in stations)

    def test_add_station_rejects_out_of_range_coordinates(self, client, isolated_db):
        response = client.post("/api/v1/gas-prices/stations", json={
            "brand": "shell", "name": "Nowhere", "lat": 999, "lng": 121.0,
        })
        assert response.status_code == 422


class TestSubmitPriceReportEndpoint:
    def test_submit_rejects_unknown_fuel_type(self, client, isolated_db):
        conn = gas_db.get_connection()
        station_id = gas_db.insert_station(conn, "shell", "Shell", "Addr", 14.6, 121.0)
        conn.close()

        response = client.post(f"/api/v1/gas-prices/stations/{station_id}/submit", json={
            "fuel_type": "unleaded_rocket_fuel", "price": 90.0,
        })
        assert response.status_code == 400

    def test_submit_rejects_unknown_station(self, client, isolated_db):
        response = client.post("/api/v1/gas-prices/stations/999999/submit", json={
            "fuel_type": "ron95", "price": 90.0,
        })
        assert response.status_code == 404

    def test_submit_rejects_price_outside_sane_bounds(self, client, isolated_db):
        conn = gas_db.get_connection()
        station_id = gas_db.insert_station(conn, "shell", "Shell", "Addr", 14.6, 121.0)
        conn.close()

        response = client.post(f"/api/v1/gas-prices/stations/{station_id}/submit", json={
            "fuel_type": "ron95", "price": 5.0,
        })
        assert response.status_code == 422

    def test_submit_succeeds_and_is_reflected_in_stations_list(self, client, isolated_db):
        conn = gas_db.get_connection()
        station_id = gas_db.insert_station(conn, "shell", "Shell", "Addr", 14.6, 121.0)
        conn.close()

        response = client.post(f"/api/v1/gas-prices/stations/{station_id}/submit", json={
            "fuel_type": "ron95", "price": 92.5,
        })
        assert response.status_code == 200
        assert "message" in response.json()

        conn = gas_db.get_connection()
        count = conn.execute(
            "SELECT COUNT(*) FROM gas_price_reports WHERE station_id = ? AND fuel_type = 'ron95'", (station_id,)
        ).fetchone()[0]
        conn.close()
        assert count == 1
