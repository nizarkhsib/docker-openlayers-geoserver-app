CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS my_lines (
    id SERIAL PRIMARY KEY,
    geom geometry(LineString, 3857)
);