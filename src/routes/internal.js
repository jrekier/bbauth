'use strict';
// Internal server-to-server endpoints called by webbb (signed, no session).
// These are the mirror direction of the play token: webbb signs the body with
// the shared secret and we verify it before trusting the call.

const express = require('express');
const db      = require('../db');
const { verify } = require('../sign');

const router = express.Router();

// ── POST /api/internal/match-result ───────────────────────────────
// webbb reports how a game ended. We record it and retire the staging room.
router.post('/internal/match-result', (req, res) => {
    if (!verify(req.rawBody, req.headers['x-bb-signature'])) {
        return res.status(401).json({ error: 'Bad signature' });
    }

    const { roomId, status, score, winner, home, away } = req.body;
    if (!roomId || !status) return res.status(400).json({ error: 'Missing fields' });

    db.prepare(`INSERT INTO matches (room_id, home_user_id, away_user_id, home_score, away_score, winner, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        roomId,
        home?.userId ?? null,
        away?.userId ?? null,
        score?.home  ?? 0,
        score?.away  ?? 0,
        winner ?? null,
        status,
    );

    // The staging room has served its purpose — remove it and its chat.
    db.prepare('DELETE FROM room_messages WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM pending_rooms WHERE id = ?').run(roomId);

    res.json({ ok: true });
});

module.exports = router;
