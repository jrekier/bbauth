const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../auth-middleware');
const { ROSTER_DEFS } = require('../../public/roster-defs');

const router = express.Router();
router.use(requireAuth);

// Coerce the buyable extras to non-negative integers. Rulebook maximums are
// deliberately NOT applied — the app stands in for tabletop play among friends,
// so what a team may field is the coaches' business. The ceiling here exists
// only to stop a malformed request writing nonsense to the DB.
const EXTRAS_CEILING = 999;

function sanitizeExtras(raw) {
    const e = raw && typeof raw === 'object' ? raw : {};
    const count = v => Math.max(0, Math.min(EXTRAS_CEILING, Math.floor(Number(v) || 0)));
    return {
        rerolls:          count(e.rerolls),
        cheerleaders:     count(e.cheerleaders),
        assistantCoaches: count(e.assistantCoaches),
        fanFactor:        count(e.fanFactor),
        apothecary:       !!e.apothecary,
    };
}

// A team's Treasury, in gold. Coach-maintained: they keep it in step with
// whatever their league says. Coerced to a non-negative integer, nothing more.
function sanitizeTreasury(raw) {
    return Math.max(0, Math.floor(Number(raw) || 0));
}

// Data integrity only: no budget, roster-size or positional limits. A position
// the roster defs don't know would be silently dropped by expandTeam and the
// coach would take the field a player short, so that one is still refused.
function validateRoster(race, roster, res) {
    const raceDef = ROSTER_DEFS[race];
    if (!raceDef) { res.status(400).json({ error: `Unknown race: ${race}` }); return false; }
    for (const slot of roster) {
        if (!raceDef.positions.some(p => p.pos === slot.pos)) {
            res.status(400).json({ error: `Unknown position: ${slot.pos}` }); return false;
        }
    }
    return true;
}

function parseColour(raw) {
    if (!raw) return null;
    try {
        const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(c) && c.length === 3 && c.every(n => Number.isInteger(n) && n >= 0 && n <= 255))
            return c;
    } catch {}
    return null;
}

function expandRow(t) {
    let extras = null;
    try { extras = t.extras ? JSON.parse(t.extras) : null; } catch {}
    return {
        ...t,
        roster:      JSON.parse(t.roster),
        homeColour:  parseColour(t.home_colour),
        awayColour:  parseColour(t.away_colour),
        extras,
        treasury:    t.treasury || 0,
    };
}

// GET /api/teams — list all teams for the logged-in user
router.get('/teams', (req, res) => {
    const teams = db.prepare('SELECT * FROM teams WHERE user_id = ? ORDER BY created_at ASC').all(req.session.userId);
    res.json({ teams: teams.map(expandRow) });
});

// GET /api/teams/:id
router.get('/teams/:id', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: expandRow(team) });
});

// POST /api/teams — create a new team
router.post('/teams', (req, res) => {
    const { name, race, roster, homeColour, awayColour } = req.body;
    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });
    const extras   = sanitizeExtras(req.body.extras);
    const treasury = sanitizeTreasury(req.body.treasury);
    if (!validateRoster(race, roster, res)) return;
    const hc = homeColour ? JSON.stringify(homeColour) : null;
    const ac = awayColour ? JSON.stringify(awayColour) : null;
    const result = db.prepare('INSERT INTO teams (user_id, name, race, roster, home_colour, away_colour, extras, treasury) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, name, race, JSON.stringify(roster), hc, ac, JSON.stringify(extras), treasury);
    res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/teams/:id — update an existing team
router.put('/teams/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!existing) return res.status(404).json({ error: 'Team not found' });
    const { name, race, roster, homeColour, awayColour } = req.body;
    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });
    const extras   = sanitizeExtras(req.body.extras);
    const treasury = sanitizeTreasury(req.body.treasury);
    if (!validateRoster(race, roster, res)) return;
    const hc = homeColour ? JSON.stringify(homeColour) : null;
    const ac = awayColour ? JSON.stringify(awayColour) : null;
    db.prepare('UPDATE teams SET name = ?, race = ?, roster = ?, home_colour = ?, away_colour = ?, extras = ?, treasury = ? WHERE id = ?')
        .run(name, race, JSON.stringify(roster), hc, ac, JSON.stringify(extras), treasury, req.params.id);
    res.json({ ok: true });
});

// DELETE /api/teams/:id
router.delete('/teams/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!existing) return res.status(404).json({ error: 'Team not found' });
    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
