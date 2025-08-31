-- Add query_params column to fetch_configs table
ALTER TABLE fetch_configs ADD COLUMN query_params JSON NULL AFTER headers;