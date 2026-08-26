-- Para PH Rail Transit Schema
CREATE EXTENSION IF NOT EXISTS postgis;

-- TABLE 1: STATION SHAPES (MultiPolygon)
CREATE TABLE IF NOT EXISTS rail_station_shapes (
    id SERIAL PRIMARY KEY,
    full_id TEXT UNIQUE,
    osm_id BIGINT,
    osm_type TEXT,
    geom GEOMETRY(MultiPolygon, 4326),
    railway TEXT,
    wikipedia TEXT,
    wikidata TEXT,
    type TEXT,
    building TEXT,
    subway TEXT,
    station TEXT,
    public_transport TEXT,
    start_date TEXT,
    operator TEXT,
    network TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rail_shapes_geom ON rail_station_shapes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_rail_shapes_name ON rail_station_shapes (name);

-- TABLE 2: NETWORK LINES (LineString)
CREATE TABLE IF NOT EXISTS rail_network_lines (
    id SERIAL PRIMARY KEY,
    full_id TEXT UNIQUE,
    osm_id BIGINT,
    osm_type TEXT,
    geom GEOMETRY(LineString, 4326),
    railway TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rail_lines_geom ON rail_network_lines USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_rail_lines_name ON rail_network_lines (name);

-- TABLE 3: STATION POINTS (Point)
CREATE TABLE IF NOT EXISTS rail_station_points (
    id SERIAL PRIMARY KEY,
    fid INT,
    full_id TEXT UNIQUE,
    osm_id BIGINT,
    osm_type TEXT,
    geom GEOMETRY(Point, 4326),
    railway TEXT,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rail_points_geom ON rail_station_points USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_rail_points_name ON rail_station_points (name);
CREATE INDEX IF NOT EXISTS idx_rail_points_full_id ON rail_station_points (full_id);
