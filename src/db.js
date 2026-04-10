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
        team_id        INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        team_name      TEXT    NOT NULL,
        race           TEXT    NOT NULL,
        created_at     INTEGER NOT NULL DEFAULT (unixepoch())
    );
`);

// Migrate existing pending_rooms tables that predate the team_id column
try { db.exec('ALTER TABLE pending_rooms ADD COLUMN team_id INTEGER'); } catch {}

// Migrate existing teams tables that predate per-team colours
try { db.exec("ALTER TABLE teams ADD COLUMN home_colour TEXT"); } catch {}
try { db.exec("ALTER TABLE teams ADD COLUMN away_colour TEXT"); } catch {}

module.exports = db;
