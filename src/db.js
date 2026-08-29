const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(process.env.DB_PATH || path.join(__dirname, '..', 'bbauth.db'));

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        username       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        password_hash  TEXT,                       -- null for Google-only accounts
        display_name   TEXT,
        avatar_url     TEXT,
        email          TEXT    UNIQUE COLLATE NOCASE,
        email_verified INTEGER NOT NULL DEFAULT 0,
        google_sub     TEXT    UNIQUE,
        created_at     INTEGER NOT NULL DEFAULT (unixepoch())
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

    -- Global lobby chat. Kept small (pruned on insert); history is just the
    -- recent backlog new arrivals see when they open the lobby.
    CREATE TABLE IF NOT EXISTS lobby_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER NOT NULL,
        username   TEXT    NOT NULL,
        message    TEXT    NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
`);

// ── Migrations ─────────────────────────────────────────────────────
// Add the team "extras" (re-rolls, staff, inducements) column to older DBs.
// node:sqlite throws if the column already exists, so guard with a check.
// node:sqlite throws if the column already exists, so check before adding.
function addColumn(table, column, decl) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}

// Team "extras" (re-rolls, sideline staff) on older DBs.
addColumn('teams', 'extras', 'TEXT');
// A team's Treasury. The coach keeps this in step with their league by hand —
// bbauth deliberately does no league bookkeeping (that is tourplay's job), but
// League Play petty cash cannot be worked out without knowing each side's gold.
addColumn('teams', 'treasury', 'INTEGER NOT NULL DEFAULT 0');

// Per-match inducements. In League Play these belong to the fixture, not the
// team: they are bought in the staging room once both CTVs are known.
//   *_tv              CTV frozen when both coaches readied up
//   *_inducements     what each coach bought, as JSON
//   *_treasury_spend  gold taken from that coach's Treasury
//   inducement_turn   'home' | 'away' while buying, NULL once both are done
addColumn('pending_rooms', 'home_tv',             'INTEGER NOT NULL DEFAULT 0');
addColumn('pending_rooms', 'away_tv',             'INTEGER NOT NULL DEFAULT 0');
addColumn('pending_rooms', 'home_inducements',    'TEXT');
addColumn('pending_rooms', 'away_inducements',    'TEXT');
addColumn('pending_rooms', 'home_treasury_spend', 'INTEGER NOT NULL DEFAULT 0');
addColumn('pending_rooms', 'away_treasury_spend', 'INTEGER NOT NULL DEFAULT 0');
addColumn('pending_rooms', 'inducement_turn',     'TEXT');

module.exports = db;
