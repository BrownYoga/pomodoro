-- Keep the newest saved name when the same song was saved from several playlists.
WITH ranked AS (
  SELECT user_id, url, ROW_NUMBER() OVER (
    PARTITION BY user_id, split_part(url, '&list=', 1)
    ORDER BY created_at DESC, url
  ) AS position
  FROM pomodoro_music_links
  WHERE url LIKE 'https://music.youtube.com/watch?v=%'
)
DELETE FROM pomodoro_music_links AS links USING ranked
WHERE links.user_id = ranked.user_id AND links.url = ranked.url AND ranked.position > 1;

UPDATE pomodoro_music_links SET url = split_part(url, '&list=', 1)
WHERE url LIKE 'https://music.youtube.com/watch?v=%';
