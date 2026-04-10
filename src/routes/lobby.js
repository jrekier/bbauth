const express = require('express');
const crypto  = require('node:crypto');
const db      = require('../db');
const { requireAuth }  = require('../auth-middleware');
const { expandTeam }   = require('../../public/roster-defs');

const router = express.Router();

function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function makeToken(userId, username, teamDef) {
    const payload = Buffer.from(JSON.stringify({
        userId,
        username,
        teamDef,
        exp: Math.floor(Date.now() / 1000) + 300,  // 5 minutes
    })).toString('base64');
    const sig = crypto
        .createHmac('sha256', process.env.SHARED_SECRET)
        .update(payload)
        .digest('hex');
    return `${payload}.${sig}`;
}

function parseColour(raw) {
    if (!raw) return null;
    try {
        const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(c) && c.length === 3) return c;
    } catch {}
    return null;
}

function getTeamForUser(teamId, userId) {
    const row = db.prepare('SELECT * FROM teams WHERE id = ? AND user_id = ?').get(teamId, userId);
    if (!row) return null;
    return {
        ...row,
        roster:      JSON.parse(row.roster),
        homeColour:  parseColour(row.home_colour),
        awayColour:  parseColour(row.away_colour),
    };
}

// GET /api/lobby
router.get('/lobby', requireAuth, (req, res) => {
    const rooms = db.prepare(
        'SELECT id, home_username, team_id, team_name, race FROM pending_rooms ORDER BY created_at ASC'
    ).all();
    res.json({ rooms });
});

// POST /api/lobby  — body: { teamId }
router.post('/lobby', requireAuth, (req, res) => {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = getTeamForUser(teamId, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const teamDef = expandTeam(team);
    const roomId  = generateRoomId();
    const token   = makeToken(req.session.userId, req.session.username, teamDef);

    db.prepare(
        'INSERT INTO pending_rooms (id, home_user_id, home_username, team_id, team_name, race) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(roomId, req.session.userId, req.session.username, team.id, team.name, team.race);

    const webbbUrl = (process.env.WEBBB_URL || 'http://localhost:3000')
        + `?token=${token}&roomId=${roomId}&action=create`;
    res.json({ url: webbbUrl });
});

// POST /api/lobby/:id/join  — body: { teamId }
router.post('/lobby/:id/join', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.home_user_id === req.session.userId)
        return res.status(400).json({ error: 'You cannot join your own room' });

    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = getTeamForUser(teamId, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const teamDef = expandTeam(team);
    const token   = makeToken(req.session.userId, req.session.username, teamDef);

    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(req.params.id);

    const webbbUrl = (process.env.WEBBB_URL || 'http://localhost:3000')
        + `?token=${token}&roomId=${req.params.id}&action=join`;
    res.json({ url: webbbUrl });
});

// DELETE /api/lobby/:id
router.delete('/lobby/:id', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.home_user_id !== req.session.userId)
        return res.status(403).json({ error: 'Not your room' });
    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
});

module.exports = router;
