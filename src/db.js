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
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT    NOT NULL,
        race       TEXT    NOT NULL,
        roster     TEXT    NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS pending_rooms (
        id             TEXT    PRIMARY KEY,
        home_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        home_username  TEXT    NOT NULL,
        team_id        INTEGER REFERENCES teams(id) ON DELETE SET NULL,
        team_name      TEXT,
        race           TEXT,
        created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS room_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id    TEXT    NOT NULL,
        username   TEXT    NOT NULL,
        message    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
`);

// Migrate existing pending_rooms tables that predate the team_id column
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN team_id INTEGER'); } catch {}

// Migrate existing teams tables that predate per-team colours
try { db.exec("ALTER TABLE teams ADD COLUMN home_colour TEXT"); } catch {}
try { db.exec("ALTER TABLE teams ADD COLUMN away_colour TEXT"); } catch {}

// Migrate pending_rooms to support staging (away user + ready flags)
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_user_id   INTEGER'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_username  TEXT'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_team_id   INTEGER'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_team_name TEXT'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_race      TEXT'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN home_ready     INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN away_ready     INTEGER NOT NULL DEFAULT 0'); } catch {}

module.exports = db;
