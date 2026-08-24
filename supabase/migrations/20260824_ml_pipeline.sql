-- ML Pipeline Tables for Para PH

-- Route ML Stats - stores trained features per route
CREATE TABLE IF NOT EXISTS route_ml_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_uuid UUID REFERENCES ph_routes(route_uuid),
    route_name TEXT,
    
    -- ETA Prediction Features
    avg_speed_kmh FLOAT DEFAULT 0,
    avg_wait_time_min FLOAT DEFAULT 0,
    std_dev_speed FLOAT DEFAULT 0,
    reliability_score FLOAT DEFAULT 0.5, -- 0-1
    confidence_score FLOAT DEFAULT 0.5, -- 0-1
    
    -- Usage Patterns
    total_trips INT DEFAULT 0,
    peak_hour_trips INT DEFAULT 0,
    off_peak_trips INT DEFAULT 0,
    weekday_trips INT DEFAULT 0,
    weekend_trips INT DEFAULT 0,
    
    -- Fare Features
    avg_fare FLOAT DEFAULT 0,
    min_fare FLOAT DEFAULT 0,
    max_fare FLOAT DEFAULT 0,
    fare_std_dev FLOAT DEFAULT 0,
    
    -- Transfer Patterns
    avg_transfers FLOAT DEFAULT 0,
    common_transfer_routes JSONB DEFAULT '[]',
    
    -- Updated
    last_trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stop Reliability - per stop metrics
CREATE TABLE IF NOT EXISTS stop_reliability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stop_name TEXT,
    route_uuid UUID REFERENCES ph_routes(route_uuid),
    lat FLOAT,
    lng FLOAT,
    
    -- Stop Metrics
    avg_wait_time_min FLOAT DEFAULT 0,
    on_time_percentage FLOAT DEFAULT 0.5,
    total_boardings INT DEFAULT 0,
    total_alightings INT DEFAULT 0,
    
    -- Peak Patterns
    peak_wait_time_min FLOAT DEFAULT 0,
    off_peak_wait_time_min FLOAT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML Model Metadata
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    model_type TEXT NOT NULL, -- 'eta', 'reliability', 'fare', 'poi_popularity'
    model_path TEXT, -- S3 path or model registry
    metrics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT false,
    trained_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for ML queries
CREATE INDEX IF NOT EXISTS idx_route_ml_stats_route ON route_ml_stats(route_uuid);
CREATE INDEX IF NOT EXISTS idx_route_ml_stats_reliability ON route_ml_stats(reliability_score DESC);
CREATE INDEX IF NOT EXISTS idx_stop_reliability_route ON stop_reliability(route_uuid);
CREATE INDEX IF NOT EXISTS idx_stop_reliability_name ON stop_reliability(stop_name);
CREATE INDEX IF NOT EXISTS idx_ml_models_active ON ml_models(is_active) WHERE is_active = true;
