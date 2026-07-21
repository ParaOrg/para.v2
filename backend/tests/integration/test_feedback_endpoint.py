import sqlite3


def test_low_rating_only_records_feedback(client, isolated_db):
    response = client.post(
        "/feedback",
        json={
            "user_id": "u1",
            "route_id": "r1",
            "rating": 3,
            "comment": "meh",
            "origin_name": "Cubao",
            "destination_name": "Ayala",
            "route_nodes": ["n1", "n2"],
            "total_fare": 13.0,
            "total_time": 20.0,
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "success"}

    db = sqlite3.connect(str(isolated_db))
    feedback_rows = db.execute("SELECT rating FROM route_feedback").fetchall()
    approved_rows = db.execute("SELECT * FROM approved_routes").fetchall()
    db.close()

    assert feedback_rows == [(3,)]
    assert approved_rows == []


def test_high_rating_learns_approved_route(client, isolated_db):
    payload = {
        "user_id": "u1",
        "route_id": "r1",
        "rating": 7,
        "comment": "perfect",
        "origin_name": "Cubao",
        "destination_name": "Ayala",
        "route_nodes": ["n1", "n2", "n3"],
        "total_fare": 13.0,
        "total_time": 20.0,
    }

    client.post("/feedback", json=payload)

    db = sqlite3.connect(str(isolated_db))
    row = db.execute(
        "SELECT origin, destination, rating_sum, trip_count FROM approved_routes WHERE origin = ? AND destination = ?",
        ("cubao", "ayala"),
    ).fetchone()
    db.close()

    assert row == ("cubao", "ayala", 7, 1)


def test_repeated_high_rating_accumulates_trip_count(client, isolated_db):
    payload = {
        "user_id": "u1",
        "route_id": "r1",
        "rating": 6,
        "origin_name": "Cubao",
        "destination_name": "Ayala",
        "route_nodes": ["n1", "n2", "n3"],
        "total_fare": 13.0,
        "total_time": 20.0,
    }

    client.post("/feedback", json=payload)
    client.post("/feedback", json=payload)

    db = sqlite3.connect(str(isolated_db))
    row = db.execute(
        "SELECT rating_sum, trip_count FROM approved_routes WHERE origin = ? AND destination = ?",
        ("cubao", "ayala"),
    ).fetchone()
    db.close()

    assert row == (12, 2)


def test_high_rating_without_route_nodes_does_not_learn(client, isolated_db):
    response = client.post(
        "/feedback",
        json={
            "user_id": "u1",
            "route_id": "r1",
            "rating": 7,
            "origin_name": "Cubao",
            "destination_name": "Ayala",
            "route_nodes": [],
            "total_fare": 13.0,
            "total_time": 20.0,
        },
    )

    assert response.status_code == 200
    db = sqlite3.connect(str(isolated_db))
    approved_rows = db.execute("SELECT * FROM approved_routes").fetchall()
    db.close()
    assert approved_rows == []
