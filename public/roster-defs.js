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
    'Loner', 'Wild Animal', 'Bone Head', 'Really Stupid', 'Take Root',
    'Right Stuff', 'Break Tackle', 'Taunt', 'Unsteady',
    'Always Hungry', 'Projectile Vomit', 'Throw Team-Mate',
    'Animal Savagery', 'Prehensile Tail',
    'Dauntless', 'Dirty Player', 'No Ball', 'Secret Weapon',
    'Fend', 'Give and Go', 'Pro',
    'Defensive', 'Diving Tackle', 'Hatred (Troll)', 'Leader',
];

// ── Team special rules ─────────────────────────────────────────────
// Each team roster carries zero or more of these. `text` is the rulebook
// wording; `implemented` says whether webbb actually acts on it, so an
// unimplemented rule is visibly parked rather than quietly missing.
// Spelling is canonical: webbb matches these strings exactly.
const TEAM_SPECIAL_RULES = {
    'Bribery and Corruption': {
        text: 'Once per game, when a team with this special rule rolls a 1 to '
            + 'Argue the Call, they may re-roll the D6. The team also has access '
            + 'to cheaper Bribes as an inducement (0-6 at 50,000 gp).',
        implemented: true,   // the Argue the Call half; cheap Bribes land with inducements
    },
    'Team Captain': {
        text: 'One player is designated as Team Captain at roster creation, '
            + 'gaining the Pro skill for free without increasing their value.',
        implemented: false,
    },
    "Brawlin' Brutes": {
        text: 'League play only: the team earns more SPP for causing casualties '
            + 'and less for scoring touchdowns.',
        implemented: false,  // SPP progression is tourplay's business, not ours
    },
};

// Per-race rosters, at standard BB2025 hiring fees — Sevens does not change
// what a player costs. `min`, `max` and each position's `limit` are reference
// data only; nothing in the builder or the API enforces them (see STAFF_LIMITS
// below for why). What is load-bearing is `cost`, which feeds Team Value.
// The draft budget is not per-race in Sevens — see DRAFT_BUDGET.
const ROSTER_DEFS = {
    humans: {
        specialRules: ['Team Captain'],
        logo:   'assets/logos/Human_BB2025.svg',
        colour: [200, 30, 30],
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
                pos: 'Ogre', ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['Bone Head', 'Loner', 'Mighty Blow', 'Thick Skull', 'Throw Team-Mate'],
                cost: 140000, limit: 1,
                sprite: { sheet: 'assets/sprites/ogre.gif',
                    base:   { x:  0, y: 0, w: 38, h: 38 },
                    armour: { x: 36, y: 0, w: 34, h: 38 },
                    armourTrimLeft: 2 },
            },
        ],
    },

    orcs: {
        specialRules: ["Brawlin' Brutes", 'Team Captain'],
        logo:   'assets/logos/Orc_BB2025.svg',
        colour: [30, 80, 180],
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
                pos: 'Troll', ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: ['Always Hungry', 'Loner', 'Mighty Blow', 'Projectile Vomit', 'Really Stupid', 'Regeneration', 'Throw Team-Mate'],
                cost: 115000, limit: 1,
                sprite: { sheet: 'assets/sprites/goblin.gif',
                    base:   { x:  0, y: 396, w: 40, h: 38 },
                    armour: { x: 38, y: 396, w: 40, h: 38 },
                    armourTrimLeft: 2 },
            },
        ],
    },

    skaven: {
        specialRules: [],
        logo:   'assets/logos/Skaven_BB2025.svg',
        colour: [180, 140, 60],
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

    dwarfs: {
        specialRules: ["Brawlin' Brutes", 'Bribery and Corruption'],
        logo:   'assets/logos/Dwarf_BB2025.svg',
        colour: [60, 90, 140],
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Dwarf Lineman', ma: 4, st: 3, ag: 4, pa: 5, av: 10, skills: ['Block', 'Defensive', 'Thick Skull'],
                cost: 70000, limit: 16,
                sprites: [
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y:   0, w: 22, h: 25 }, armour: { x: 24, y:   0, w: 21, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y:  26, w: 22, h: 25 }, armour: { x: 24, y:  26, w: 21, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y:  52, w: 22, h: 25 }, armour: { x: 24, y:  52, w: 21, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y:  78, w: 22, h: 25 }, armour: { x: 24, y:  78, w: 21, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 105, w: 22, h: 25 }, armour: { x: 24, y: 104, w: 21, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 131, w: 22, h: 26 }, armour: { x: 24, y: 131, w: 21, h: 26 } },
                ],
            },
            {
                pos: 'Dwarf Runner', ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: ['Sprint', 'Sure Hands', 'Thick Skull'],
                cost: 80000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 158, w: 22, h: 24 }, armour: { x: 24, y: 158, w: 19, h: 24 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 183, w: 22, h: 25 }, armour: { x: 24, y: 183, w: 19, h: 25 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 208, w: 22, h: 24 }, armour: { x: 24, y: 208, w: 19, h: 24 } },
                ],
            },
            {
                pos: 'Dwarf Blitzer', ma: 5, st: 3, ag: 4, pa: 4, av: 10, skills: ['Block', 'Diving Tackle', 'Tackle', 'Thick Skull'],
                cost: 100000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 233, w: 22, h: 26 }, armour: { x: 24, y: 233, w: 21, h: 26 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 0, y: 260, w: 22, h: 26 }, armour: { x: 24, y: 260, w: 21, h: 26 } },
                ],
            },
            {
                pos: 'Troll Slayer', ma: 5, st: 3, ag: 4, pa: 5, av: 9, skills: ['Block', 'Dauntless', 'Frenzy', 'Hatred (Troll)', 'Thick Skull'],
                cost: 95000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 1, y: 287, w: 21, h: 27 }, armour: { x: 25, y: 287, w: 18, h: 27 } },
                    { sheet: 'assets/sprites/dwarf.gif', base: { x: 1, y: 315, w: 21, h: 26 }, armour: { x: 25, y: 315, w: 18, h: 26 } },
                ],
            },
            {
                pos: 'Deathroller', ma: 5, st: 7, ag: 5, pa: '-', av: 11, skills: ['Break Tackle', 'Dirty Player', 'Juggernaut', 'Loner', 'Mighty Blow', 'No Ball', 'Secret Weapon', 'Stand Firm'],
                cost: 170000, limit: 1,
                sprite: { sheet: 'assets/sprites/dwarf.gif',
                    base:   { x: 0, y: 342, w: 33, h: 38 },
                    armour: { x: 24, y: 342, w: 23, h: 24 },
                    armourTrimLeft: 4 },
            },
        ],
    },

    imperialnobility: {
        specialRules: [],
        logo:   'assets/logos/ImperialNobility_BB2025.svg',
        colour: [175, 35, 45],
        min: 7,
        max: 11,
        positions: [
            {
                pos: 'Imperial Retainer', ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: ['Fend'],
                cost: 45000, limit: 16,
                sprites: [
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y:   0, w: 21, h: 33 }, armour: { x: 40, y:   0, w: 21, h: 31 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y:  34, w: 21, h: 32 }, armour: { x: 40, y:  33, w: 21, h: 32 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y:  67, w: 21, h: 32 }, armour: { x: 40, y:  66, w: 21, h: 32 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y:  99, w: 21, h: 33 }, armour: { x: 40, y:  99, w: 21, h: 31 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 132, w: 21, h: 33 }, armour: { x: 40, y: 132, w: 21, h: 33 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 166, w: 21, h: 32 }, armour: { x: 40, y: 165, w: 21, h: 31 } },
                ],
            },
            {
                pos: 'Imperial Thrower', ma: 6, st: 3, ag: 3, pa: 2, av: 9, skills: ['Give and Go', 'Pass', 'Pro'],
                cost: 75000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 198, w: 23, h: 27 }, armour: { x: 40, y: 198, w: 23, h: 27 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 224, w: 23, h: 26 }, armour: { x: 40, y: 224, w: 23, h: 26 } },
                ],
            },
            {
                pos: 'Noble Blitzer', ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: ['Block', 'Catch', 'Pro'],
                cost: 90000, limit: 2,
                sprites: [
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 250, w: 25, h: 29 }, armour: { x: 40, y: 250, w: 23, h: 28 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 279, w: 25, h: 29 }, armour: { x: 40, y: 279, w: 23, h: 29 } },
                ],
            },
            {
                pos: 'Bodyguard', ma: 5, st: 3, ag: 3, pa: 4, av: 9, skills: ['Stand Firm', 'Wrestle'],
                cost: 85000, limit: 4,
                sprites: [
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 308, w: 30, h: 34 }, armour: { x: 40, y: 308, w: 30, h: 34 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 342, w: 30, h: 34 }, armour: { x: 40, y: 342, w: 30, h: 33 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 376, w: 30, h: 34 }, armour: { x: 40, y: 376, w: 30, h: 34 } },
                    { sheet: 'assets/sprites/imperialnobility.gif', base: { x: 0, y: 410, w: 30, h: 34 }, armour: { x: 40, y: 410, w: 30, h: 34 } },
                ],
            },
            {
                pos: 'Ogre', ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: ['Bone Head', 'Loner', 'Mighty Blow', 'Thick Skull', 'Throw Team-Mate'],
                cost: 140000, limit: 1,
                sprite: { sheet: 'assets/sprites/imperialnobility.gif',
                    base:   { x: 0, y: 444, w: 37, h: 40 },
                    armour: { x: 41, y: 444, w: 29, h: 40 },
                    armourTrimLeft: 2 },
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
            cost:   posDef.cost,
        };
    }).filter(Boolean);
    // Colours / extras may arrive parsed (the builder passes camelCase objects)
    // or raw from a DB row (snake_case `home_colour`, `extras` as JSON strings).
    const parseVal = (v) => {
        if (v && typeof v === 'object') return v;
        if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
        return null;
    };
    const homeColour = parseVal(dbTeam.homeColour) || parseVal(dbTeam.home_colour) || raceDef.colour;
    const awayColour = parseVal(dbTeam.awayColour) || parseVal(dbTeam.away_colour) || raceDef.colour;
    const ex  = parseVal(dbTeam.extras)      || {};
    const ind = parseVal(dbTeam.inducements) || {};

    // Team resources as drafted, before inducements.
    const res = {
        rerolls:          ex.rerolls          || 0,
        bribes:           0,                        // bribes are inducement-only
        cheerleaders:     ex.cheerleaders     || 0,
        assistantCoaches: ex.assistantCoaches || 0,
        fanFactor:        ex.fanFactor        || 0,
        apothecary:       !!ex.apothecary,
    };

    // Fold the wired inducements in. Each names the resource it tops up, so
    // webbb receives one set of numbers and needs no inducement logic at all.
    for (const i of INDUCEMENTS) {
        const n = ind[i.key] || 0;
        if (!n || !i.applies) continue;
        if (i.applies === 'apothecary') res.apothecary = true;
        else res[i.applies] += n;
    }

    return {
        name: dbTeam.name, race: dbTeam.race, homeColour, awayColour, players,
        // Team Value travels with the team so webbb never needs a price list of
        // its own. Inducements are excluded from it by rule.
        tv:               teamValue(dbTeam.race, dbTeam.roster, ex),
        specialRules:     [...(raceDef.specialRules || [])],
        // What was bought, kept for display; the effect is already in `res`.
        inducements:      { ...ind },
        // Inducements the engine acts on directly rather than by topping up a
        // resource. Prayers/Desperate Measures are rolled later, at launch.
        kegs:             ind.kegs || 0,
        masterChef:       !!ind.masterChef,
        ...res,
    };
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

// ── Team creation prices ───────────────────────────────────────────
// Blood Bowl SEVENS, 2025 edition. Single source of truth for what everything
// costs. Team Value is derived from these, and TV is what inducements and
// petty cash are worked out from, so a wrong price here quietly skews every
// match-up.
//
// Player hiring fees and positional limits live on ROSTER_DEFS above and are
// the standard BB2025 roster values — Sevens does not change them.

// The Sevens draft budget. Reference only (nothing enforces it), but it is the
// number a coach is working to: "you have a budget of 600,000 gold pieces to
// spend on players, Sideline Staff, team re-rolls and so forth."
const DRAFT_BUDGET = 600000;

// Sevens re-rolls are a flat 100,000 gold pieces for EVERY team, regardless of
// what that team pays at 11-a-side ("Re-rolls are more expensive - a cost of
// 100,000 gold pieces each for every team"). A Sevens team may buy 0-6 at
// drafting and, unlike an ordinary team, can never buy more later.
// `race` is ignored today, but the parameter stays so call sites survive a
// ruleset that goes back to per-team pricing.
const REROLL_COST = 100000;

function rerollCost(_race) {
    return REROLL_COST;
}

const STAFF_COSTS = {
    cheerleader:     20000,
    assistantCoach:  20000,
    dedicatedFan:    20000,   // a.k.a. fan factor — price per step
    apothecary:      80000,
};

// Rulebook quantities. Reference data: nothing here enforces them, because this
// app stands in for a tabletop game among friends and what a team fields is the
// coaches' business. League/tournament enforcement is tourplay's job.
// Note fanFactor starts at 1 — every team has at least one dedicated fan.
const STAFF_LIMITS = {
    rerolls: 6, cheerleaders: 3, assistantCoaches: 3,
    fanFactor: 5, fanFactorMin: 1, apothecary: 1,
};

// Which purchases count toward Team Value. Per the rulebook, TV is the current
// value of all players plus Sideline Staff plus Team Re-rolls; Dedicated Fans
// and Treasury gold are excluded.
const TV_EXTRAS = {
    rerolls: true, apothecary: true, cheerleaders: true, assistantCoaches: true,
    fanFactor: false,
};

// Gold cost of a team's extras {rerolls, cheerleaders, assistantCoaches,
// fanFactor, apothecary}. With `tvOnly`, counts only the extras in TV_EXTRAS.
function extrasCost(race, extras, tvOnly) {
    if (!extras) return 0;
    const counts = key => !tvOnly || TV_EXTRAS[key];
    let total = 0;
    if (counts('rerolls'))          total += (extras.rerolls          || 0) * rerollCost(race);
    if (counts('cheerleaders'))     total += (extras.cheerleaders     || 0) * STAFF_COSTS.cheerleader;
    if (counts('assistantCoaches')) total += (extras.assistantCoaches || 0) * STAFF_COSTS.assistantCoach;
    if (counts('fanFactor'))        total += (extras.fanFactor        || 0) * STAFF_COSTS.dedicatedFan;
    if (counts('apothecary') && extras.apothecary) total += STAFF_COSTS.apothecary;
    return total;
}

// Gold actually spent drafting the team: every player, every extra. Inducements
// are NOT here — in League Play they are bought per match out of Petty Cash and
// Treasury, not out of the draft budget.
function teamCost(race, roster, extras) {
    return rosterCost(race, roster) + extrasCost(race, extras, false);
}

// Team Value — players plus the TV-counting extras. Deliberately not the same
// number as teamCost: what a team is worth is not what its coach paid, and
// inducements never count toward TV at all.
function teamValue(race, roster, extras) {
    return rosterCost(race, roster) + extrasCost(race, extras, true);
}

// ── Prayers to Nuffle (Sevens D8 table) ────────────────────────────
// Sevens has its own table — "Nuffle prefers to focus on grandiose spectacles
// after all". One roll per Prayer bought, duplicates re-rolled.
//
// `kind` says how each result reaches the game:
//   'player'  — buffs one player; applied to the team def before kick-off
//   'team'    — a flag webbb acts on for the whole match
const PRAYERS_TO_NUFFLE = [
    { d8: 1, key: 'treacherousTrapdoor', label: 'Treacherous Trapdoor', kind: 'team',
      text: 'Each time a player from either team enters a square containing a Trapdoor, roll a D6; on a 1 they fall through and are injured as if pushed into the crowd, and any ball they held bounces.' },
    { d8: 2, key: 'stiletto',        label: 'Stiletto',             kind: 'player', grant: 'Stab',
      text: 'One player gains the Stab trait for the game.' },
    { d8: 3, key: 'ironMan',         label: 'Iron Man',             kind: 'player', avBonus: 1,
      text: "One player's AV improves by 1 (to a maximum of 11) for the game." },
    { d8: 4, key: 'knuckleDusters',  label: 'Knuckle Dusters',      kind: 'player', grant: 'Mighty Blow',
      text: 'One player gains the Mighty Blow skill for the game.' },
    { d8: 5, key: 'blessingOfNuffle',label: 'Blessing of Nuffle',   kind: 'player', grant: 'Pro',
      text: 'One randomly selected player gains the Pro skill for the game.' },
    { d8: 6, key: 'molesUnderPitch', label: 'Moles Under the Pitch', kind: 'team',
      text: 'Opposition players apply -1 to Rush attempts.' },
    { d8: 7, key: 'underScrutiny',   label: 'Under Scrutiny',        kind: 'team',
      text: 'Opposition players are automatically sent off for a foul that breaks armour, doubles or not.' },
    { d8: 8, key: 'intensiveTraining', label: 'Intensive Training',  kind: 'player', grant: 'Block',
      text: 'One randomly selected player gains a primary skill of your choice for the game.',
      note: 'The choice of skill is not offered yet — Block is granted.' },
];

// ── Desperate Measures (Sevens-only D8 table) ──────────────────────
// One roll per Desperate Measure bought, re-rolling duplicates. Each is used
// once per game. Every one of them is a thing the coach ACTIVATES at a chosen
// moment, so none are wired to the engine yet — they are rolled, carried and
// shown, and `implemented` stays false until each gets its trigger.
const DESPERATE_MEASURES = [
    { d8: 1, key: 'youDope',        label: 'You Dope!',               implemented: false,
      text: "Improve one player's ST or AG by 1 for the game. At the end of each drive they play in, roll a D6: on 1-2 they are Knocked-out with no recovery allowed." },
    { d8: 2, key: 'razzleDazzle',   label: 'Razzle-dazzle',           implemented: false,
      text: 'When activating a player, declare two Actions instead of one (not the same Action twice, and not two Move Actions).' },
    { d8: 3, key: 'hangover',       label: 'Hangover',                implemented: false,
      text: 'Before setup, choose one opposition player who cannot take part in the first Drive.' },
    { d8: 4, key: 'grudgeMatch',    label: 'Grudge Match',            implemented: false,
      text: 'Declare a Foul Action even if your team already fouled this turn; the player cannot be Sent-off for it.' },
    { d8: 5, key: 'setPiece',       label: 'Set Piece',               implemented: false,
      text: 'One pass is Accurate on a 2+, and the receiving player catches automatically on a 2+.' },
    { d8: 6, key: 'sportsEspionage', label: 'Sports Espionage',       implemented: false,
      text: 'When your team suffers a Turnover, gain two Team Re-rolls afterwards (they cannot re-roll the dice that caused it).' },
    { d8: 7, key: 'bananaSkin',     label: 'Discarded Banana Skin',   implemented: false,
      text: 'When an opposition player enters one of your Tackle Zones, place them Prone and end their activation. No Turnover unless they held the ball.' },
    { d8: 8, key: 'magicScroll',    label: 'Magic Scroll',            implemented: false,
      text: 'Before setup, gain a free Sports-Wizard Inducement.',
      note: 'Sevens has no Wizard inducement at all, so this needs one built first.' },
];

// Roll `n` distinct results off a D8 table. Duplicates are re-rolled, which is
// explicit for Desperate Measures and the usual convention for Prayers.
function rollD8Table(table, n) {
    const taken = new Set();
    const out = [];
    for (let i = 0; i < Math.min(n, table.length); i++) {
        let d8;
        do { d8 = Math.floor(Math.random() * 8) + 1; } while (taken.has(d8));
        taken.add(d8);
        out.push(table.find(e => e.d8 === d8).key);
    }
    return out;
}

// Apply the player-buff prayers to an expanded team def, in place. Returns a
// log line per prayer so the coaches can see what Nuffle did.
// The target is random: the rulebook lets the coach pick for some of these, but
// there is no picker yet, so every one of them rolls for a target.
function applyPrayers(teamDef, prayerKeys) {
    const log = [];
    for (const key of prayerKeys || []) {
        const pr = PRAYERS_TO_NUFFLE.find(p => p.key === key);
        if (!pr) continue;
        if (pr.kind !== 'player') { log.push(`${teamDef.name}: ${pr.label} — ${pr.text}`); continue; }

        const eligible = teamDef.players.filter(Boolean);
        if (!eligible.length) continue;
        const target = eligible[Math.floor(Math.random() * eligible.length)];

        if (pr.grant && !target.skills.includes(pr.grant)) {
            target.skills.push(pr.grant);
            // Tag it so webbb can colour a prayer-granted ability differently
            // in the action wheel from one the player always had.
            (target.prayerSkills || (target.prayerSkills = [])).push(pr.grant);
        }
        if (pr.avBonus) target.av = Math.min(11, (target.av || 0) + pr.avBonus);
        log.push(`${teamDef.name}: ${pr.label} — ${target.name}${pr.grant ? ` gains ${pr.grant}` : ''}${pr.avBonus ? ` improves to AV ${target.av}+` : ''}.`);
    }
    return log;
}

// ── Petty cash ─────────────────────────────────────────────────────
// League Play, in the book's own order:
//   1. Compare CTV.
//   2. The HIGHER-CTV coach spends Treasury gold on inducements first.
//   3. The LOWER-CTV coach then receives Petty Cash equal to the CTV difference
//      plus whatever the other coach just spent from Treasury.
//   4. They may top up with at most 50,000 more from their own Treasury.
// Unspent Petty Cash is lost. With equal CTVs nobody is the underdog, so there
// is no Petty Cash and each coach simply spends their own Treasury.
const PETTY_CASH_TOP_UP = 50000;

// Petty cash for the second coach to buy. `myTV`/`theirTV` are the two CTVs and
// `theirTreasurySpend` is the gold the first coach just spent.
function pettyCash(myTV, theirTV, theirTreasurySpend) {
    if (myTV >= theirTV) return 0;          // not the underdog — no petty cash
    return (theirTV - myTV) + (theirTreasurySpend || 0);
}

// Everything the second coach may spend: petty cash, plus a capped dip into
// their own Treasury. A coach who is not the underdog just spends Treasury.
function inducementBudget(myTV, theirTV, theirTreasurySpend, myTreasury) {
    const petty = pettyCash(myTV, theirTV, theirTreasurySpend);
    const fromTreasury = petty > 0
        ? Math.min(PETTY_CASH_TOP_UP, myTreasury || 0)
        : (myTreasury || 0);
    return { petty, fromTreasury, total: petty + fromTreasury };
}

// TV is quoted in thousands: 1150000 → "1,150k".
function formatTV(tv) {
    return `${Math.round((tv || 0) / 1000).toLocaleString()}k`;
}

// ── Inducements ────────────────────────────────────────────────────
// Blood Bowl Sevens has its own, shorter inducement list at its own prices —
// the standard Blood Bowl table does NOT apply here.
//
// This app plays League Play: inducements are bought PER MATCH, in the staging
// room, out of Petty Cash and Treasury — never out of the draft budget. So they
// live on the match (pending_rooms), not on the team.
//
// Inducements never count toward Team Value, in any mode.
//
// `applies` names the team resource webbb already tracks, so a wired inducement
// folds into the game state with no inducement logic needed on that end.
// `implemented: false` means we carry and price it, but the game does not act
// on it yet — the builder shows those dimmed rather than pretending.
const INDUCEMENTS = [
    { key: 'prayersToNuffle',       label: 'Prayers to Nuffle',           cost:   5000, max: 2, implemented: true,  
      text: "Roll on the Sevens Prayers to Nuffle table. Each prayer lasts the whole match." },
    { key: 'tempCheerleaders',      label: 'Temp Agency Cheerleaders',    cost:  15000, max: 2, implemented: true,  applies: 'cheerleaders', 
      text: "Adds to your Cheering Fans roll on the kick-off table." },
    { key: 'partTimeCoaches',       label: 'Part-Time Assistant Coaches', cost:  15000, max: 2, implemented: true,  applies: 'assistantCoaches', 
      text: "Adds to your Brilliant Coaching roll on the kick-off table." },
    { key: 'kegs',                  label: "Blitzer's Best Kegs",         cost:  50000, max: 2, implemented: true,  
      text: "+1 to every roll to recover a Knocked-out player, all match." },
    { key: 'desperateMeasures',     label: 'Desperate Measures',          cost:  50000, max: 5, implemented: false, 
      text: "Roll a D8 each on the Desperate Measures table. Each is used once per game." },
    { key: 'bribes',                label: 'Bribes',                      cost: 100000, max: 2, implemented: true,  applies: 'bribes',
      discountRule: 'Bribery and Corruption', discountCost: 50000, 
      text: "Spend one to avoid a sending-off after a foul. Roll 2+ or it is wasted." },
    { key: 'wanderingApothecaries', label: 'Wandering Apothecaries',      cost: 100000, max: 1, implemented: true,  applies: 'apothecary',
      requiresApothecary: true, 
      text: "A second apothecary for the match." },
    { key: 'mortuaryAssistant',     label: 'Mortuary Assistant',          cost: 100000, max: 1, implemented: false, requiresRule: 'Masters of Undeath', 
      text: "Improves your chance of raising a killed opponent." },
    { key: 'plagueDoctor',          label: 'Plague Doctor',               cost: 100000, max: 1, implemented: false, requiresRule: 'Favoured of Nurgle', 
      text: "Improves your chance of raising a killed opponent as a Rotter." },
    { key: 'extraTeamTraining',     label: 'Extra Team Training',         cost: 125000, max: 6, implemented: true,  applies: 'rerolls', 
      text: "One extra Team Re-roll for this match." },
    { key: 'masterChef',            label: 'Halfling Master Chef',        cost: 300000, max: 1, implemented: true,  
      text: "Roll 3D6 at the start of each half; each 4+ steals a Team Re-roll from the opponent." },
];

// Some rosters may not hire an apothecary. None of ours opt out yet; a future
// roster does so with `apothecary: false`.
function canHireApothecary(race) {
    const def = ROSTER_DEFS[race];
    return !def || def.apothecary !== false;
}

// Is this inducement on the menu for the given race?
function inducementAvailable(race, ind) {
    const rules = (ROSTER_DEFS[race] && ROSTER_DEFS[race].specialRules) || [];
    if (ind.requiresRule && !rules.includes(ind.requiresRule)) return false;
    if (ind.requiresApothecary && !canHireApothecary(race)) return false;
    return true;
}

function availableInducements(race) {
    return INDUCEMENTS.filter(ind => inducementAvailable(race, ind));
}

// Price for this race — a team special rule may discount it (Bribery and
// Corruption buys Bribes at half price).
function inducementCost(race, ind) {
    const rules = (ROSTER_DEFS[race] && ROSTER_DEFS[race].specialRules) || [];
    if (ind.discountRule && rules.includes(ind.discountRule)) return ind.discountCost;
    return ind.cost;
}

// Total gold spent on inducements {key: count}.
function inducementsCost(race, inducements) {
    if (!inducements) return 0;
    return INDUCEMENTS.reduce((sum, ind) =>
        sum + (inducements[ind.key] || 0) * inducementCost(race, ind), 0);
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
    dwarfs: [
        'Durgin', 'Thorek', 'Brok', 'Kazrik', 'Olfin', 'Dralnir', 'Grimnar', 'Borin',
        'Hagar', 'Snorri', 'Bardin', 'Gotrek', 'Kragg', 'Bromm', 'Thrund', 'Garrek',
        'Durik', 'Norgrim', 'Balin', 'Farin', 'Grundi', 'Hlin', 'Morgrim', 'Skarn',
        'Thordin', 'Ulfar', 'Vagni', 'Wandri', 'Brunin', 'Dwalin',
    ],
    imperialnobility: [
        'Reinhardt', 'Wilhelm', 'Gustav', 'Heinrich', 'Friedrich', 'Konrad', 'Lothar', 'Albrecht',
        'Maximilian', 'Otto', 'Sigismund', 'Theobald', 'Ludwig', 'Bernhard', 'Dietrich', 'Eberhard',
        'Florian', 'Gunther', 'Hartmann', 'Karl', 'Leopold', 'Manfred', 'Norbert', 'Rupert',
        'Stefan', 'Tobias', 'Ulrich', 'Volker', 'Werner', 'Adalbert',
    ],
};

function randomPlayerName(race, pos) {
    const posKey = pos && pos.toLowerCase().split(' ')[0];  // 'goblin lineman' → 'goblin'
    const pool = PLAYER_NAMES[posKey] || PLAYER_NAMES[race] || [];
    if (pool.length === 0) return '';
    return pool[Math.floor(Math.random() * pool.length)];
}

if (typeof module !== 'undefined') {
    module.exports = { ROSTER_DEFS, SKILLS, COLOURS, PLAYER_NAMES, expandTeam, rosterCost,
        STAFF_COSTS, STAFF_LIMITS, TV_EXTRAS, DRAFT_BUDGET, TEAM_SPECIAL_RULES,
        INDUCEMENTS, availableInducements, inducementCost, inducementsCost,
        PETTY_CASH_TOP_UP, pettyCash, inducementBudget,
        PRAYERS_TO_NUFFLE, DESPERATE_MEASURES, rollD8Table, applyPrayers,
        canHireApothecary, rerollCost, extrasCost,
        teamCost, teamValue, formatTV, randomPlayerName };
}
