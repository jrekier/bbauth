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
    'Right Stuff', 'Break Tackle', 'Taunt', 'Unsteady',
    'Always Hungry', 'Projectile Vomit', 'Throw Team-mate',
    'Animal Savagery', 'Prehensile Tail',
];

const ROSTER_DEFS = {
    humans: {
        logo:   'assets/logos/Human_BB2025.svg',
        colour: [200, 30, 30],
        budget: 1000000,
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Halfling Hopeful', ma: 5, st: 2, ag: 3, pa: 4, av: 7, skills: ['Dodge', 'Right Stuff', 'Stunty'],
                cost: 30000, limit: 3,
                sprites: [
                    { sheet: 'assets/sprites/halfling.gif', base: { x:  2, y:  0, w: 19, h: 24 }, armour: { x: 40, y:  0, w: 21, h: 24 } },
                    { sheet: 'assets/sprites/halfling.gif', base: { x:  2, y: 25, w: 18, h: 22 }, armour: { x: 41, y: 25, w: 19, h: 22 } },
                    { sheet: 'assets/sprites/halfling.gif', base: { x:  2, y: 48, w: 18, h: 21 }, armour: { x: 41, y: 48, w: 19, h: 19 } },
                ],
            },
            {
                pos: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: [],
                cost: 50000, limit: 16,
                sprites: [
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y:  0, w: 25, h: 26 }, armour: { x: 26, y:  0, w: 23, h: 26 } },
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y: 27, w: 25, h: 26 }, armour: { x: 26, y: 27, w: 23, h: 26 } },
                ],
            },
            {
                pos: 'Catcher', ma: 8, st: 3, ag: 3, pa: 4, av: 8, skills: ['Catch', 'Dodge'],
                cost: 75000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y:  54, w: 24, h: 26 }, armour: { x: 26, y:  54, w: 24, h: 26 } },
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y:  81, w: 26, h: 26 }, armour: { x: 26, y:  81, w: 24, h: 26 } },
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y: 108, w: 24, h: 26 }, armour: { x: 26, y: 108, w: 24, h: 26 } },
                    { sheet: 'assets/sprites/human.gif', base: { x:  0, y: 135, w: 25, h: 26 }, armour: { x: 26, y: 135, w: 24, h: 26 } },
                ],
            },
            {
                pos: 'Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: ['Pass', 'Sure Hands'],
                cost: 75000, limit: 2,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  2, y: 162, w: 24, h: 27 },
                    armour: { x: 28, y: 162, w: 22, h: 27 } },
            },
            {
                pos: 'Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block', 'Tackle'],
                cost: 85000, limit: 2,
                sprite: { sheet: 'assets/sprites/human.gif',
                    base:   { x:  0, y: 190, w: 26, h: 26 },
                    armour: { x: 26, y: 190, w: 24, h: 26 } },
            },
            {
                pos: 'Ogre', ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['Bone-head', 'Loner', 'Mighty Blow', 'Thick Skull', 'Throw Team-mate'],
                cost: 140000, limit: 1,
                sprite: { sheet: 'assets/sprites/ogre.gif',
                    base:   { x:  0, y: 0, w: 38, h: 38 },
                    armour: { x: 36, y: 0, w: 34, h: 38 },
                    armourTrimLeft: 2 },
            },
        ],
    },

    orcs: {
        logo:   'assets/logos/Orc_BB2025.svg',
        colour: [30, 80, 180],
        budget: 1000000,
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Goblin Lineman', ma: 6, st: 2, ag: 3, pa: 3, av: 8, skills: ['Dodge', 'Right Stuff', 'Stunty'],
                cost: 40000, limit: 4,
                sprites: [
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  0, y:   0, w: 19, h: 24 }, armour: { x: 39, y:   0, w: 19, h: 22 } },
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  0, y:  24, w: 20, h: 26 }, armour: { x: 38, y:  24, w: 20, h: 23 } },
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  1, y:  50, w: 18, h: 27 }, armour: { x: 38, y:  50, w: 21, h: 27 } },
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  0, y:  77, w: 21, h: 25 }, armour: { x: 39, y:  77, w: 18, h: 25 } },
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  0, y: 102, w: 18, h: 22 }, armour: { x: 38, y: 102, w: 18, h: 22 } },
                    { sheet: 'assets/sprites/goblin.gif', base: { x:  0, y: 149, w: 19, h: 27 }, armour: { x: 38, y: 149, w: 19, h: 24 } },
                ],
            },
            {
                pos: 'Orc Lineman', ma: 5, st: 3, ag: 3, pa: 4, av: 10, skills: [],
                cost: 50000, limit: 16,
                sprites: [
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y:  0, w: 26, h: 26 }, armour: { x: 32, y:  0, w: 26, h: 26 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 27, w: 26, h: 27 }, armour: { x: 32, y: 27, w: 25, h: 27 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 55, w: 26, h: 26 }, armour: { x: 32, y: 55, w: 26, h: 26 } },
                ],
            },
            {
                pos: 'Orc Thrower', ma: 6, st: 3, ag: 3, pa: 3, av: 9, skills: ['Pass', 'Sure Hands'],
                cost: 75000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 319, w: 24, h: 26 }, armour: { x: 32, y: 319, w: 23, h: 26 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 346, w: 24, h: 27 }, armour: { x: 32, y: 346, w: 23, h: 27 } },
                ],
            },
            {
                pos: 'Orc Blitzer', ma: 6, st: 3, ag: 3, pa: 4, av: 10, skills: ['Block', 'Break Tackle'],
                cost: 85000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y:  82, w: 27, h: 26 }, armour: { x: 32, y:  82, w: 27, h: 26 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 109, w: 27, h: 27 }, armour: { x: 32, y: 109, w: 27, h: 27 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 137, w: 26, h: 26 }, armour: { x: 32, y: 137, w: 27, h: 26 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 164, w: 27, h: 26 }, armour: { x: 32, y: 164, w: 27, h: 26 } },
                ],
            },
            {
                pos: 'Big Un Blocker', ma: 5, st: 4, ag: 4, pa: 6, av: 10, skills: ['Mighty Blow', 'Taunt', 'Thick Skull', 'Unsteady'],
                cost: 95000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 374, w: 30, h: 31 }, armour: { x: 32, y: 374, w: 31, h: 31 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 405, w: 31, h: 32 }, armour: { x: 32, y: 405, w: 31, h: 32 } },
                    { sheet: 'assets/sprites/orc.gif', base: { x: 0, y: 437, w: 31, h: 32 }, armour: { x: 32, y: 437, w: 31, h: 32 } },
                ],
            },
            {
                pos: 'Troll', ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['Always Hungry', 'Loner', 'Mighty Blow', 'Projectile Vomit', 'Really Stupid', 'Regeneration', 'Throw Team-mate'],
                cost: 115000, limit: 1,
                sprite: { sheet: 'assets/sprites/goblin.gif',
                    base:   { x:  0, y: 396, w: 40, h: 38 },
                    armour: { x: 38, y: 396, w: 40, h: 38 },
                    armourTrimLeft: 2 },
            },
        ],
    },

    skaven: {
        logo:   'assets/logos/Skaven_BB2025.svg',
        colour: [180, 140, 60],
        budget: 1000000,
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Skaven Clanrat', ma: 7, st: 3, ag: 3, pa: 4, av: 8, skills: [],
                cost: 50000, limit: 16,
                sprites: [
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y:  0, w: 23, h: 25 }, armour: { x: 34, y:  0, w: 24, h: 25 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 26, w: 23, h: 23 }, armour: { x: 34, y: 26, w: 22, h: 23 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 50, w: 23, h: 23 }, armour: { x: 34, y: 50, w: 21, h: 23 } },
                ],
            },
            {
                pos: 'Skaven Thrower', ma: 7, st: 3, ag: 3, pa: 2, av: 8, skills: ['Pass', 'Sure Hands'],
                cost: 80000, limit: 2,
                sprite: { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 224, w: 23, h: 26 }, armour: { x: 34, y: 224, w: 23, h: 26 } },
            },
            {
                pos: 'Gutter Runner', ma: 9, st: 2, ag: 2, pa: 4, av: 8, skills: ['Dodge', 'Stab'],
                cost: 85000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 124, w: 25, h: 24 }, armour: { x: 34, y: 124, w: 24, h: 24 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 149, w: 25, h: 24 }, armour: { x: 34, y: 149, w: 24, h: 24 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 174, w: 25, h: 24 }, armour: { x: 34, y: 174, w: 24, h: 24 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y: 199, w: 25, h: 24 }, armour: { x: 34, y: 199, w: 24, h: 24 } },
                ],
            },
            {
                pos: 'Skaven Blitzer', ma: 8, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block', 'Strip Ball'],
                cost: 90000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y:  74, w: 23, h: 23 }, armour: { x: 34, y:  74, w: 23, h: 23 } },
                    { sheet: 'assets/sprites/skaven.gif', base: { x:  0, y:  98, w: 23, h: 25 }, armour: { x: 34, y:  98, w: 23, h: 25 } },
                ],
            },
            {
                pos: 'Rat Ogre', ma: 6, st: 5, ag: 4, pa: 6, av: 9, skills: ['Animal Savagery', 'Frenzy', 'Loner', 'Mighty Blow', 'Prehensile Tail'],
                cost: 150000, limit: 1,
                sprite: { sheet: 'assets/sprites/skaven.gif', 
                    base: { x:  0, y: 251, w: 38, h: 38 }, 
                    armour: { x: 34, y: 251, w: 24, h: 38 }, 
                    armourTrimLeft: 4 },
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
            sprite: slot.sprite || posDef.sprite,
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

const PLAYER_NAMES = {
    humans: [
        'Aldric', 'Brennan', 'Cedric', 'Daran', 'Edmund', 'Farrell', 'Gareth', 'Hadwin',
        'Ivar', 'Jareth', 'Kenrick', 'Leoric', 'Merton', 'Norbert', 'Oswin', 'Percival',
        'Quinn', 'Roderick', 'Sigmar', 'Thorn', 'Ulric', 'Vance', 'Wulfric', 'Xander',
        'Yorick', 'Zane', 'Aethelred', 'Bolverk', 'Conrad', 'Dagmar',
    ],
    orcs: [
        'Azog', 'Bolg', 'Crusha', 'Drukk', 'Elog', 'Fangrak', 'Gorgut', 'Harnak',
        'Ironfist', 'Jagg', 'Krumpa', 'Lugrak', 'Morg', 'Nurgit', 'Orrak', 'Pugna',
        'Ragnok', 'Skrag', 'Torgoch', 'Ugluk', 'Vorg', 'Waaghnak', 'Xurg', 'Yagrak',
        'Zograt', 'Burrak', 'Dakkag', 'Gutrot', 'Hrakka', 'Kilgor',
    ],
    goblins: [
        'Snikt', 'Grix', 'Nubz', 'Zapp', 'Wik', 'Plugg', 'Skwee', 'Nark',
        'Fizzle', 'Grimp', 'Snik', 'Twitchy', 'Wobble', 'Pox', 'Zeeble',
    ],
    skaven: [
        'Skritch', 'Queek', 'Snikch', 'Kratch', 'Feskit', 'Vrisk', 'Tretch',
        'Rikkit', 'Gnawfang', 'Skitter', 'Scritclaw', 'Vrrsk', 'Grrit', 'Krichk',
        'Flink', 'Rattachak', 'Skree', 'Chittr', 'Gnaw', 'Scratch',
        'Skrolk', 'Nurglitch', 'Klawmunkast', 'Snarl', 'Squeak', 'Nibble',
        'Reekit', 'Hackfang', 'Nikkitt', 'Scurry',
    ],
};

function randomPlayerName(race, pos) {
    const posKey = pos && pos.toLowerCase().split(' ')[0];  // 'goblin lineman' → 'goblin'
    const pool = PLAYER_NAMES[posKey] || PLAYER_NAMES[race] || [];
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
}

if (typeof module !== 'undefined') {
    module.exports = { ROSTER_DEFS, SKILLS, COLOURS, PLAYER_NAMES, expandTeam, rosterCost, randomPlayerName };
}
