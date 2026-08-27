-- NLP Terms for dynamic Taglish parsing
CREATE TABLE IF NOT EXISTS nlp_terms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL UNIQUE,
    canonical_form TEXT NOT NULL,
    term_type TEXT DEFAULT 'place',
    weight FLOAT DEFAULT 1.0,
    usage_count INT DEFAULT 0,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nlp_terms_term ON nlp_terms(term);

-- Seed with common Taglish terms
INSERT INTO nlp_terms (term, canonical_form, term_type, weight) VALUES
    ('up', 'up diliman', 'place', 1.0),
    ('upd', 'up diliman', 'place', 1.0),
    ('papunta', 'to', 'intent', 1.0),
    ('punta', 'to', 'intent', 1.0),
    ('galing', 'from', 'intent', 1.0),
    ('mula', 'from', 'intent', 1.0),
    ('jeep', 'jeepney', 'mode', 1.0),
    ('tren', 'rail', 'mode', 1.0),
    ('pinakamura', 'cheapest', 'preference', 1.0),
    ('pinakamabilis', 'fastest', 'preference', 1.0),
    ('ayaw maglakad', 'avoid walking', 'preference', 1.0)
ON CONFLICT (term) DO NOTHING;
