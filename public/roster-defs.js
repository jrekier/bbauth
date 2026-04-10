// roster-defs.js
// Canonical race and position definitions for the team builder.
// Stats, costs, per-team limits, and sprite data.
// Served as a static file to the browser; also require()'d server-side.

const COLOURS = [
    { name: 'Crimson',  rgb: [200, 20,  20]  },
    { name: 'Royal',    rgb: [20,  50,  180] },
    { name: 'Forest',   rgb: [20,  110, 35]  },
    { name: 'Gold',     rgb: [200, 155, 10]  },
    { name: 'Purple',   rgb: [110, 15,  165] },
    { name: 'Orange',   rgb: [210, 85,  10]  },
    { name: 'Teal',     rgb: [15,  135, 130] },
    { name: 'Maroon',   rgb: [110, 15,  40]  },
    { name: 'Navy',     rgb: [15,  25,  100] },
    { name: 'Tan',      rgb: [175, 140, 80]  },
    { name: 'Slate',    rgb: [60,  80,  110] },
    { name: 'Rose',     rgb: [185, 55,  100] },
];

const SKILLS = [
    'Block', 'Dodge', 'Sure Hands', 'Pass', 'Catch',
    'Tackle', 'Strip Ball', 'Guard', 'Side Step', 'Leap',
    'Frenzy', 'Mighty Blow', 'Piling On', 'Juggernaut',
    'Accurate', 'Strong Arm', 'Nerves of Steel',
    'Wrestle', 'Shadowing', 'Stab',
    'Regeneration', 'Thick Skull', 'Stand Firm',
    'Sprint', 'Sure Feet', 'Stunty',
    'Two Heads', 'Extra Arms', 'Big Hand',
    'Loner', 'Wild Animal', 'Bone-head', 'Really Stupid', 'Take Root',
];

const ROSTER_DEFS = {
    humans: {
        colour: [200, 30, 30],
        budget: 1000000,
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
                cost: 50000, limit: 12,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  0, y: 162, w: 25, h: 27 },
                    armour: { x: 26, y: 162, w: 25, h: 27 } },
            },
            {
                pos: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: ['Block'],
                cost: 90000, limit: 4,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  0, y: 190, w: 25, h: 26 },
                    armour: { x: 26, y: 190, w: 25, h: 26 } },
            },
            {
                pos: 'Thrower', ma: 6, st: 3, ag: 3, pa: 2, av: 7, skills: ['Pass', 'Sure Hands'],
                cost: 80000, limit: 2,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  0, y: 108, w: 25, h: 26 },
                    armour: { x: 26, y: 108, w: 25, h: 26 } },
            },
            {
                pos: 'Catcher', ma: 8, st: 2, ag: 3, pa: 5, av: 7, skills: ['Dodge', 'Catch'],
                cost: 75000, limit: 4,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  0, y:  27, w: 25, h: 26 },
                    armour: { x: 26, y:  27, w: 25, h: 26 } },
            },
        ],
    },

    orcs: {
        colour: [30, 80, 180],
        budget: 1000000,
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Lineman', ma: 5, st: 3, ag: 3, pa: 4, av: 9, skills: [],
                cost: 50000, limit: 12,
                sprite: { sheet: 'assets/sprites/orc.gif',
                    base:   { x:  0, y:  0, w: 26, h: 26 },
                    armour: { x: 32, y:  0, w: 26, h: 26 } },
            },
            {
                pos: 'Blitzer', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block'],
                cost: 80000, limit: 4,
                sprite: { sheet: 'assets/sprites/orc.gif',
                    base:   { x:  0, y: 83, w: 27, h: 25 },
                    armour: { x: 32, y: 82, w: 27, h: 26 } },
            },
            {
                pos: 'Thrower', ma: 5, st: 3, ag: 3, pa: 3, av: 9, skills: ['Pass', 'Sure Hands'],
                cost: 70000, limit: 2,
                sprite: { sheet: 'assets/sprites/orc.gif',
                    base:   { x:  0, y:  0, w: 26, h: 26 },
                    armour: { x: 32, y:  0, w: 26, h: 26 } },
            },
            {
                pos: 'Black Orc', ma: 4, st: 4, ag: 2, pa: 6, av: 9, skills: [],
                cost: 90000, limit: 4,
                sprite: { sheet: 'assets/sprites/orc.gif',
                    base:   { x:  0, y: 191, w: 30, h: 31 },
                    armour: { x: 32, y: 191, w: 29, h: 31 } },
            },
        ],
    },
};

// Convert a stored team {name, race, roster:[{pos,name}]} to a fully expanded
// team definition that webbb can consume directly (no DB call needed on that end).
function expandTeam(dbTeam) {
    const raceDef = ROSTER_DEFS[dbTeam.race];
    if (!raceDef) return null;
    const players = dbTeam.roster.map(slot => {
        const posDef = raceDef.positions.find(p => p.pos === slot.pos);
        if (!posDef) return null;
        return {
            name:   slot.name,
            pos:    posDef.pos,
            ma:     posDef.ma,
            st:     posDef.st,
            ag:     posDef.ag,
            pa:     posDef.pa,
            av:     posDef.av,
            skills: Array.isArray(slot.skills) ? [...slot.skills] : [...posDef.skills],
            sprite: posDef.sprite,
        };
    }).filter(Boolean);
    // homeColour / awayColour: stored on the team, or fall back to race default
    const homeColour = dbTeam.homeColour || raceDef.colour;
    const awayColour = dbTeam.awayColour || raceDef.colour;
    return { name: dbTeam.name, homeColour, awayColour, players };
}

// Total gold cost of a roster array [{pos, name}] for a given race.
function rosterCost(race, roster) {
    const raceDef = ROSTER_DEFS[race];
    if (!raceDef) return 0;
    return roster.reduce((sum, slot) => {
        const pd = raceDef.positions.find(p => p.pos === slot.pos);
        return sum + (pd ? pd.cost : 0);
    }, 0);
}

if (typeof module !== 'undefined') {
    module.exports = { ROSTER_DEFS, SKILLS, COLOURS, expandTeam, rosterCost };
}
