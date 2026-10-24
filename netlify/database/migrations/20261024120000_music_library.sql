CREATE TABLE IF NOT EXISTS pomodoro_music_links (
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, url)
);
