'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { requireAuth } = require('../auth-middleware');

const router = express.Router();

// ── Profile helpers (shared with auth.js: /me, login, register) ─────

function getUser(userId) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

// Public profile payload the client consumes (never the password hash).
// No win/loss record by design — the vibe is friendly; competitive records
// belong to teams under a future league/tournament system.
function profile(row) {
    return {
        userId:      row.id,
        username:    row.username,
        displayName: row.display_name || row.username,
        avatarUrl:   row.avatar_url || null,
        email:       row.email || null,
        hasPassword: !!row.password_hash,   // false → Google-only (hide change-password)
        createdAt:   row.created_at,
    };
}

// Minimal identity for rendering a user elsewhere (presence, chat, matchup).
function identity(userId) {
    const row = db.prepare('SELECT username, display_name, avatar_url FROM users WHERE id = ?').get(userId);
    if (!row) return null;
    return { username: row.username, displayName: row.display_name || row.username, avatarUrl: row.avatar_url || null };
}

// ── PUT /api/account — update the editable profile (display name) ───
router.put('/account', requireAuth, (req, res) => {
    const dn = (req.body.displayName || '').trim();
    if (dn.length < 1 || dn.length > 32)
        return res.status(400).json({ error: 'Display name must be 1–32 characters' });

    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(dn, req.session.userId);
    req.session.displayName = dn;

    // Reflect the new name live in lobby presence. Required lazily to avoid a
    // load-order cycle with lobby.js.
    try { require('./lobby').refreshMemberIdentity(req.session.userId); } catch {}

    res.json(profile(getUser(req.session.userId)));
});

// ── POST /api/account/password — change password (password accounts) ─
router.post('/account/password', requireAuth, async (req, res) => {
    const row = getUser(req.session.userId);
    if (!row)               return res.status(404).json({ error: 'Account not found' });
    if (!row.password_hash) return res.status(400).json({ error: 'This account signs in with Google' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ error: 'Current and new password are required' });
    if (newPassword.length < 8)
        return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);
    res.json({ ok: true });
});

module.exports = router;
module.exports.profile  = profile;
module.exports.getUser  = getUser;
module.exports.identity = identity;
