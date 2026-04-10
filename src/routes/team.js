const express     = require('express');
const db          = require('../db');
const { requireAuth } = require('../auth-middleware');
const { ROSTER_DEFS, rosterCost } = require('../../public/roster-defs');

const router = express.Router();
router.use(requireAuth);

function validateRoster(race, roster, res) {
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
    if (rosterCost(race, roster) > raceDef.budget) {
        res.status(400).json({ error: 'Roster exceeds budget' }); return false;
    }
    return true;
}

// GET /api/teams — list all teams for the logged-in user
router.get('/teams', (req, res) => {
    const teams = db.prepare('SELECT * FROM teams WHERE user_id = ? ORDER BY created_at ASC').all(req.session.userId);
    res.json({ teams: teams.map(t => ({ ...t, roster: JSON.parse(t.roster) })) });
});

// GET /api/teams/:id
router.get('/teams/:id', (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: { ...team, roster: JSON.parse(team.roster) } });
});

// POST /api/teams — create a new team
router.post('/teams', (req, res) => {
    const { name, race, roster } = req.body;
    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });
    if (!validateRoster(race, roster, res)) return;
    const result = db.prepare('INSERT INTO teams (user_id, name, race, roster) VALUES (?, ?, ?, ?)')
        .run(req.session.userId, name, race, JSON.stringify(roster));
    res.json({ ok: true, id: result.lastInsertRowid });
});

// PUT /api/teams/:id — update an existing team
router.put('/teams/:id', (req, res) => {
    const existing = db.prepare('SELECT id FROM teams WHERE id = ? AND user_id = ?').get(req.params.id, req.session.userId);
    if (!existing) return res.status(404).json({ error: 'Team not found' });
    const { name, race, roster } = req.body;
    if (!name || !race || !Array.isArray(roster))
        return res.status(400).json({ error: 'name, race, and roster are required' });
    if (!validateRoster(race, roster, res)) return;
    db.prepare('UPDATE teams SET name = ?, race = ?, roster = ? WHERE id = ?')
        .run(name, race, JSON.stringify(roster), req.params.id);
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
