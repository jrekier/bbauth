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
`);

module.exports = db;
