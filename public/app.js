'use strict';

// ── State ──────────────────────────────────────────────────────────
let currentUser = null;    // { userId, username }
let selectedRace = null;   // 'humans' | 'orcs'
let roster = [];           // [{ pos, name }]

// ── View switching ─────────────────────────────────────────────────
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.hidden = true);
    document.getElementById(id).hidden = false;
}

// ── API helpers ────────────────────────────────────────────────────
async function api(method, path, body) {
    const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body:    body ? JSON.stringify(body) : undefined,
    });
    return res.json();
}

// ── Bootstrap ──────────────────────────────────────────────────────
async function boot() {
    const data = await api('GET', '/api/me');
    if (data.userId) {
        currentUser = data;
        const teamData = await api('GET', '/api/team');
        if (teamData.team) {
            showTeam(teamData.team);
        } else {
            showBuilder();
        }
    } else {
        showView('view-auth');
    }
}

// ── Auth view ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('form-login').hidden   = tab.dataset.tab !== 'login';
        document.getElementById('form-register').hidden = tab.dataset.tab !== 'register';
    });
});

document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(e.target));
    const data = await api('POST', '/api/login', { username, password });
    if (data.error) {
        document.getElementById('login-error').textContent = data.error;
    } else {
        currentUser = { username: data.username };
        const teamData = await api('GET', '/api/team');
        if (teamData.team) {
            showTeam(teamData.team);
        } else {
            showBuilder();
        }
    }
});

document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const { username, password } = Object.fromEntries(new FormData(e.target));
    const data = await api('POST', '/api/register', { username, password });
    if (data.error) {
        document.getElementById('register-error').textContent = data.error;
    } else {
        currentUser = { username: data.username };
        showBuilder();
    }
});

// ── Logout ─────────────────────────────────────────────────────────
async function logout() {
    await api('POST', '/api/logout');
    currentUser = null;
    selectedRace = null;
    roster = [];
    showView('view-auth');
}

document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-logout-2').addEventListener('click', logout);

// ── Builder view ───────────────────────────────────────────────────
function showBuilder(existingTeam) {
    document.getElementById('builder-greeting').textContent = currentUser.username;
    document.getElementById('builder-subtitle').textContent =
        existingTeam ? 'Edit your team' : 'Build your team';
    showView('view-builder');

    if (existingTeam) {
        selectedRace = existingTeam.race;
        roster = existingTeam.roster.slice();
        document.getElementById('team-name').value = existingTeam.name;
        document.getElementById('step-race').hidden   = true;
        document.getElementById('step-roster').hidden = false;
        renderRoster();
        renderPositions();
        updateBudget();
    } else {
        selectedRace = null;
        roster = [];
        document.getElementById('step-race').hidden   = false;
        document.getElementById('step-roster').hidden = true;
        renderRaceCards();
    }
}

function renderRaceCards() {
    const container = document.getElementById('race-cards');
    container.innerHTML = '';
    for (const [race, def] of Object.entries(ROSTER_DEFS)) {
        const card = document.createElement('div');
        card.className = 'race-card';
        card.innerHTML = `
            <h2>${race}</h2>
            <div class="race-meta">
                Budget: ${def.budget.toLocaleString()} gp<br>
                ${def.min}–${def.max} players<br>
                ${def.positions.map(p => p.pos).join(', ')}
            </div>`;
        card.addEventListener('click', () => selectRace(race));
        container.appendChild(card);
    }
}

function selectRace(race) {
    selectedRace = race;
    roster = [];
    document.getElementById('team-name').value = '';
    document.getElementById('step-race').hidden   = true;
    document.getElementById('step-roster').hidden = false;
    renderRoster();
    renderPositions();
    updateBudget();
}

document.getElementById('btn-back-race').addEventListener('click', () => {
    document.getElementById('step-race').hidden   = false;
    document.getElementById('step-roster').hidden = true;
    renderRaceCards();
});

// ── Roster & positions ─────────────────────────────────────────────
function renderRoster() {
    const list = document.getElementById('roster-list');
    const def  = ROSTER_DEFS[selectedRace];
    list.innerHTML = '';

    roster.forEach((slot, i) => {
        const li = document.createElement('li');
        li.className = 'roster-item';
        li.innerHTML = `
            <input type="text" value="${slot.name}" placeholder="Player name" maxlength="32">
            <span class="pos-label">${slot.pos}</span>
            <button title="Remove">×</button>`;
        li.querySelector('input').addEventListener('input', e => {
            roster[i].name = e.target.value;
        });
        li.querySelector('button').addEventListener('click', () => {
            roster.splice(i, 1);
            renderRoster();
            renderPositions();
            updateBudget();
        });
        list.appendChild(li);
    });

    const count = document.getElementById('roster-count');
    const hint  = document.getElementById('roster-hint');
    count.textContent = `(${roster.length}/${def.max})`;
    hint.textContent  = roster.length < def.min
        ? `Need at least ${def.min - roster.length} more player${def.min - roster.length > 1 ? 's' : ''}`
        : '';
}

function renderPositions() {
    const container = document.getElementById('position-cards');
    const def       = ROSTER_DEFS[selectedRace];
    container.innerHTML = '';

    def.positions.forEach(pos => {
        const used     = roster.filter(s => s.pos === pos.pos).length;
        const budget   = def.budget;
        const spent    = rosterCost(selectedRace, roster);
        const canAfford = spent + pos.cost <= budget;
        const atLimit  = used >= pos.limit;
        const atMax    = roster.length >= def.max;
        const disabled = atLimit || atMax || !canAfford;

        const card = document.createElement('div');
        card.className = 'pos-card' + (disabled ? ' pos-card--disabled' : '');
        card.innerHTML = `
            <span class="pos-name">${pos.pos}</span>
            <span class="pos-cost">${pos.cost.toLocaleString()} gp · ${used}/${pos.limit}</span>`;

        if (!disabled) {
            card.addEventListener('click', () => {
                roster.push({ pos: pos.pos, name: '' });
                renderRoster();
                renderPositions();
                updateBudget();
            });
        }
        container.appendChild(card);
    });
}

function updateBudget() {
    const def     = ROSTER_DEFS[selectedRace];
    const spent   = rosterCost(selectedRace, roster);
    const remain  = def.budget - spent;
    const pct     = (spent / def.budget) * 100;

    document.getElementById('budget-label').textContent     = `${spent.toLocaleString()} gp spent`;
    document.getElementById('budget-remaining').textContent = `${remain.toLocaleString()} remaining`;
    document.getElementById('budget-fill').style.width      = `${pct}%`;
}

// ── Save team ──────────────────────────────────────────────────────
document.getElementById('btn-save-team').addEventListener('click', async () => {
    const name = document.getElementById('team-name').value.trim();
    const err  = document.getElementById('builder-error');
    err.textContent = '';

    if (!name)          return (err.textContent = 'Give your team a name');

    const def = ROSTER_DEFS[selectedRace];
    if (roster.length < def.min)
        return (err.textContent = `Need at least ${def.min} players`);
    if (roster.some(s => !s.name.trim()))
        return (err.textContent = 'All players need a name');

    const data = await api('POST', '/api/team', { name, race: selectedRace, roster });
    if (data.error) {
        err.textContent = data.error;
    } else {
        const teamData = await api('GET', '/api/team');
        showTeam(teamData.team);
    }
});

// ── Team display view ──────────────────────────────────────────────
function showTeam(team) {
    const def   = ROSTER_DEFS[team.race];
    const spent = rosterCost(team.race, team.roster);

    document.getElementById('team-display-name').textContent = team.name;
    document.getElementById('team-display-race').textContent =
        `${team.race} · ${team.roster.length} players`;

    const tbody = document.getElementById('roster-table-body');
    tbody.innerHTML = '';
    team.roster.forEach(slot => {
        const pos = def.positions.find(p => p.pos === slot.pos);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${slot.name}</td>
            <td>${slot.pos}</td>
            <td class="stat">${pos.ma}</td>
            <td class="stat">${pos.st}</td>
            <td class="stat">${pos.ag}</td>
            <td class="stat">${pos.pa}</td>
            <td class="stat">${pos.av}</td>
            <td class="skills">${pos.skills.join(', ') || '—'}</td>`;
        tbody.appendChild(tr);
    });

    document.getElementById('team-cost').textContent =
        `${spent.toLocaleString()} / ${def.budget.toLocaleString()} gp`;

    showView('view-team');
}

document.getElementById('btn-edit-team').addEventListener('click', async () => {
    const teamData = await api('GET', '/api/team');
    showBuilder(teamData.team);
});

document.getElementById('btn-play').addEventListener('click', async () => {
    const data = await api('GET', '/api/play-token');
    if (data.error) return alert(data.error);
    // Redirect to webbb with the token as a query parameter.
    const webbbUrl = (window.WEBBB_URL || 'http://localhost:3000') + '?token=' + data.token;
    window.location.href = webbbUrl;
});

// ── Go ─────────────────────────────────────────────────────────────
boot();
