'use strict';

// ── State ──────────────────────────────────────────────────────────
let currentUser      = null;   // { userId, username }
let selectedRace     = null;
let roster           = [];
let editingTeamId    = null;   // null = new team, number = editing existing
let selectedHomeCol  = null;   // [r,g,b]
let selectedAwayCol  = null;   // [r,g,b]

// ── Helpers ────────────────────────────────────────────────────────
function raceLogoUrl(race) {
    const def = ROSTER_DEFS[race];
    if (!def || !def.logo) return null;
    const base = window.STATIC_BASE || '';
    return base ? `${base}/${def.logo}` : def.logo;
}

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
        currentUser = { userId: data.userId, username: data.username };
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
        currentUser = { userId: data.userId, username: data.username };
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
        const teamLabel  = room.team_name ? `${room.team_name} · ${room.race}` : 'No team selected yet';
        const homeLogoUrl = room.race ? raceLogoUrl(room.race) : null;
        const homeLogoHtml = homeLogoUrl
            ? `<img class="race-logo" src="${homeLogoUrl}" alt="${room.race}">`
            : `<div class="lobby-room-logo-slot"></div>`;
        card.innerHTML = `
            <div class="lobby-room-logos">
                ${homeLogoHtml}
                <div class="lobby-room-logo-slot"></div>
            </div>
            <div class="lobby-room-footer">
                <div class="lobby-room-info">
                    <span class="lobby-room-team">${room.home_username}</span>
                    <span class="lobby-room-meta">${teamLabel}</span>
                </div>
                <button class="btn-primary">Join →</button>
            </div>`;
        card.querySelector('button').addEventListener('click', () => joinRoom(room.id));
        list.appendChild(card);
    });
}

document.getElementById('btn-create-room').addEventListener('click', () => createRoom());

document.getElementById('btn-manage-teams').addEventListener('click', () => {
    hideLobby();
    showTeams();
});

async function createRoom() {
    const data = await api('POST', '/api/lobby', {});
    if (data.error) return alert(data.error);
    hideLobby();
    showRoom(data.roomId);
}

async function joinRoom(roomId) {
    const data = await api('POST', `/api/lobby/${roomId}/join`, {});
    if (data.error) return alert(data.error);
    hideLobby();
    showRoom(data.roomId);
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
        const logoUrl = raceLogoUrl(team.race);
        card.innerHTML = `
            ${logoUrl ? `<img class="race-logo" src="${logoUrl}" alt="${team.race}">` : ''}
            <div class="team-picker-info">
                <span class="team-picker-name">${team.name}</span>
                <span class="team-picker-meta">${team.race} · ${team.roster.length} players</span>
            </div>`;
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
        const def    = ROSTER_DEFS[team.race];
        const logoUrl = raceLogoUrl(team.race);
        const card   = document.createElement('div');
        card.className = 'team-card';
        card.innerHTML = `
            ${logoUrl ? `<img class="race-logo" src="${logoUrl}" alt="${team.race}">` : ''}
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
            const cardSprite = slot.sprite || (posDef && posDef.sprite) || (posDef && posDef.sprites && posDef.sprites[0]);
            if (cardSprite && typeof drawSpritePreview === 'function') {
                const canvas = document.createElement('canvas');
                canvas.className = 'sprite-preview';
                canvas.width  = 32;
                canvas.height = 32;
                drawSpritePreview(canvas, cardSprite, def.colour);
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
        const raceDef = ROSTER_DEFS[selectedRace];
        roster = existingTeam.roster.map(slot => {
            if (Array.isArray(slot.skills)) return slot;
            const posDef = raceDef && raceDef.positions.find(p => p.pos === slot.pos);
            return { ...slot, skills: posDef ? [...posDef.skills] : [] };
        });
        selectedHomeCol = existingTeam.homeColour || null;
        selectedAwayCol = existingTeam.awayColour || null;
        document.getElementById('team-name').value        = existingTeam.name;
        document.getElementById('step-race').hidden       = true;
        document.getElementById('step-roster').hidden     = false;
        renderRoster();
        renderPositions();
        renderColourPickers();
        updateBudget();
    } else {
        selectedRace    = null;
        roster          = [];
        selectedHomeCol = null;
        selectedAwayCol = null;
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
    selectedRace    = race;
    roster          = [];
    selectedHomeCol = null;
    selectedAwayCol = null;
    document.getElementById('team-name').value    = '';
    document.getElementById('step-race').hidden   = true;
    document.getElementById('step-roster').hidden = false;
    renderRoster();
    renderPositions();
    renderColourPickers();
    updateBudget();
}

// ── Skill picker ───────────────────────────────────────────────────
// Shows an inline dropdown of available skills for a specific roster slot.
function toggleSkillPicker(index, anchorEl) {
    const existing = document.getElementById('skill-picker-popup');
    if (existing) { existing.remove(); return; }

    const slot   = roster[index];
    const popup  = document.createElement('div');
    popup.id     = 'skill-picker-popup';
    popup.className = 'skill-popup';

    SKILLS.forEach(skill => {
        const has  = slot.skills.includes(skill);
        const btn  = document.createElement('button');
        btn.type   = 'button';
        btn.className = 'skill-option' + (has ? ' skill-option--on' : '');
        btn.textContent = skill;
        btn.addEventListener('click', () => {
            if (has) {
                slot.skills = slot.skills.filter(s => s !== skill);
            } else {
                slot.skills = [...slot.skills, skill];
            }
            popup.remove();
            renderRoster();
            renderPositions();
        });
        popup.appendChild(btn);
    });

    document.body.appendChild(popup);
    const rect = anchorEl.getBoundingClientRect();
    popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    popup.style.left = (rect.left  + window.scrollX)     + 'px';

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function close(e) {
            if (!popup.contains(e.target) && e.target !== anchorEl) {
                popup.remove();
                document.removeEventListener('click', close);
            }
        });
    }, 0);
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
            <div class="roster-item-body">
                <div class="roster-item-top">
                    <input type="text" value="${slot.name}" placeholder="Player name" maxlength="32">
                    <span class="pos-label">${slot.pos}</span>
                    <button class="btn-remove" title="Remove">×</button>
                </div>
                <div class="roster-item-skills">
                    ${slot.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}
                    <button type="button" class="btn-add-skill">+ skill</button>
                </div>
            </div>`;
        const slotSprite = slot.sprite || (posDef && posDef.sprite);
        if (slotSprite && typeof drawSpritePreview === 'function') {
            drawSpritePreview(li.querySelector('canvas'), slotSprite, def.colour);
        }
        li.querySelector('input').addEventListener('input', e => { roster[i].name = e.target.value; });
        li.querySelector('.btn-remove').addEventListener('click', () => {
            roster.splice(i, 1);
            renderRoster();
            renderPositions();
            updateBudget();
        });
        li.querySelector('.btn-add-skill').addEventListener('click', e => {
            e.stopPropagation();
            toggleSkillPicker(i, e.currentTarget);
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
        const previewSprite = pos.sprite || (pos.sprites && pos.sprites[0]);
        if (previewSprite && typeof drawSpritePreview === 'function') {
            drawSpritePreview(card.querySelector('canvas'), previewSprite, def.colour);
        }
        if (!disabled) {
            card.addEventListener('click', () => {
                const sprite = pos.sprites
                    ? pos.sprites[Math.floor(Math.random() * pos.sprites.length)]
                    : undefined;
                const slot = { pos: pos.pos, name: randomPlayerName(selectedRace, pos.pos), skills: [...pos.skills] };
                if (sprite) slot.sprite = sprite;
                roster.push(slot);
                renderRoster();
                renderPositions();
                updateBudget();
                const items = document.querySelectorAll('#roster-list .roster-item');
                if (items.length) items[items.length - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
        container.appendChild(card);
    });
}

// ── Colour pickers ─────────────────────────────────────────────────
function renderColourPickers() {
    renderColourPicker('home-colour-swatches', selectedHomeCol, selectedAwayCol, rgb => {
        selectedHomeCol = rgb;
        // If away was using this colour, clear it
        if (arrEq(selectedAwayCol, rgb)) selectedAwayCol = null;
        renderColourPickers();
    });
    renderColourPicker('away-colour-swatches', selectedAwayCol, selectedHomeCol, rgb => {
        selectedAwayCol = rgb;
        // Home always wins — shouldn't happen since we disable it, but guard anyway
        if (arrEq(selectedHomeCol, rgb)) return;
        renderColourPickers();
    });
}

function renderColourPicker(containerId, current, taken, onSelect) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    COLOURS.forEach(({ name, rgb }) => {
        const isTaken  = arrEq(rgb, taken);
        const isActive = arrEq(rgb, current);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'colour-swatch'
            + (isActive ? ' colour-swatch--active' : '')
            + (isTaken  ? ' colour-swatch--taken'  : '');
        btn.title    = isTaken ? `${name} (taken)` : name;
        btn.disabled = isTaken;
        btn.style.background = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        if (!isTaken) btn.addEventListener('click', () => onSelect(rgb));
        container.appendChild(btn);
    });
}

function arrEq(a, b) {
    return a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
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
    if (!selectedHomeCol) return (err.textContent = 'Pick a home colour');
    if (!selectedAwayCol) return (err.textContent = 'Pick an away colour');

    const def = ROSTER_DEFS[selectedRace];
    if (roster.length < def.min) return (err.textContent = `Need at least ${def.min} players`);
    if (roster.some(s => !s.name.trim())) return (err.textContent = 'All players need a name');

    const method = editingTeamId ? 'PUT' : 'POST';
    const path   = editingTeamId ? `/api/teams/${editingTeamId}` : '/api/teams';
    const data   = await api(method, path, {
        name, race: selectedRace, roster,
        homeColour: selectedHomeCol,
        awayColour: selectedAwayCol,
    });
    if (data.error) {
        err.textContent = data.error;
    } else {
        showTeams();
    }
});

// ── Staging room ───────────────────────────────────────────────────
let _roomEventSource = null;
let _currentRoomId   = null;
let _isHomeInRoom    = false;
let _myTeamSet       = false;

function showRoom(roomId) {
    _currentRoomId = roomId;
    _isHomeInRoom  = false;
    _myTeamSet     = false;
    document.getElementById('room-id-title').textContent = `Room ${roomId}`;
    document.getElementById('room-messages').innerHTML   = '';
    document.getElementById('room-chat-text').value      = '';
    document.getElementById('room-chat-text').disabled   = true;
    document.getElementById('btn-room-send').disabled    = true;
    document.getElementById('btn-room-ready').disabled   = true;
    document.getElementById('btn-room-ready').classList.remove('btn-ready-on');
    document.getElementById('room-ready-hint').textContent = '';
    showView('view-room');
    connectRoomSSE(roomId);
}

function connectRoomSSE(roomId) {
    if (_roomEventSource) { _roomEventSource.close(); _roomEventSource = null; }
    const es = new EventSource(`/api/room/${roomId}/events`);
    _roomEventSource = es;

    es.addEventListener('init', e => {
        const d = JSON.parse(e.data);
        renderRoomInit(d);
    });

    es.addEventListener('joined', e => {
        const d = JSON.parse(e.data);
        document.getElementById('room-away-username').textContent = d.awayUsername;
        document.getElementById('room-away-team').textContent     =
            d.awayTeamName ? `${d.awayTeamName} · ${d.awayRace}` : '';
        document.getElementById('room-away-status').textContent   = 'Not ready';
        document.getElementById('room-chat-text').disabled = false;
        document.getElementById('btn-room-send').disabled  = false;
        refreshReadyButton();
        appendSystemMessage(`${d.awayUsername} joined the room.`);
    });

    es.addEventListener('message', e => {
        const d = JSON.parse(e.data);
        appendChatMessage(d.username, d.message);
    });

    es.addEventListener('left', e => {
        const d = JSON.parse(e.data);
        document.getElementById('room-away-username').textContent = '—';
        document.getElementById('room-away-team').textContent     = 'Waiting for opponent…';
        document.getElementById('room-away-logo').hidden          = true;
        document.getElementById('btn-pick-team-away').hidden      = true;
        document.getElementById('room-away-status').textContent   = '';
        document.getElementById('room-chat-text').disabled        = true;
        document.getElementById('btn-room-send').disabled         = true;
        updateReadyState(false, false);
        refreshReadyButton();
        appendSystemMessage(`${d.username} left the room.`);
    });

    es.addEventListener('team', e => {
        const d = JSON.parse(e.data);
        const isMySide = (d.side === 'home') === _isHomeInRoom;
        if (d.side === 'home') {
            document.getElementById('room-home-team').textContent = `${d.teamName} · ${d.race}`;
            document.getElementById('btn-pick-team-home').textContent = 'Change Team';
            setRoomLogo('home', d.race);
        } else {
            document.getElementById('room-away-team').textContent = `${d.teamName} · ${d.race}`;
            document.getElementById('btn-pick-team-away').textContent = 'Change Team';
            setRoomLogo('away', d.race);
        }
        if (isMySide) {
            _myTeamSet = true;
            refreshReadyButton();
        }
    });

    es.addEventListener('ready', e => {
        const d = JSON.parse(e.data);
        updateReadyState(d.homeReady, d.awayReady);
    });

    es.addEventListener('launch', e => {
        const { url } = JSON.parse(e.data);
        enterPlayingState(url);
    });

    es.addEventListener('quit', e => {
        const d = JSON.parse(e.data);
        if (d.username === currentUser.username) return;
        es.close();
        _roomEventSource = null;
        _currentRoomId   = null;
        tearDownGame();
        alert(`${d.username} has quit the game.`);
        showLobby();
    });

    es.addEventListener('closed', () => {
        es.close();
        _roomEventSource = null;
        _currentRoomId   = null;
        showLobby();
    });
}

function renderRoomInit(state) {
    _isHomeInRoom = state.homeUsername === currentUser.username;

    document.getElementById('room-home-username').textContent = state.homeUsername;
    document.getElementById('room-home-team').textContent =
        state.homeTeamName ? `${state.homeTeamName} · ${state.homeRace}` : '';
    if (state.homeTeamName) setRoomLogo('home', state.homeRace);

    const hasAway = !!state.awayUsername;
    document.getElementById('room-away-username').textContent =
        hasAway ? state.awayUsername : '—';
    document.getElementById('room-away-team').textContent =
        hasAway ? (state.awayTeamName ? `${state.awayTeamName} · ${state.awayRace}` : '') : 'Waiting for opponent…';
    if (hasAway && state.awayTeamName) setRoomLogo('away', state.awayRace);
    document.getElementById('room-away-status').textContent =
        hasAway ? (state.awayReady ? 'Ready!' : 'Not ready') : '';

    // Show "Pick Team" button for the current user's slot
    const myTeamAlreadySet = _isHomeInRoom ? !!state.homeTeamName : !!state.awayTeamName;
    _myTeamSet = myTeamAlreadySet;
    const myBtnId  = _isHomeInRoom ? 'btn-pick-team-home' : 'btn-pick-team-away';
    const myBtn    = document.getElementById(myBtnId);
    myBtn.hidden   = false;
    myBtn.textContent = myTeamAlreadySet ? 'Change Team' : 'Pick Team';

    document.getElementById('room-chat-text').disabled = !hasAway;
    document.getElementById('btn-room-send').disabled  = !hasAway;
    refreshReadyButton();

    state.messages.forEach(m => appendChatMessage(m.username, m.message));
    updateReadyState(state.homeReady, state.awayReady);
}

function setRoomLogo(side, race) {
    const img = document.getElementById(`room-${side}-logo`);
    const url = raceLogoUrl(race);
    if (url) { img.src = url; img.alt = race; img.hidden = false; }
    else      { img.hidden = true; }
}

function refreshReadyButton() {
    // Ready requires: opponent has joined AND current user has picked a team
    const hasOpponent = !!document.getElementById('room-away-username').textContent &&
                        document.getElementById('room-away-username').textContent !== '—';
    document.getElementById('btn-room-ready').disabled = !hasOpponent || !_myTeamSet;
}

async function pickTeamForRoom() {
    if (!_currentRoomId) return;
    const data = await api('GET', '/api/teams');
    if (!data.teams || data.teams.length === 0) {
        alert('You need at least one team. Go to My Teams to create one.');
        return;
    }
    if (data.teams.length === 1) {
        await setRoomTeam(data.teams[0].id);
        return;
    }
    showTeamPicker(data.teams, async team => {
        await setRoomTeam(team.id);
    });
}

async function setRoomTeam(teamId) {
    const data = await api('POST', `/api/room/${_currentRoomId}/team`, { teamId });
    if (data.error) alert(data.error);
}

document.getElementById('btn-pick-team-home').addEventListener('click', pickTeamForRoom);
document.getElementById('btn-pick-team-away').addEventListener('click', pickTeamForRoom);

function updateReadyState(homeReady, awayReady) {
    const homeStatus = document.getElementById('room-home-status');
    const awayStatus = document.getElementById('room-away-status');
    homeStatus.textContent = homeReady ? 'Ready!' : 'Not ready';
    homeStatus.className   = 'room-player-status' + (homeReady ? ' room-status-ready' : '');
    awayStatus.textContent = awayReady ? 'Ready!' : 'Not ready';
    awayStatus.className   = 'room-player-status' + (awayReady ? ' room-status-ready' : '');

    const myReady    = _isHomeInRoom ? homeReady : awayReady;
    const theirReady = _isHomeInRoom ? awayReady : homeReady;

    const hint = document.getElementById('room-ready-hint');
    const btn  = document.getElementById('btn-room-ready');
    if (homeReady && awayReady) {
        hint.textContent = 'Launching…';
        btn.classList.add('btn-ready-on');
    } else if (myReady) {
        hint.textContent = 'Waiting for opponent to ready up…';
        btn.classList.add('btn-ready-on');
    } else {
        hint.textContent = theirReady ? 'Opponent is ready!' : '';
        btn.classList.remove('btn-ready-on');
    }
}

function appendChatMessage(username, text) {
    const msgs = document.getElementById('room-messages');
    const div  = document.createElement('div');
    div.className = 'room-message';
    const isSelf = username === currentUser.username;
    div.innerHTML = `<span class="room-msg-author${isSelf ? ' room-msg-self' : ''}">${escHtml(username)}</span>`
        + `<span class="room-msg-text">${escHtml(text)}</span>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;

    // Shimmer the toggle button when chat is collapsed and message is from opponent.
    if (!isSelf) {
        const chat = document.getElementById('room-chat');
        const btn  = document.getElementById('btn-chat-toggle');
        if (btn && chat && chat.classList.contains('room-chat-collapsed')) {
            btn.classList.add('has-unread');
        }
    }
}

function appendSystemMessage(text) {
    const msgs = document.getElementById('room-messages');
    const div  = document.createElement('div');
    div.className = 'room-message room-message-system';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Send chat message
document.getElementById('btn-room-send').addEventListener('click', sendRoomMessage);
document.getElementById('room-chat-text').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendRoomMessage();
});

async function sendRoomMessage() {
    const input = document.getElementById('room-chat-text');
    const text  = input.value.trim();
    if (!text || !_currentRoomId) return;
    input.value = '';
    await api('POST', `/api/room/${_currentRoomId}/message`, { message: text });
}

// Toggle ready
document.getElementById('btn-room-ready').addEventListener('click', async () => {
    if (!_currentRoomId) return;
    await api('POST', `/api/room/${_currentRoomId}/ready`);
});

// ── Playing-state transition ───────────────────────────────────────
function enterPlayingState(url) {
    document.getElementById('room-players').hidden = true;
    document.getElementById('room-actions').hidden = true;
    const iframe = document.getElementById('room-game-frame');
    iframe.src    = url;
    iframe.hidden = false;
    document.getElementById('room-sidebar-bar').hidden = false;
    document.body.classList.add('game-active');

    // On touch devices the chat starts collapsed and the toggle button is shown;
    // on desktop the chat is always open and the toggle is hidden.
    const isTouch = navigator.maxTouchPoints > 0;
    const chatToggle = document.getElementById('btn-chat-toggle');
    chatToggle.style.display = isTouch ? 'block' : 'none';
    if (isTouch) {
        document.getElementById('room-chat').classList.add('room-chat-collapsed');
        chatToggle.textContent = 'Chat ▲';
    }
}

function tearDownGame() {
    const iframe = document.getElementById('room-game-frame');
    iframe.src    = 'about:blank';
    iframe.hidden = true;
    document.getElementById('room-sidebar-bar').hidden = true;
    document.getElementById('room-chat').classList.remove('room-chat-collapsed');
    document.body.classList.remove('game-active');
}

document.getElementById('btn-exit-game').addEventListener('click', async () => {
    if (!confirm('Quit the game? Your opponent will be notified.')) return;
    if (_currentRoomId) await api('POST', `/api/room/${_currentRoomId}/quit`);
    if (_roomEventSource) { _roomEventSource.close(); _roomEventSource = null; }
    _currentRoomId = null;
    tearDownGame();
    showLobby();
});

// Chat toggle (mobile only — CSS hides it on desktop)
document.getElementById('btn-chat-toggle').addEventListener('click', () => {
    const chat = document.getElementById('room-chat');
    const btn  = document.getElementById('btn-chat-toggle');
    const collapsed = chat.classList.toggle('room-chat-collapsed');
    btn.textContent = collapsed ? 'Chat ▲' : 'Chat ▼';
    btn.classList.remove('has-unread');
    if (!collapsed) {
        document.getElementById('room-messages').scrollTop = document.getElementById('room-messages').scrollHeight;
    }
});

// Leave room
document.getElementById('btn-room-leave').addEventListener('click', async () => {
    if (_roomEventSource) { _roomEventSource.close(); _roomEventSource = null; }
    if (_currentRoomId) {
        await api('DELETE', `/api/lobby/${_currentRoomId}`);
        _currentRoomId = null;
    }
    document.body.classList.remove('game-active');
    showLobby();
});


// ── Go ─────────────────────────────────────────────────────────────
boot();
