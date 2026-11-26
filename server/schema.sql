CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT NOT NULL, email TEXT NOT NULL,
  phone TEXT NOT NULL, password TEXT, demo BOOLEAN NOT NULL DEFAULT FALSE,
  example INTEGER NOT NULL DEFAULT 0, seen BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS account_email ON accounts(email) WHERE NOT demo;
CREATE UNIQUE INDEX IF NOT EXISTS account_phone ON accounts(phone) WHERE NOT demo;
CREATE UNIQUE INDEX IF NOT EXISTS account_username ON accounts(lower(username)) WHERE NOT demo;
CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('personal', 'team')),
  owner TEXT NOT NULL REFERENCES accounts(id), created BIGINT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS personal_space ON spaces(owner) WHERE kind = 'personal';
CREATE TABLE IF NOT EXISTS space_members (
  space TEXT NOT NULL REFERENCES spaces(id), account TEXT NOT NULL REFERENCES accounts(id),
  PRIMARY KEY (space, account)
);
CREATE INDEX IF NOT EXISTS spaces_by_member ON space_members(account, space);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, account TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, team TEXT NOT NULL REFERENCES spaces(id), date TEXT NOT NULL, time TEXT NOT NULL,
  title TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'kegiatan', done BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'optional', 'important'))
);
ALTER TABLE events ALTER COLUMN category SET DEFAULT 'kegiatan';
ALTER TABLE events ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('none', 'optional', 'important'));
CREATE INDEX IF NOT EXISTS events_by_team ON events(team, date, time);
CREATE TABLE IF NOT EXISTS invites (
  id TEXT PRIMARY KEY, team TEXT NOT NULL REFERENCES spaces(id), invited_by TEXT NOT NULL REFERENCES accounts(id),
  target TEXT REFERENCES accounts(id), username TEXT, email TEXT, phone TEXT, channel TEXT,
  status TEXT NOT NULL CHECK (status IN ('verify', 'link', 'pending', 'accepted', 'declined')),
  created BIGINT NOT NULL, code TEXT, expires BIGINT, attempts INTEGER NOT NULL DEFAULT 0,
  access TEXT UNIQUE, access_expires BIGINT
);
CREATE INDEX IF NOT EXISTS invites_by_recipient ON invites(target, created DESC);
CREATE UNIQUE INDEX IF NOT EXISTS pending_invite ON invites(team, target) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, team TEXT NOT NULL REFERENCES spaces(id), author TEXT NOT NULL REFERENCES accounts(id),
  body TEXT NOT NULL, reply TEXT REFERENCES messages(id), sent BIGINT NOT NULL, pinned BIGINT,
  mime TEXT, filename TEXT, media BYTEA
);
CREATE INDEX IF NOT EXISTS messages_by_team ON messages(team, sent);
