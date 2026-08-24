CREATE TABLE bot_counts (
  date TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

INSERT INTO bot_counts (date, count)
  SELECT date(ts / 1000, 'unixepoch') AS date, COUNT(*) AS count
  FROM hits WHERE is_bot = 1
  GROUP BY date(ts / 1000, 'unixepoch');

DELETE FROM hits WHERE is_bot = 1;
