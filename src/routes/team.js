const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../auth-middleware');
const { ROSTER_DEFS, teamCost, STAFF_LIMITS } = require('../../public/roster-defs');

const router = express.Router();
router.use(requireAuth);

// Clamp the buyable extras to safe, integer, in-limit values.
function sanitizeExtras(raw) {
    const e = raw && typeof raw === 'object' ? raw : {};
    const clamp = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
    return {
        rerolls:          clamp(e.rerolls,          STAFF_LIMITS.rerolls),
        bribes:           clamp(e.bribes,           STAFF_LIMITS.bribes),
        cheerleaders:     clamp(e.cheerleaders,     STAFF_LIMITS.cheerleaders),
        assistantCoaches: clamp(e.assistantCoaches, STAFF_LIMITS.assistantCoaches),
        fanFactor:        clamp(e.fanFactor,        STAFF_LIMITS.fanFactor),
        apothecary:       !!e.apothecary,
    };
}

function validateRoster(race, roster, extras, res) {
    const raceDef = ROSTER_DEFS[race];
    if (!raceDef) { res.status(400).json({ error: `Unknown race: ${race}` }); return false; }
    if (roster.length < raceDef.min || roster.length > raceDef.max) {
        res.status(400).json({ error: `Roster must have ${raceDef.min}–${raceDef.max} players` }); return false;
    }
    for (const slot of roster) {
        const posDef = raceDef.positions.find(p => p.pos === slot.pos);
        if (!posDef) { res.status(400).json({ error: `Unknown position: ${slot.pos}` }); return false; }
        if (roster.filter(s => s.pos === slot.pos).length > posDef.limit) {
            res.status(400).json({ error: `Too many ${slot.pos}s (max ${posDef.limit})` }); return false;
        }
    }
    if (teamCost(race, roster, extras) > raceDef.budget) {
        res.status(400).json({ error: 'Team exceeds budget' }); return false;
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
    const extras = sanitizeExtras(req.body.extras);
    if (!validateRoster(race, roster, extras, res)) return;
    const hc = homeColour ? JSON.stringify(homeColour) : null;
    const ac = awayColour ? JSON.stringify(awayColour) : null;
    const result = db.prepare('INSERT INTO teams (user_id, name, race, roster, home_colour, away_colour, extras) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(req.session.userId, name, race, JSON.stringify(roster), hc, ac, JSON.stringify(extras));
    res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/teams/:id — update an existing team
router.put('/teams/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!existing) return res.status(404).json({ error: 'Team not found' });
    const { name, race, roster, homeColour, awayColour } = req.body;
    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });
    const extras = sanitizeExtras(req.body.extras);
    if (!validateRoster(race, roster, extras, res)) return;
    const hc = homeColour ? JSON.stringify(homeColour) : null;
    const ac = awayColour ? JSON.stringify(awayColour) : null;
    db.prepare('UPDATE teams SET name = ?, race = ?, roster = ?, home_colour = ?, away_colour = ?, extras = ? WHERE id = ?')
        .run(name, race, JSON.stringify(roster), hc, ac, JSON.stringify(extras), req.params.id);
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
