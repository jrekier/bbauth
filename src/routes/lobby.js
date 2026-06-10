'use strict';
const express = require('express');
const crypto  = require('node:crypto');
const db      = require('../db');
const { requireAuth }  = require('../auth-middleware');
const { expandTeam }   = require('../../public/roster-defs');
const { sign }         = require('../sign');

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

// ── Global lobby channel: presence + chat + ongoing games ──────────
// One SSE stream per logged-in user in the bbauth app (kept open across the
// whole session, including while in a game). Carries chat, presence (who's
// online + whether they're in a game), and the live ongoing-games list. A user
// may have several tabs open, so we track a set of responses per user.
// lobbyClients: Map<userId, { username, conns: Set<res> }>
const lobbyClients = new Map();

// Live games in progress, fed by webbb via /api/internal/match-update.
// roomId → { roomId, homeUserId, awayUserId, homeUsername, awayUsername,
//            homeRace, awayRace, score, turn, half, active, phase }
const liveGames = new Map();

function lobbyBroadcast(eventName, data) {
    const text = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of lobbyClients.values())
        for (const res of client.conns) res.write(text);
}

// Which game (if any) a user is currently playing in.
function gameForUser(userId) {
    for (const g of liveGames.values())
        if (g.homeUserId === userId || g.awayUserId === userId) return g;
    return null;
}

// Presence = online users (SSE-connected), each tagged in-game or in-lobby.
function lobbyPresence() {
    return [...lobbyClients.entries()]
        .map(([userId, c]) => {
            const g = gameForUser(userId);
            return { username: c.username, status: g ? 'in-game' : 'lobby', roomId: g ? g.roomId : null };
        })
        .sort((a, b) => a.username.localeCompare(b.username));
}

// Public view of the ongoing games for the lobby list.
const WEBBB_ORIGIN = process.env.WEBBB_URL || 'http://localhost:3000';

function lobbyGamesList() {
    return [...liveGames.values()].map(g => ({
        roomId: g.roomId, origin: WEBBB_ORIGIN,
        home: g.homeUsername, away: g.awayUsername,
        homeRace: g.homeRace, awayRace: g.awayRace,
        homeTeam: g.homeTeamName, awayTeam: g.awayTeamName,
        score: g.score, turn: g.turn, half: g.half, phase: g.phase,
    }));
}

function broadcastPresence() { lobbyBroadcast('presence', { online: lobbyPresence() }); }
function broadcastGames()    { lobbyBroadcast('games',    { games: lobbyGamesList() }); }

// Upsert a live game from a webbb match-update. On first sight we enrich it with
// the players/teams from the staging room (still present until the match ends).
function setLiveGame(roomId, partial) {
    let g = liveGames.get(roomId);
    if (!g) {
        const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(roomId);
        if (!room) return;   // result already processed / unknown room — ignore
        g = {
            roomId,
            homeUserId: room.home_user_id, awayUserId: room.away_user_id,
            homeUsername: room.home_username, awayUsername: room.away_username,
            homeRace: room.race, awayRace: room.away_race,
            homeTeamName: room.team_name, awayTeamName: room.away_team_name,
            score: { home: 0, away: 0 }, turn: null, half: null, active: null, phase: null,
        };
        liveGames.set(roomId, g);
    }
    Object.assign(g, partial);
    broadcastGames();
    broadcastPresence();   // a player's status may have flipped to in-game
}

function endLiveGame(roomId) {
    if (!liveGames.delete(roomId)) return;
    broadcastGames();
    broadcastPresence();
}

// ── GET /api/lobby/events — global lobby SSE ───────────────────────
router.get('/lobby/events', requireAuth, (req, res) => {
    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.flushHeaders();

    const { userId, username } = req.session;
    let entry = lobbyClients.get(userId);
    const firstConnection = !entry;
    if (!entry) { entry = { username, conns: new Set() }; lobbyClients.set(userId, entry); }
    entry.conns.add(res);

    // Opening snapshot: presence + ongoing games + recent chat backlog.
    const messages = db.prepare(
        'SELECT username, message FROM lobby_messages ORDER BY id DESC LIMIT 50'
    ).all().reverse();
    sseWrite(res, 'init', { online: lobbyPresence(), games: lobbyGamesList(), messages });

    // Announce arrival only when the user wasn't already present (another tab).
    if (firstConnection) broadcastPresence();

    const ping = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
        clearInterval(ping);
        const e = lobbyClients.get(userId);
        if (!e) return;
        e.conns.delete(res);
        if (e.conns.size === 0) {
            lobbyClients.delete(userId);
            broadcastPresence();
        }
    });
});

// ── POST /api/lobby/chat — send a global lobby message ─────────────
router.post('/lobby/chat', requireAuth, (req, res) => {
    const text = (req.body.message || '').trim().slice(0, 280);
    if (!text) return res.status(400).json({ error: 'Message is empty' });

    db.prepare('INSERT INTO lobby_messages (user_id, username, message) VALUES (?, ?, ?)')
        .run(req.session.userId, req.session.username, text);
    // Keep only the most recent ~200 messages.
    db.prepare('DELETE FROM lobby_messages WHERE id <= (SELECT MAX(id) - 200 FROM lobby_messages)').run();

    lobbyBroadcast('chat', { username: req.session.username, message: text });
    res.json({ ok: true });
});

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

    let resolvedTeamId = null, teamName = null, race = null;
    if (teamId) {
        const team = getTeamForUser(teamId, req.session.userId);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        resolvedTeamId = team.id;
        teamName       = team.name;
        race           = team.race;
    }

    const roomId = generateRoomId();
    db.prepare(
        'INSERT INTO pending_rooms (id, home_user_id, home_username, team_id, team_name, race) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(roomId, req.session.userId, req.session.username, resolvedTeamId, teamName, race);

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

    let resolvedTeamId = null, teamName = null, race = null;
    if (teamId) {
        const team = getTeamForUser(teamId, req.session.userId);
        if (!team) return res.status(404).json({ error: 'Team not found' });
        resolvedTeamId = team.id;
        teamName       = team.name;
        race           = team.race;
    }

    db.prepare(
        'UPDATE pending_rooms SET away_user_id=?, away_username=?, away_team_id=?, away_team_name=?, away_race=? WHERE id=?'
    ).run(req.session.userId, req.session.username, resolvedTeamId, teamName, race, req.params.id);

    broadcast(req.params.id, 'joined', {
        awayUsername: req.session.username,
        awayTeamName: teamName,
        awayRace:     race,
    });

    res.json({ roomId: req.params.id });
});

// ── DELETE /api/lobby/:id — close/leave a room ─────────────────────
router.delete('/lobby/:id', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isHome = room.home_user_id === req.session.userId;
    const isAway = room.away_user_id === req.session.userId;
    if (!isHome && !isAway) return res.status(403).json({ error: 'Not in this room' });

    // Away player leaving — remove them but keep the room open for home
    if (isAway) {
        db.prepare(`UPDATE pending_rooms
            SET away_user_id=NULL, away_username=NULL,
                away_team_id=NULL, away_team_name=NULL, away_race=NULL,
                home_ready=0, away_ready=0
            WHERE id=?`).run(req.params.id);
        broadcast(req.params.id, 'left', { username: req.session.username });
        return res.json({ ok: true });
    }

    // Home player leaving — close the room entirely
    broadcast(req.params.id, 'closed', { by: req.session.username });
    db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(req.params.id);
    endLiveGame(req.params.id);
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
                    endLiveGame(roomId);
                }
            }, 30000);
        }
    });
});

// ── POST /api/room/:id/message — send a chat message ──────────────
router.post('/room/:id/message', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    // Chat is open from the moment the room exists — to the creator waiting
    // alone, the opponent, and any watchers. The client colour-codes
    // home / away / spectator names.

    const text = (req.body.message || '').trim().slice(0, 280);
    if (!text) return res.status(400).json({ error: 'Message is empty' });

    db.prepare('INSERT INTO room_messages (room_id, username, message) VALUES (?, ?, ?)')
        .run(req.params.id, req.session.username, text);

    broadcast(req.params.id, 'message', { username: req.session.username, message: text });
    res.json({ ok: true });
});

// ── POST /api/room/:id/quit — quit an in-progress game ────────────
router.post('/room/:id/quit', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isHome = room.home_user_id === req.session.userId;
    const isAway = room.away_user_id === req.session.userId;
    if (!isHome && !isAway) return res.status(403).json({ error: 'Not in this room' });

    broadcast(req.params.id, 'quit', { username: req.session.username });
    db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(req.params.id);
    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(req.params.id);
    endLiveGame(req.params.id);   // drop it from the lobby immediately, not after webbb's grace
    setTimeout(() => roomClients.delete(req.params.id), 2000);

    res.json({ ok: true });
});

// ── POST /api/room/:id/team — pick / change team ──────────────────
router.post('/room/:id/team', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const isHome = room.home_user_id === req.session.userId;
    const isAway = room.away_user_id === req.session.userId;
    if (!isHome && !isAway) return res.status(403).json({ error: 'Not in this room' });

    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId is required' });

    const team = getTeamForUser(teamId, req.session.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (isHome) {
        db.prepare('UPDATE pending_rooms SET team_id=?, team_name=?, race=? WHERE id=?')
            .run(team.id, team.name, team.race, req.params.id);
    } else {
        db.prepare('UPDATE pending_rooms SET away_team_id=?, away_team_name=?, away_race=? WHERE id=?')
            .run(team.id, team.name, team.race, req.params.id);
    }

    broadcast(req.params.id, 'team', {
        side:     isHome ? 'home' : 'away',
        teamName: team.name,
        race:     team.race,
    });

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

    if (isHome && !room.team_id)      return res.status(400).json({ error: 'Pick a team first' });
    if (isAway && !room.away_team_id) return res.status(400).json({ error: 'Pick a team first' });

    if (isHome) db.prepare('UPDATE pending_rooms SET home_ready = ? WHERE id = ?').run(room.home_ready ? 0 : 1, req.params.id);
    else        db.prepare('UPDATE pending_rooms SET away_ready = ? WHERE id = ?').run(room.away_ready ? 0 : 1, req.params.id);

    const updated = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    broadcast(req.params.id, 'ready', { homeReady: !!updated.home_ready, awayReady: !!updated.away_ready });

    // Both ready → pre-register the match with webbb, then launch both players.
    if (updated.home_ready && updated.away_ready) {
        const homeTeam = getTeamForUser(updated.team_id,      updated.home_user_id);
        const awayTeam = getTeamForUser(updated.away_team_id, updated.away_user_id);

        if (homeTeam && awayTeam) {
            const base        = process.env.WEBBB_URL || 'http://localhost:3000';
            const homeTeamDef = expandTeam(homeTeam);
            const awayTeamDef = expandTeam(awayTeam);
            const homeToken   = makeToken(updated.home_user_id, updated.home_username, homeTeamDef);
            const awayToken   = makeToken(updated.away_user_id, updated.away_username, awayTeamDef);

            // Register the game room server-to-server BEFORE redirecting either
            // browser. The room then exists before anyone connects, so there is no
            // create/join race — each player just attaches to their slot. Only once
            // webbb confirms do we push the launch URLs (no action param needed —
            // the token's userId identifies the side).
            const regBody = JSON.stringify({
                roomId: req.params.id,
                home: { userId: updated.home_user_id, username: updated.home_username, teamDef: homeTeamDef },
                away: { userId: updated.away_user_id, username: updated.away_username, teamDef: awayTeamDef },
            });
            fetch(`${base}/internal/match`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'X-BB-Signature': sign(regBody) },
                body:    regBody,
            })
                .then(r => {
                    if (!r.ok) throw new Error(`webbb returned ${r.status}`);
                    sendTo(req.params.id, updated.home_user_id, 'launch', { url: `${base}?token=${homeToken}&roomId=${req.params.id}` });
                    sendTo(req.params.id, updated.away_user_id, 'launch', { url: `${base}?token=${awayToken}&roomId=${req.params.id}` });
                    // Tell any watchers (who don't get the per-player launch URL) that
                    // the game has begun, so they can switch to spectating it.
                    broadcast(req.params.id, 'started', { origin: base, roomId: req.params.id });
                    // Room and messages stay alive; cleanup happens when all SSE clients disconnect.
                })
                .catch(e => {
                    console.error(`Match registration failed for room ${req.params.id}:`, e.message);
                    broadcast(req.params.id, 'launch_failed', { error: 'Could not start the game — try readying up again.' });
                });
        }
    }

    res.json({ ok: true });
});

module.exports = router;
// Live-game hooks called by the signed internal routes (see internal.js).
module.exports.setLiveGame = setLiveGame;
module.exports.endLiveGame = endLiveGame;
