const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');
const { profile, getUser } = require('./account');

const router = express.Router();

// Store the identity needed for presence on the session.
function startSession(req, user) {
    req.session.userId      = user.id;
    req.session.username    = user.username;
    req.session.displayName = user.display_name || user.username;
    req.session.avatarUrl   = user.avatar_url || null;
}

// POST /api/register
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });
    if (username.length < 3 || username.length > 32)
        return res.status(400).json({ error: 'Username must be 3–32 characters' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing)
        return res.status(409).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 12);
    db.prepare(
        'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)'
    ).run(username, hash, username);

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    startSession(req, user);
    res.json(profile(user));
});

// POST /api/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user)
        return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.password_hash)
        return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
        return res.status(401).json({ error: 'Invalid credentials' });

    startSession(req, user);
    res.json(profile(user));
});

// POST /api/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// GET /api/me  — current user's full profile (or 401)
router.get('/me', (req, res) => {
    if (!req.session.userId)
        return res.status(401).json({ error: 'Not authenticated' });
    const user = getUser(req.session.userId);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(profile(user));
});

module.exports = router;
