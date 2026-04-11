'use strict';
const express = require('express');
const crypto  = require('node:crypto');
const db      = require('../db');
const { requireAuth }  = require('../auth-middleware');
const { expandTeam }   = require('../../public/roster-defs');

const router = express.Router();

// ── SSE client registry ────────────────────────────────────────────
// roomClients: Map<roomId, Map<userId, res>>
const roomClients = new Map();

function getRoom(roomId) {
    if (!roomClients.has(roomId)) roomClients.set(roomId, new Map());
    return roomClients.get(roomId);
}

function sseWrite(res, eventName, data) {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(roomId, eventName, data) {
    const clients = getRoom(roomId);
    for (const res of clients.values()) sseWrite(res, eventName, data);
}

function sendTo(roomId, userId, eventName, data) {
    const res = getRoom(roomId).get(userId);
    if (res) sseWrite(res, eventName, data);
}

// ── Helpers ────────────────────────────────────────────────────────
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function makeToken(userId, username, teamDef) {
    const payload = Buffer.from(JSON.stringify({
        userId,
        username,
        teamDef,
        exp: Math.floor(Date.now() / 1000) + 300,
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
    return { ...row, roster: JSON.parse(row.roster), homeColour: parseColour(row.home_colour), awayColour: parseColour(row.away_colour) };
}

// ── GET /api/lobby ─────────────────────────────────────────────────
// Only show rooms that have no away user yet (still open to join).
router.get('/lobby', requireAuth, (_req, res) => {
    const rooms = db.prepare(
        'SELECT id, home_username, team_id, team_name, race FROM pending_rooms WHERE away_user_id IS NULL ORDER BY created_at ASC'
    ).all();
    res.json({ rooms });
});

// ── POST /api/lobby — create a room ───────────────────────────────
router.post('/lobby', requireAuth, (req, res) => {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = getTeamForUser(teamId, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const roomId = generateRoomId();
    db.prepare(
        'INSERT INTO pending_rooms (id, home_user_id, home_username, team_id, team_name, race) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(roomId, req.session.userId, req.session.username, team.id, team.name, team.race);

    res.json({ roomId });
});

// ── POST /api/lobby/:id/join — join a room ─────────────────────────
router.post('/lobby/:id/join', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.home_user_id === req.session.userId)
        return res.status(400).json({ error: 'You cannot join your own room' });
    if (room.away_user_id)
        return res.status(400).json({ error: 'Room is already full' });

    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = getTeamForUser(teamId, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    db.prepare(
        'UPDATE pending_rooms SET away_user_id=?, away_username=?, away_team_id=?, away_team_name=?, away_race=? WHERE id=?'
    ).run(req.session.userId, req.session.username, team.id, team.name, team.race, req.params.id);

    broadcast(req.params.id, 'joined', {
        awayUsername: req.session.username,
        awayTeamName: team.name,
        awayRace:     team.race,
    });

    res.json({ roomId: req.params.id });
});

// ── DELETE /api/lobby/:id — close/leave a room ─────────────────────
router.delete('/lobby/:id', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.home_user_id !== req.session.userId && room.away_user_id !== req.session.userId)
        return res.status(403).json({ error: 'Not in this room' });

    broadcast(req.params.id, 'closed', { by: req.session.username });
    db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(req.params.id);
    // Defer cleanup of the SSE map so the "closed" event can drain
    setTimeout(() => roomClients.delete(req.params.id), 2000);
    res.json({ ok: true });
});

// ── GET /api/room/:id/events — SSE stream ─────────────────────────
router.get('/room/:id/events', requireAuth, (req, res) => {
    const roomId = req.params.id;
    const room   = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(roomId);
    if (!room) return res.status(404).end();

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    // Register this client
    getRoom(roomId).set(req.session.userId, res);

    // Send current state as the first event
    const messages = db.prepare(
        'SELECT username, message FROM room_messages WHERE room_id = ? ORDER BY created_at ASC'
    ).all(roomId);

    sseWrite(res, 'init', {
        roomId,
        homeUsername: room.home_username,
        homeTeamName: room.team_name,
        homeRace:     room.race,
        awayUsername: room.away_username  || null,
        awayTeamName: room.away_team_name || null,
        awayRace:     room.away_race      || null,
        homeReady:    !!room.home_ready,
        awayReady:    !!room.away_ready,
        messages,
    });

    // Keepalive ping every 25 s
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
        clearInterval(ping);
        getRoom(roomId).delete(req.session.userId);
        if (getRoom(roomId).size === 0) {
            roomClients.delete(roomId);
            // Defer cleanup so brief reconnects don't wipe the room
            setTimeout(() => {
                if (!roomClients.has(roomId)) {
                    db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(roomId);
                    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(roomId);
                }
            }, 30000);
        }
    });
});

// ── POST /api/room/:id/message — send a chat message ──────────────
router.post('/room/:id/message', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.home_user_id !== req.session.userId && room.away_user_id !== req.session.userId)
        return res.status(403).json({ error: 'Not in this room' });
    if (!room.away_user_id)
        return res.status(400).json({ error: 'Waiting for opponent' });

    const text = (req.body.message || '').trim().slice(0, 280);
    if (!text) return res.status(400).json({ error: 'Message is empty' });

    db.prepare('INSERT INTO room_messages (room_id, username, message) VALUES (?, ?, ?)')
        .run(req.params.id, req.session.username, text);

    broadcast(req.params.id, 'message', { username: req.session.username, message: text });
    res.json({ ok: true });
});

// ── POST /api/room/:id/ready — toggle ready state ─────────────────
router.post('/room/:id/ready', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.away_user_id) return res.status(400).json({ error: 'Waiting for opponent' });

    const isHome = room.home_user_id === req.session.userId;
    const isAway = room.away_user_id === req.session.userId;
    if (!isHome && !isAway) return res.status(403).json({ error: 'Not in this room' });

    if (isHome) db.prepare('UPDATE pending_rooms SET home_ready = ? WHERE id = ?').run(room.home_ready ? 0 : 1, req.params.id);
    else        db.prepare('UPDATE pending_rooms SET away_ready = ? WHERE id = ?').run(room.away_ready ? 0 : 1, req.params.id);

    const updated = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    broadcast(req.params.id, 'ready', { homeReady: !!updated.home_ready, awayReady: !!updated.away_ready });

    // Both ready → generate tokens and launch
    if (updated.home_ready && updated.away_ready) {
        const homeTeam = getTeamForUser(updated.team_id,      updated.home_user_id);
        const awayTeam = getTeamForUser(updated.away_team_id, updated.away_user_id);

        if (homeTeam && awayTeam) {
            const base      = process.env.WEBBB_URL || 'http://localhost:3000';
            const homeToken = makeToken(updated.home_user_id, updated.home_username, expandTeam(homeTeam));
            const awayToken = makeToken(updated.away_user_id, updated.away_username, expandTeam(awayTeam));

            sendTo(req.params.id, updated.home_user_id, 'launch', {
                url: `${base}?token=${homeToken}&roomId=${req.params.id}&action=create`,
            });
            sendTo(req.params.id, updated.away_user_id, 'launch', {
                url: `${base}?token=${awayToken}&roomId=${req.params.id}&action=join`,
            });
            // Room and messages stay alive; cleanup happens when all SSE clients disconnect.
        }
    }

    res.json({ ok: true });
});

module.exports = router;
