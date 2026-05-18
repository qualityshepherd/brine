CREATE TABLE posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  markdown    TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',
  type        TEXT NOT NULL DEFAULT 'post',
  date        TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  author      TEXT NOT NULL,
  audio_url   TEXT NOT NULL DEFAULT '',
  image_url   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE post_tags (
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (post_id, tag)
);

CREATE INDEX idx_posts_slug    ON posts(slug);
CREATE INDEX idx_posts_status  ON posts(status);
CREATE INDEX idx_post_tags_tag ON post_tags(tag);

CREATE TABLE feeds (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE feed_status (
  feed_url   TEXT PRIMARY KEY,
  code       INTEGER,
  fetched_at TEXT,
  error      TEXT,
  posts      TEXT
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  pubkey     TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key      TEXT PRIMARY KEY,
  count    INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE settings (
  id    INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL DEFAULT '{}'
);

INSERT INTO settings (id, value) VALUES (1, '{}');

CREATE TABLE hits (
  ts       INTEGER NOT NULL,
  path     TEXT    NOT NULL,
  country  TEXT    NOT NULL DEFAULT '?',
  city     TEXT    NOT NULL DEFAULT '?',
  region   TEXT    NOT NULL DEFAULT '?',
  device   TEXT    NOT NULL DEFAULT 'desktop',
  referrer TEXT    NOT NULL DEFAULT '',
  ip_hash  TEXT    NOT NULL DEFAULT '',
  is_bot   INTEGER NOT NULL DEFAULT 0,
  asn      INTEGER,
  rss_feed TEXT,
  rss_subs INTEGER
);

CREATE INDEX idx_hits_ts ON hits(ts);
