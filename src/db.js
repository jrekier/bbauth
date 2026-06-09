const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, '..', 'bbauth.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT    NOT NULL,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS teams (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        race        TEXT    NOT NULL,
        roster      TEXT    NOT NULL DEFAULT '[]',
        home_colour TEXT,
        away_colour TEXT,
        created_at  INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pending_rooms (
        id             TEXT    PRIMARY KEY,
        home_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        home_username  TEXT    NOT NULL,
        team_id        INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        team_name      TEXT,
        race           TEXT,
        home_ready     INTEGER NOT NULL DEFAULT 0,
        away_user_id   INTEGER,
        away_username  TEXT,
        away_team_id   INTEGER,
        away_team_name TEXT,
        away_race      TEXT,
        away_ready     INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS room_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id    TEXT    NOT NULL,
        username   TEXT    NOT NULL,
        message    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Historical record of completed/abandoned games. Deliberately NOT a foreign
    -- key on users: recording that a match happened must never fail (or be wiped)
    -- just because a player later deletes their account. The ids are kept as-is.
    CREATE TABLE IF NOT EXISTS matches (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id       TEXT    NOT NULL,
        home_user_id  INTEGER,
        away_user_id  INTEGER,
        home_score    INTEGER NOT NULL DEFAULT 0,
        away_score    INTEGER NOT NULL DEFAULT 0,
        winner        TEXT,
        status        TEXT    NOT NULL,
        created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );
`);

// ── Migrations ─────────────────────────────────────────────────────
// Add the team "extras" (re-rolls, staff, inducements) column to older DBs.
// node:sqlite throws if the column already exists, so guard with a check.
const teamCols = db.prepare(`PRAGMA table_info(teams)`).all().map(c => c.name);
if (!teamCols.includes('extras')) {
    db.exec(`ALTER TABLE teams ADD COLUMN extras TEXT`);
}

module.exports = db;
