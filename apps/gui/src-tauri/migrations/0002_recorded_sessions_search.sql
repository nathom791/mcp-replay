CREATE INDEX IF NOT EXISTS idx_recorded_sessions_title_lower
  ON recorded_sessions (LOWER(title));

CREATE INDEX IF NOT EXISTS idx_recorded_sessions_source_lower
  ON recorded_sessions (LOWER(source));
