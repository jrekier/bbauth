const express  = require('express');
const crypto   = require('node:crypto');
const db       = require('../db');
const { requireAuth }  = require('../auth-middleware');
const { expandTeam }   = require('../../public/roster-defs');

const router = express.Router();

// GET /api/play-token
// Issues a short-lived signed token containing the user's fully expanded team.
// webbb verifies the signature with the same SHARED_SECRET and needs no DB call.
router.get('/play-token', requireAuth, (req, res) => {
    const team = db.prepare('SELECT * FROM teams WHERE user_id = ?').get(req.session.userId);
    if (!team)
        return res.status(400).json({ error: 'You need a team before you can play' });

    const teamDef = expandTeam({ ...team, roster: JSON.parse(team.roster) });

    const payload = Buffer.from(JSON.stringify({
        userId:  req.session.userId,
        username: req.session.username,
        teamDef,
        exp: Math.floor(Date.now() / 1000) + 60,  // expires in 60 seconds
    })).toString('base64');

    const sig = crypto
        .createHmac('sha256', process.env.SHARED_SECRET)
        .update(payload)
        .digest('hex');

    res.json({ token: `${payload}.${sig}` });
});

module.exports = router;
