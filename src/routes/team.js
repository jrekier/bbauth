const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../auth-middleware');
const { ROSTER_DEFS, rosterCost } = require('../../public/roster-defs');
// roster-defs.js lives in public/ so it can be served to the browser as a static file.
// server-side we require() it directly from the same location.

const router = express.Router();

// All team routes require a logged-in session.
router.use(requireAuth);

// GET /api/team
router.get('/team', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE user_id = ?').get(req.session.userId);
    if (!team) return res.json({ team: null });
    res.json({ team: { ...team, roster: JSON.parse(team.roster) } });
});

// POST /api/team  — create or replace the team
router.post('/team', (req, res) => {
    const { name, race, roster } = req.body;

    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });

    const raceDef = ROSTER_DEFS[race];
    if (!raceDef)
        return res.status(400).json({ error: `Unknown race: ${race}` });

    if (roster.length < raceDef.min || roster.length > raceDef.max)
        return res.status(400).json({ error: `Roster must have ${raceDef.min}–${raceDef.max} players` });

    for (const slot of roster) {
        const posDef = raceDef.positions.find(p => p.pos === slot.pos);
        if (!posDef) return res.status(400).json({ error: `Unknown position: ${slot.pos}` });
        const count = roster.filter(s => s.pos === slot.pos).length;
        if (count > posDef.limit)
            return res.status(400).json({ error: `Too many ${slot.pos}s (max ${posDef.limit})` });
    }

    if (rosterCost(race, roster) > raceDef.budget)
        return res.status(400).json({ error: 'Roster exceeds budget' });

    const existing = db.prepare('SELECT id FROM teams WHERE user_id = ?').get(req.session.userId);
    if (existing) {
        db.prepare('UPDATE teams SET name = ?, race = ?, roster = ? WHERE user_id = ?')
          .run(name, race, JSON.stringify(roster), req.session.userId);
    } else {
        db.prepare('INSERT INTO teams (user_id, name, race, roster) VALUES (?, ?, ?, ?)')
          .run(req.session.userId, name, race, JSON.stringify(roster));
    }

    res.json({ ok: true });
});

// DELETE /api/team
router.delete('/team', (req, res) => {
    db.prepare('DELETE FROM teams WHERE user_id = ?').run(req.session.userId);
    res.json({ ok: true });
});

module.exports = router;
