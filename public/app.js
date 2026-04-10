'use strict';

// ── State ──────────────────────────────────────────────────────────
let currentUser  = null;   // { userId, username }
let selectedRace = null;
let roster       = [];
let editingTeamId = null;  // null = new team, number = editing existing

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
        showLobby();
    } else {
        showView('view-auth');
    }
}

// ── Auth view ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('form-login').hidden    = tab.dataset.tab !== 'login';
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
        showLobby();
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
        showLobby();
    }
});

// ── Logout ─────────────────────────────────────────────────────────
async function logout() {
    await api('POST', '/api/logout');
    currentUser  = null;
    selectedRace = null;
    roster       = [];
    hideLobby();
    showView('view-auth');
}

['btn-logout-lobby', 'btn-logout-teams'].forEach(id =>
    document.getElementById(id).addEventListener('click', logout)
);

// ── Lobby view ─────────────────────────────────────────────────────
let _lobbyPollTimer = null;

function showLobby() {
    document.getElementById('lobby-greeting').textContent = currentUser.username;
    showView('view-lobby');
    pollLobby();
    _lobbyPollTimer = setInterval(pollLobby, 3000);
}

function hideLobby() {
    clearInterval(_lobbyPollTimer);
    _lobbyPollTimer = null;
}

async function pollLobby() {
    const data = await api('GET', '/api/lobby');
    if (!data.rooms) return;
    renderLobbyRooms(data.rooms);
}

function renderLobbyRooms(rooms) {
    const list = document.getElementById('lobby-room-list');
    list.innerHTML = '';

    if (rooms.length === 0) {
        list.innerHTML = '<p class="lobby-empty">No open games yet.</p>';
        return;
    }
    rooms.forEach(room => {
        const card = document.createElement('div');
        card.className = 'lobby-room-card';
        card.innerHTML = `
            <div class="lobby-room-info">
                <span class="lobby-room-team">${room.team_name}</span>
                <span class="lobby-room-meta">${room.home_username} · ${room.race}</span>
            </div>
            <button class="btn-primary">Join →</button>`;
        card.querySelector('button').addEventListener('click', () => pickTeamThen(team =>
            joinRoom(room.id, team.id)
        ));
        list.appendChild(card);
    });
}

document.getElementById('btn-create-room').addEventListener('click', () =>
    pickTeamThen(team => createRoom(team.id))
);

document.getElementById('btn-manage-teams').addEventListener('click', () => {
    hideLobby();
    showTeams();
});

async function createRoom(teamId) {
    const data = await api('POST', '/api/lobby', { teamId });
    if (data.error) return alert(data.error);
    window.location.href = data.url;
}

async function joinRoom(roomId, teamId) {
    const data = await api('POST', `/api/lobby/${roomId}/join`, { teamId });
    if (data.error) return alert(data.error);
    hideLobby();
    window.location.href = data.url;
}

// ── Team picker modal ──────────────────────────────────────────────
// Fetches the user's teams and shows a modal. Calls onSelect(team) when chosen.

async function pickTeamThen(onSelect) {
    const data = await api('GET', '/api/teams');
    if (!data.teams || data.teams.length === 0) {
        alert('You need at least one team. Go to My Teams to create one.');
        return;
    }
    if (data.teams.length === 1) {
        // Only one team — skip the picker
        onSelect(data.teams[0]);
        return;
    }
    showTeamPicker(data.teams, onSelect);
}

function showTeamPicker(teams, onSelect) {
    const list = document.getElementById('team-picker-list');
    list.innerHTML = '';
    teams.forEach(team => {
        const card = document.createElement('div');
        card.className = 'team-picker-card';
        card.innerHTML = `
            <span class="team-picker-name">${team.name}</span>
            <span class="team-picker-meta">${team.race} · ${team.roster.length} players</span>`;
        card.addEventListener('click', () => {
            hideTeamPicker();
            onSelect(team);
        });
        list.appendChild(card);
    });
    document.getElementById('team-picker-overlay').hidden = false;
}

function hideTeamPicker() {
    document.getElementById('team-picker-overlay').hidden = true;
}

document.getElementById('btn-picker-cancel').addEventListener('click', hideTeamPicker);

// ── Teams list view ────────────────────────────────────────────────
async function showTeams() {
    showView('view-teams');
    const data = await api('GET', '/api/teams');
    renderTeamsList(data.teams || []);
}

function renderTeamsList(teams) {
    const list = document.getElementById('teams-list');
    list.innerHTML = '';

    if (teams.length === 0) {
        list.innerHTML = '<p class="lobby-empty">No teams yet. Create one below.</p>';
        return;
    }
    teams.forEach(team => {
        const def   = ROSTER_DEFS[team.race];
        const card  = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            <div class="team-card-info">
                <span class="team-card-name">${team.name}</span>
                <span class="team-card-meta">${team.race} · ${team.roster.length} players</span>
            </div>
            <div class="team-card-sprites" id="team-card-sprites-${team.id}"></div>
            <div class="team-card-actions">
                <button class="btn-ghost btn-edit-team">Edit</button>
                <button class="btn-ghost btn-delete-team">Delete</button>
            </div>`;

        // Draw a sprite for each unique position
        const spritesEl = card.querySelector(`#team-card-sprites-${team.id}`);
        const seenPos = new Set();
        team.roster.forEach(slot => {
            if (seenPos.has(slot.pos)) return;
            seenPos.add(slot.pos);
            const posDef = def && def.positions.find(p => p.pos === slot.pos);
            if (posDef && posDef.sprite && typeof drawSpritePreview === 'function') {
                const canvas = document.createElement('canvas');
                canvas.className = 'sprite-preview';
                canvas.width  = 32;
                canvas.height = 32;
                drawSpritePreview(canvas, posDef.sprite, def.colour);
                spritesEl.appendChild(canvas);
            }
        });

        card.querySelector('.btn-edit-team').addEventListener('click', () => showBuilder(team));
        card.querySelector('.btn-delete-team').addEventListener('click', async () => {
            if (!confirm(`Delete "${team.name}"?`)) return;
            await api('DELETE', `/api/teams/${team.id}`);
            showTeams();
        });
        list.appendChild(card);
    });
}

document.getElementById('btn-new-team').addEventListener('click', () => showBuilder(null));
document.getElementById('btn-teams-back').addEventListener('click', () => showLobby());

// ── Builder view ───────────────────────────────────────────────────
function showBuilder(existingTeam) {
    editingTeamId = existingTeam ? existingTeam.id : null;
    document.getElementById('builder-greeting').textContent = currentUser.username;
    document.getElementById('builder-subtitle').textContent =
        existingTeam ? 'Edit team' : 'New team';
    showView('view-builder');

    if (existingTeam) {
        selectedRace = existingTeam.race;
        roster       = existingTeam.roster.slice();
        document.getElementById('team-name').value        = existingTeam.name;
        document.getElementById('step-race').hidden       = true;
        document.getElementById('step-roster').hidden     = false;
        renderRoster();
        renderPositions();
        updateBudget();
    } else {
        selectedRace = null;
        roster       = [];
        document.getElementById('step-race').hidden       = false;
        document.getElementById('step-roster').hidden     = true;
        renderRaceCards();
    }
}

document.getElementById('btn-builder-back').addEventListener('click', () => showTeams());

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
    roster       = [];
    document.getElementById('team-name').value    = '';
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
        const posDef = def.positions.find(p => p.pos === slot.pos);
        const li = document.createElement('li');
        li.className = 'roster-item';
        li.innerHTML = `
            <canvas class="sprite-preview" width="32" height="32"></canvas>
            <input type="text" value="${slot.name}" placeholder="Player name" maxlength="32">
            <span class="pos-label">${slot.pos}</span>
            <button title="Remove">×</button>`;
        if (posDef && posDef.sprite && typeof drawSpritePreview === 'function') {
            drawSpritePreview(li.querySelector('canvas'), posDef.sprite, def.colour);
        }
        li.querySelector('input').addEventListener('input', e => { roster[i].name = e.target.value; });
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
        const used      = roster.filter(s => s.pos === pos.pos).length;
        const spent     = rosterCost(selectedRace, roster);
        const disabled  = used >= pos.limit || roster.length >= def.max || spent + pos.cost > def.budget;

        const card = document.createElement('div');
        card.className = 'pos-card' + (disabled ? ' pos-card--disabled' : '');
        card.innerHTML = `
            <canvas class="sprite-preview" width="32" height="32"></canvas>
            <span class="pos-name">${pos.pos}</span>
            <span class="pos-cost">${pos.cost.toLocaleString()} gp · ${used}/${pos.limit}</span>`;
        if (pos.sprite && typeof drawSpritePreview === 'function') {
            drawSpritePreview(card.querySelector('canvas'), pos.sprite, def.colour);
        }
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
    const def    = ROSTER_DEFS[selectedRace];
    const spent  = rosterCost(selectedRace, roster);
    const remain = def.budget - spent;
    const pct    = (spent / def.budget) * 100;
    document.getElementById('budget-label').textContent     = `${spent.toLocaleString()} gp spent`;
    document.getElementById('budget-remaining').textContent = `${remain.toLocaleString()} remaining`;
    document.getElementById('budget-fill').style.width      = `${pct}%`;
}

// ── Save team ──────────────────────────────────────────────────────
document.getElementById('btn-save-team').addEventListener('click', async () => {
    const name = document.getElementById('team-name').value.trim();
    const err  = document.getElementById('builder-error');
    err.textContent = '';

    if (!name) return (err.textContent = 'Give your team a name');

    const def = ROSTER_DEFS[selectedRace];
    if (roster.length < def.min) return (err.textContent = `Need at least ${def.min} players`);
    if (roster.some(s => !s.name.trim())) return (err.textContent = 'All players need a name');

    const method = editingTeamId ? 'PUT' : 'POST';
    const path   = editingTeamId ? `/api/teams/${editingTeamId}` : '/api/teams';
    const data   = await api(method, path, { name, race: selectedRace, roster });
    if (data.error) {
        err.textContent = data.error;
    } else {
        showTeams();
    }
});

// ── Banner ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    if (typeof drawBanner === 'function') {
        const canvas = document.getElementById('main-banner');
        document.fonts.ready.then(() => drawBanner(canvas, { title: 'Blood Bowl' }));
        window.addEventListener('resize', () => drawBanner(canvas, { title: 'Blood Bowl' }));
    }
});

// ── Go ─────────────────────────────────────────────────────────────
boot();
