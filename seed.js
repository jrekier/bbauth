'use strict';
// Dev helper: wipe the bbauth DB and seed two ready-to-play accounts, each with
// a valid team. Lets you test online play immediately (log into one in a normal
// window, the other in an incognito window) without clicking through
// registration + the team builder.
//
//   node seed.js
//
// Honours DB_PATH like the app does, so it targets the same local DB. NEVER run
// this against the Railway volume — it deletes all users, teams, and matches.

require('dotenv').config();           // honour DB_PATH from .env, like the server
const db     = require('./src/db');   // opens the DB and ensures the schema
const bcrypt = require('bcryptjs');
const { ROSTER_DEFS } = require('./public/roster-defs');

const PASSWORD = 'password123';

// 11-player rosters, comfortably under the 1,000,000 budget.
function names(prefix, n) {
    return Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`);
}

const ACCOUNTS = [
    {
        username: 'reaver',
        team: {
            name: 'Reikland Reavers', race: 'humans',
            homeColour: [40, 90, 170], awayColour: [230, 230, 230],
            roster: [
                { pos: 'Blitzer' }, { pos: 'Blitzer' },
                { pos: 'Thrower' }, { pos: 'Catcher' },
                ...Array(6).fill({ pos: 'Lineman' }),
                { pos: 'Ogre' },
            ],
        },
    },
    {
        username: 'gouger',
        team: {
            name: 'Gouged Eye', race: 'orcs',
            homeColour: [40, 120, 40], awayColour: [20, 20, 20],
            roster: [
                { pos: 'Orc Blitzer' }, { pos: 'Orc Blitzer' },
                { pos: 'Orc Thrower' },
                { pos: 'Big Un Blocker' }, { pos: 'Big Un Blocker' },
                ...Array(5).fill({ pos: 'Orc Lineman' }),
                { pos: 'Troll' },
            ],
        },
    },
];

// Name each slot and pick a concrete sprite variant, mirroring what the team
// builder stores. Positions carry a `sprites` array of {sheet, base, armour}
// variants; a slot must pin one into `slot.sprite` or the player renders blank.
function buildRoster(race, roster) {
    const positions = ROSTER_DEFS[race].positions;
    const counts = {};
    return roster.map(s => {
        counts[s.pos] = (counts[s.pos] || 0) + 1;
        const posDef  = positions.find(p => p.pos === s.pos);
        // Positions carry either a `sprites` array of variants or a single
        // `sprite`. Pin one so the player always renders.
        const sprite  = (posDef && posDef.sprites)
            ? posDef.sprites[(counts[s.pos] - 1) % posDef.sprites.length]
            : (posDef && posDef.sprite);
        return { ...s, name: `${s.pos} ${counts[s.pos]}`, ...(sprite ? { sprite } : {}) };
    });
}

// ── Wipe (children first; FK enforcement is off by default in node:sqlite,
//    but this order is correct regardless). ──
for (const table of ['lobby_messages', 'room_messages', 'matches', 'pending_rooms', 'teams', 'users']) {
    db.exec(`DELETE FROM ${table}`);
}
// Reset autoincrement counters so ids start at 1 again (best-effort).
try { db.exec(`DELETE FROM sqlite_sequence`); } catch {}

const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
const insertTeam = db.prepare(
    'INSERT INTO teams (user_id, name, race, roster, home_colour, away_colour, extras) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

for (const acc of ACCOUNTS) {
    const hash = bcrypt.hashSync(PASSWORD, 12);
    const { lastInsertRowid: userId } = insertUser.run(acc.username, hash);
    const t = acc.team;
    insertTeam.run(
        Number(userId), t.name, t.race,
        JSON.stringify(buildRoster(t.race, t.roster)),
        JSON.stringify(t.homeColour), JSON.stringify(t.awayColour),
        null,
    );
    console.log(`  ${acc.username} / ${PASSWORD}  —  ${t.name} (${t.race})`);
}

console.log('\nDB wiped and seeded. Log into one account in a normal window and the');
console.log('other in an incognito window to test online play.');
