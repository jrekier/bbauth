const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');

const router = express.Router();

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
    const { lastInsertRowid } = db.prepare(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, hash);

    req.session.userId   = Number(lastInsertRowid);
    req.session.username = username;
    res.json({ ok: true, userId: Number(lastInsertRowid), username });
});

// POST /api/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Username and password are required' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user)
        return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
        return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId   = user.id;
    req.session.username = user.username;
    res.json({ ok: true, userId: user.id, username: user.username });
});

// POST /api/logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ ok: true });
    });
});

// GET /api/me  — lets the frontend check who is logged in
router.get('/me', (req, res) => {
    if (!req.session.userId)
        return res.status(401).json({ error: 'Not authenticated' });
    res.json({ userId: req.session.userId, username: req.session.username });
});

module.exports = router;
