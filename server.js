require('dotenv').config();

const express = require('express');
const session = require('express-session');
const fs      = require('fs');
const path    = require('path');

const app        = express();
const PORT       = process.env.PORT || 3001;
const STATIC_URL = process.env.STATIC_URL || '';

// ── Middleware ────────────────────────────────────────────────────
// These run on every request, in order, before any route handler.

// Parse incoming JSON bodies so req.body is available in routes.
app.use(express.json());

// Session cookie management.
// express-session generates a session ID, stores it in a signed cookie,
// and provides req.session for reading/writing session data.
app.use(session({
    secret:            process.env.SESSION_SECRET,
    resave:            false,  // don't save session if nothing changed
    saveUninitialized: false,  // don't create session until something is stored
    cookie: {
        httpOnly: true,   // JS on the page can't read this cookie
        maxAge:   30 * 24 * 60 * 60 * 1000,  // 30 days in ms
    },
}));

// Inject shared stylesheet into index.html when STATIC_URL is configured.
app.get(['/', '/index.html'], (req, res) => {
    fs.readFile(path.join(__dirname, 'public', 'index.html'), 'utf8', (err, html) => {
        if (err) { res.status(404).send('Not found'); return; }
        if (STATIC_URL) {
            const injection = [
                `<link rel="stylesheet" href="${STATIC_URL}/style.css">`,
                `  <script>window.STATIC_BASE = ${JSON.stringify(STATIC_URL)};</script>`,
            ].join('\n  ');
            html = html.replace('<!-- STATIC_INJECT -->', injection);
        }
        res.type('html').send(html);
    });
});

// Serve everything in /public as static files (roster-defs.js, future UI assets).
app.use(express.static('public'));

// ── Routes ────────────────────────────────────────────────────────
// Each router is a mini Express app mounted at a path prefix.
// We'll add these one by one as we build them.

app.use('/api', require('./src/routes/auth'));
app.use('/api', require('./src/routes/team'));
app.use('/api', require('./src/routes/play'));

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`bbauth running on http://localhost:${PORT}`);
});
