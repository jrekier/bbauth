'use strict';
const express = require('express');
const crypto  = require('node:crypto');
const db      = require('../db');
const { requireAuth }  = require('../auth-middleware');
const { expandTeam, teamValue, availableInducements, inducementCost,
        inducementsCost, inducementBudget, PETTY_CASH_TOP_UP,
        PRAYERS_TO_NUFFLE, DESPERATE_MEASURES, rollD8Table, applyPrayers } = require('../../public/roster-defs');
const { sign }         = require('../sign');
const { identity }     = require('./account');   // { username, displayName, avatarUrl } by userId

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

// Presence = online users (SSE-connected), each tagged in-game or in-lobby,
// carrying their display name + avatar so the client shows identity, not handle.
function lobbyPresence() {
    return [...lobbyClients.entries()]
        .map(([userId, c]) => {
            const g = gameForUser(userId);
            return {
                username: c.username, displayName: c.displayName, avatarUrl: c.avatar,
                status: g ? 'in-game' : 'lobby', roomId: g ? g.roomId : null,
            };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

// Re-read a member's identity (called after they change their display name) and
// push the updated presence list to everyone.
function refreshMemberIdentity(userId) {
    const e = lobbyClients.get(userId);
    if (!e) return;
    const id = identity(userId);
    if (id) { e.displayName = id.displayName; e.avatar = id.avatarUrl; }
    broadcastPresence();
}

// Public view of the ongoing games for the lobby list.
const WEBBB_ORIGIN = process.env.WEBBB_URL || 'http://localhost:3000';

function lobbyGamesList() {
    return [...liveGames.values()].map(g => ({
        roomId: g.roomId, origin: WEBBB_ORIGIN,
        home: g.homeDisplay || g.homeUsername, away: g.awayDisplay || g.awayUsername,
        homeAvatar: g.homeAvatar || null, awayAvatar: g.awayAvatar || null,
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
        const hi = identity(room.home_user_id) || {};
        const ai = room.away_user_id ? (identity(room.away_user_id) || {}) : {};
        g = {
            roomId,
            homeUserId: room.home_user_id, awayUserId: room.away_user_id,
            homeUsername: room.home_username, awayUsername: room.away_username,
            homeDisplay: hi.displayName || room.home_username, awayDisplay: ai.displayName || room.away_username,
            homeAvatar: hi.avatarUrl || null, awayAvatar: ai.avatarUrl || null,
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

    const { userId, username, displayName, avatarUrl } = req.session;
    let entry = lobbyClients.get(userId);
    const firstConnection = !entry;
    if (!entry) {
        entry = { username, displayName: displayName || username, avatar: avatarUrl || null, conns: new Set() };
        lobbyClients.set(userId, entry);
    }
    entry.conns.add(res);

    // Opening snapshot: presence + ongoing games + recent chat backlog (resolved
    // to each sender's current display name + avatar).
    const messages = db.prepare(
        `SELECT m.message, u.username,
                COALESCE(u.display_name, u.username) AS displayName, u.avatar_url AS avatarUrl
         FROM lobby_messages m JOIN users u ON u.id = m.user_id
         ORDER BY m.id DESC LIMIT 50`
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

    lobbyBroadcast('chat', {
        username: req.session.username,
        displayName: req.session.displayName || req.session.username,
        avatarUrl: req.session.avatarUrl || null,
        message: text,
    });
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
        awayDisplay:  req.session.displayName || req.session.username,
        awayAvatar:   req.session.avatarUrl || null,
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

    // Send current state as the first event (chat backlog resolved to each
    // sender's current display name + avatar).
    const messages = db.prepare(
        `SELECT m.message, m.username,
                COALESCE(u.display_name, m.username) AS displayName, u.avatar_url AS avatarUrl
         FROM room_messages m LEFT JOIN users u ON u.username = m.username
         WHERE m.room_id = ? ORDER BY m.created_at ASC`
    ).all(roomId);

    const homeId = identity(room.home_user_id) || {};
    const awayId = room.away_user_id ? (identity(room.away_user_id) || {}) : {};
    sseWrite(res, 'init', {
        roomId,
        homeUsername: room.home_username,
        homeDisplay:  homeId.displayName || room.home_username,
        homeAvatar:   homeId.avatarUrl || null,
        homeTeamName: room.team_name,
        homeRace:     room.race,
        awayUsername: room.away_username  || null,
        awayDisplay:  room.away_user_id ? (awayId.displayName || room.away_username) : null,
        awayAvatar:   awayId.avatarUrl || null,
        awayTeamName: room.away_team_name || null,
        awayRace:     room.away_race      || null,
        homeReady:    !!room.home_ready,
        awayReady:    !!room.away_ready,
        inducementTurn: room.inducement_turn || null,
        // Live CTVs from whatever teams are currently picked, so both coaches
        // can see the gap (and who will get petty cash) before readying up.
        homeTV:       room.inducement_turn ? (room.home_tv || 0) : liveTV(room, 'home'),
        awayTV:       room.inducement_turn ? (room.away_tv || 0) : liveTV(room, 'away'),
        messages,
    });

    // Announce watchers (anyone connecting who isn't one of the two players).
    // Remember on the connection whether we announced them, so we only emit the
    // matching "stopped watching" — never for a player whose seat was vacated.
    res._announcedSpectator = req.session.userId !== room.home_user_id && req.session.userId !== room.away_user_id;
    if (res._announcedSpectator) broadcast(roomId, 'spectator', { username: req.session.username, displayName: req.session.displayName || req.session.username, action: 'joined' });

    // Keepalive ping every 25 s
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);

    req.on('close', () => {
        clearInterval(ping);
        getRoom(roomId).delete(req.session.userId);
        // Announce "stopped watching" only for a connection we announced as a
        // watcher AND who still isn't in a seat — so taking a seat (then the old
        // watcher socket closing) stays silent.
        const cur = db.prepare('SELECT home_user_id, away_user_id FROM pending_rooms WHERE id = ?').get(roomId);
        if (res._announcedSpectator && cur && req.session.userId !== cur.home_user_id && req.session.userId !== cur.away_user_id)
            broadcast(roomId, 'spectator', { username: req.session.username, displayName: req.session.displayName || req.session.username, action: 'left' });
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

// ── GET /api/room/:id/team/:side — scout a side's roster ──────────
// Any room participant (player or watcher) may inspect either team before the
// game starts. Returns the raw roster (the client renders stats from its own
// ROSTER_DEFS). Reflects the team currently selected, so last-minute swaps show.
router.get('/room/:id/team/:side', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    const teamId = req.params.side === 'home' ? room.team_id
                 : req.params.side === 'away' ? room.away_team_id
                 : null;
    if (!teamId) return res.json({ team: null });   // no team picked for that seat yet

    const t = db.prepare('SELECT name, race, roster, home_colour FROM teams WHERE id = ?').get(teamId);
    if (!t) return res.json({ team: null });
    res.json({ team: { name: t.name, race: t.race, roster: JSON.parse(t.roster), homeColour: parseColour(t.home_colour) } });
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

    broadcast(req.params.id, 'message', {
        username: req.session.username,
        displayName: req.session.displayName || req.session.username,
        avatarUrl: req.session.avatarUrl || null,
        message: text,
    });
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

    const updatedRoom = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    broadcast(req.params.id, 'team', {
        side:     isHome ? 'home' : 'away',
        teamName: team.name,
        race:     team.race,
        homeTV:   liveTV(updatedRoom, 'home'),
        awayTV:   liveTV(updatedRoom, 'away'),
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

    // Both ready → open the inducement step. Nobody launches until it is done.
    if (updated.home_ready && updated.away_ready) {
        openInducements(req.params.id, updated);
    } else if (updated.inducement_turn) {
        // Someone un-readied mid-purchase: abandon the step and start over.
        db.prepare(`UPDATE pending_rooms SET inducement_turn = NULL,
                    home_inducements = NULL, away_inducements = NULL,
                    home_treasury_spend = 0, away_treasury_spend = 0 WHERE id = ?`).run(req.params.id);
        broadcast(req.params.id, 'inducements_cancelled', {
            byName: req.session.displayName || req.session.username,
        });
    }

    res.json({ ok: true });
});

// ── launchMatch ───────────────────────────────────────────────────
// Pre-register the match with webbb, then push each coach their launch URL.
// Called once the inducement step is finished, never before: the inducements
// bought in the staging room are folded into each team def here, so webbb
// receives finished teams and needs no inducement logic of its own.
function launchMatch(roomId, room) {
    const homeTeam = getTeamForUser(room.team_id,      room.home_user_id);
    const awayTeam = getTeamForUser(room.away_team_id, room.away_user_id);
    if (!homeTeam || !awayTeam) return;

    const base      = process.env.WEBBB_URL || 'http://localhost:3000';
    const homeInd   = parseInducements(room.home_inducements);
    const awayInd   = parseInducements(room.away_inducements);
    const homeTeamDef = expandTeam({ ...homeTeam, inducements: homeInd });
    const awayTeamDef = expandTeam({ ...awayTeam, inducements: awayInd });

    // Prayers and Desperate Measures are rolled here, once, at the last moment
    // before the match exists — so both coaches see the same result and neither
    // can re-roll them by leaving the room. Player-buff prayers are baked into
    // the team def; the rest ride along as keys for webbb to act on.
    // Dev-only override so the random tables can be tested on demand:
    //   BB_FORCE_PRAYERS=treacherousTrapdoor,molesUnderPitch ./dev
    //   BB_FORCE_PRAYERS_AWAY=underScrutiny   (per-side; falls back to both)
    // Only ever applied to a side that actually bought at least one Prayer.
    const forced = (side) => {
        const raw = process.env[`BB_FORCE_PRAYERS_${side.toUpperCase()}`] || process.env.BB_FORCE_PRAYERS;
        if (!raw) return null;
        const keys = raw.split(',').map(k => k.trim()).filter(Boolean)
            .filter(k => PRAYERS_TO_NUFFLE.some(p => p.key === k));
        return keys.length ? keys : null;
    };

    const prayerLog = [];
    for (const [def, ind, side] of [[homeTeamDef, homeInd, 'home'], [awayTeamDef, awayInd, 'away']]) {
        const bought = ind.prayersToNuffle || 0;
        const force  = bought > 0 ? forced(side) : null;
        if (force) console.log(`Room ${roomId}: FORCED prayers for ${side} — ${force.join(', ')}`);
        def.prayers           = force || rollD8Table(PRAYERS_TO_NUFFLE, bought);
        def.desperateMeasures = rollD8Table(DESPERATE_MEASURES, ind.desperateMeasures || 0);
        prayerLog.push(...applyPrayers(def, def.prayers));
    }
    if (prayerLog.length) {
        for (const line of prayerLog) console.log(`Room ${roomId}: ${line}`);
        broadcast(roomId, 'prayers', { log: prayerLog });
    }

    const homeToken   = makeToken(room.home_user_id, room.home_username, homeTeamDef);
    const awayToken   = makeToken(room.away_user_id, room.away_username, awayTeamDef);

    // Register the game room server-to-server BEFORE redirecting either browser.
    // The room then exists before anyone connects, so there is no create/join
    // race — each player just attaches to their slot. Only once webbb confirms
    // do we push the launch URLs (no action param needed — the token's userId
    // identifies the side).
    const regBody = JSON.stringify({
        roomId,
        home: { userId: room.home_user_id, username: room.home_username, teamDef: homeTeamDef },
        away: { userId: room.away_user_id, username: room.away_username, teamDef: awayTeamDef },
    });
    fetch(`${base}/internal/match`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-BB-Signature': sign(regBody) },
        body:    regBody,
    })
        .then(r => {
            if (!r.ok) throw new Error(`webbb returned ${r.status}`);
            sendTo(roomId, room.home_user_id, 'launch', { url: `${base}?token=${homeToken}&roomId=${roomId}` });
            sendTo(roomId, room.away_user_id, 'launch', { url: `${base}?token=${awayToken}&roomId=${roomId}` });
            // Tell any watchers (who don't get the per-player launch URL) that the
            // game has begun, so they can switch to spectating it.
            broadcast(roomId, 'started', { origin: base, roomId });
            // Room and messages stay alive; cleanup happens when all SSE clients disconnect.
        })
        .catch(e => {
            console.error(`Match registration failed for room ${roomId}:`, e.message);
            broadcast(roomId, 'launch_failed', { error: 'Could not start the game — try readying up again.' });
        });
}

// ── League Play: petty cash and inducements ───────────────────────
// Both coaches are ready, so both CTVs are known and fixed. The book's order:
// the higher-CTV coach spends Treasury first, then the lower-CTV coach receives
// Petty Cash equal to the CTV gap plus whatever the first coach spent, and may
// top that up with at most 50,000 of their own gold. Only then does the match
// launch. With equal CTVs there is no underdog and no petty cash — each coach
// simply spends their own Treasury.

// CTV of whichever team a side currently has picked, or 0 if none yet.
function liveTV(room, side) {
    const teamId = side === 'home' ? room.team_id      : room.away_team_id;
    const userId = side === 'home' ? room.home_user_id : room.away_user_id;
    if (!teamId || !userId) return 0;
    const t = getTeamForUser(teamId, userId);
    return t ? teamValue(t.race, t.roster, parseExtras(t.extras)) : 0;
}

// Freeze both CTVs and hand the first turn to the richer coach.
function openInducements(roomId, room) {
    const homeTeam = getTeamForUser(room.team_id,      room.home_user_id);
    const awayTeam = getTeamForUser(room.away_team_id, room.away_user_id);
    if (!homeTeam || !awayTeam) return;

    const homeTV = teamValue(homeTeam.race, homeTeam.roster, parseExtras(homeTeam.extras));
    const awayTV = teamValue(awayTeam.race, awayTeam.roster, parseExtras(awayTeam.extras));
    const first  = awayTV > homeTV ? 'away' : 'home';   // ties: home goes first

    db.prepare(`UPDATE pending_rooms SET home_tv = ?, away_tv = ?, inducement_turn = ?,
                home_inducements = NULL, away_inducements = NULL,
                home_treasury_spend = 0, away_treasury_spend = 0 WHERE id = ?`)
        .run(homeTV, awayTV, first, roomId);

    broadcast(roomId, 'inducements', { homeTV, awayTV, turn: first });
}

function parseExtras(raw) {
    if (raw && typeof raw === 'object') return raw;
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function parseInducements(raw) {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

// What `side` may spend right now, and on what.
function inducementStateFor(room, side) {
    const other      = side === 'home' ? 'away' : 'home';
    const myTV       = room[`${side}_tv`]  || 0;
    const theirTV    = room[`${other}_tv`] || 0;
    const teamId     = side === 'home' ? room.team_id      : room.away_team_id;
    const userId     = side === 'home' ? room.home_user_id : room.away_user_id;
    const team       = getTeamForUser(teamId, userId);
    if (!team) return null;

    // The first coach to buy sees no opponent spend yet; the second sees it.
    const theirSpend = room[`${other}_treasury_spend`] || 0;
    const budget     = inducementBudget(myTV, theirTV, theirSpend, team.treasury || 0);

    return {
        side, race: team.race, myTV, theirTV,
        teamName:   team.name,
        underdog:   budget.petty > 0,
        treasury:   team.treasury || 0,
        petty:      budget.petty,
        // Where the petty cash came from, so the number is never a mystery.
        pettyGap:   Math.max(0, theirTV - myTV),
        pettyFromOpponent: theirSpend,
        treasuryCap: budget.fromTreasury,
        topUpLimit: budget.petty > 0 ? PETTY_CASH_TOP_UP : null,
        total:      budget.total,
        turn:       room.inducement_turn,
        bought:     parseInducements(room[`${side}_inducements`]),
        // What the opponent has already bought, once they have committed. The
        // rules put the richer coach first precisely so the underdog can react.
        opponentBought: room[`${other}_inducements`] ? parseInducements(room[`${other}_inducements`]) : null,
        catalogue:  availableInducements(team.race).map(ind => ({
            key: ind.key, label: ind.label, max: ind.max, text: ind.text || '',
            cost: inducementCost(team.race, ind), implemented: !!ind.implemented,
            discounted: inducementCost(team.race, ind) < ind.cost,
        })),
    };
}

function sideOf(room, userId) {
    if (room.home_user_id === userId) return 'home';
    if (room.away_user_id === userId) return 'away';
    return null;
}

// ── GET /api/room/:id/inducements — what can I buy, and is it my turn?
router.get('/room/:id/inducements', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const side = sideOf(room, req.session.userId);
    if (!side) return res.status(403).json({ error: 'Not in this room' });
    const state = inducementStateFor(room, side);
    if (!state) return res.status(400).json({ error: 'Team not found' });
    res.json(state);
});

// ── POST /api/room/:id/inducements — commit this coach's purchase ──
router.post('/room/:id/inducements', requireAuth, (req, res) => {
    const room = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    const side = sideOf(room, req.session.userId);
    if (!side) return res.status(403).json({ error: 'Not in this room' });
    if (room.inducement_turn !== side) return res.status(409).json({ error: 'Not your turn to buy' });

    const state = inducementStateFor(room, side);
    if (!state) return res.status(400).json({ error: 'Team not found' });

    // Keep only inducements this race may take, as non-negative integers, and
    // clamp to the rulebook maximum. Unlike drafting — where the coaches are
    // free to agree anything (see team.js) — these limits are enforced: this is
    // a real budget, and part of it is the opponent's gold.
    const raw    = req.body.inducements && typeof req.body.inducements === 'object' ? req.body.inducements : {};
    const bought = {};
    for (const ind of state.catalogue) {
        const n = Math.max(0, Math.min(ind.max, Math.floor(Number(raw[ind.key]) || 0)));
        if (n) bought[ind.key] = n;
    }

    // Unlike drafting, this one IS enforced: petty cash is a hard budget, and a
    // coach who overspends here is taking gold that does not exist.
    const spend = inducementsCost(state.race, bought);
    if (spend > state.total) {
        return res.status(400).json({ error: `That costs ${spend.toLocaleString()} gp — you have ${state.total.toLocaleString()}` });
    }

    // Petty cash is spent first; only the remainder comes out of Treasury.
    const fromTreasury = Math.max(0, spend - state.petty);
    db.prepare(`UPDATE pending_rooms SET ${side}_inducements = ?, ${side}_treasury_spend = ? WHERE id = ?`)
        .run(JSON.stringify(bought), fromTreasury, req.params.id);

    const after = db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id);
    const other = side === 'home' ? 'away' : 'home';

    // Announce it: the underdog is entitled to know what the richer coach
    // bought, since their petty cash depends on it.
    const bill = state.catalogue
        .filter(c => bought[c.key])
        .map(c => `${bought[c.key]}x ${c.label}`)
        .join(', ');
    broadcast(req.params.id, 'inducements_bought', {
        side, teamName: state.teamName,
        summary: bill || 'nothing',
        spent: spend,
    });

    // First coach done → hand over. Second coach done → launch.
    if (after[`${other}_inducements`] === null) {
        db.prepare('UPDATE pending_rooms SET inducement_turn = ? WHERE id = ?').run(other, req.params.id);
        broadcast(req.params.id, 'inducements', {
            homeTV: after.home_tv, awayTV: after.away_tv, turn: other,
        });
    } else {
        db.prepare('UPDATE pending_rooms SET inducement_turn = NULL WHERE id = ?').run(req.params.id);
        broadcast(req.params.id, 'inducements', {
            homeTV: after.home_tv, awayTV: after.away_tv, turn: null,
        });
        launchMatch(req.params.id, db.prepare('SELECT * FROM pending_rooms WHERE id = ?').get(req.params.id));
    }

    res.json({ ok: true, spent: spend, fromTreasury });
});

module.exports = router;
// Live-game hooks called by the signed internal routes (see internal.js).
module.exports.setLiveGame = setLiveGame;
module.exports.endLiveGame = endLiveGame;
// Called by account.js when a user changes their display name.
module.exports.refreshMemberIdentity = refreshMemberIdentity;
