// ===== State (순수 데이터) =====
export const key = { left: false, right: false, up: false, down: false, auto: false };
export const player = { x: 230, y: 720 - 46, w: 34, h: 34, speed: 6 };
export const SB_KIND = { POWER: 'POWER', FLAME: 'FLAME', PIERCE: 'PIERCE', EXPLO: 'EXPLO', SPLIT: 'SPLIT' };

const makeSBSlot = (intervalMs) => ({
    count: 0,
    max: 0,
    active: 0,
    nextFire: 0,
    fireInterval: intervalMs,
});

export const world = {
    ts0: 0,
    lastTs: 0,
    gameOver: false,
    score: 0,
    hp: 3,
    maxBalls: 5,
    ballDmgBase: 1.0,
    aim: -Math.PI / 2,
    lastFire: 0,
    lastSpawn: 0,
    lastBossAt: 0,
    bossSpawnCount: 0,
    bossPreFreezeUntil: 0,
    normalSpawnPausedUntil: 0,
    balls: [],
    sbBalls: [],
    blocks: [],
    items: [],
    useSB: {
        POWER: makeSBSlot(300),
        FLAME: makeSBSlot(300),
        PIERCE: makeSBSlot(260),
        EXPLO: makeSBSlot(380),
        SPLIT: makeSBSlot(320),
    },
    dropChanceBoss: 0.6,
    bossDropRolls: 3,
    hitSeq: 0,

    // FX 버퍼
    fx: [], // {type:'EXPLO', x,y, start,end, rMax}
};

// ===== DOM refs =====
export const dom = {
    canvas: null,
    ctx: null,
    scoreEl: null,
    hpEl: null,
    maxBallsEl: null,
    ballDmgEl: null,
    restartBtn: null,
    sbStockEl: null,
};

// ===== UI helpers =====
export const ui = {
    setScore: (n) => dom.scoreEl && (dom.scoreEl.textContent = String(n)),
    setHp: (n) => dom.hpEl && (dom.hpEl.textContent = String(n)),
    setMaxBalls: (n) => dom.maxBallsEl && (dom.maxBallsEl.textContent = String(n)),
    setBallDmg: (v) => dom.ballDmgEl && (dom.ballDmgEl.textContent = v.toFixed(2)),
    setSBStock: () => {
        if (!dom.sbStockEl || !world.useSB) {
            return;
        }
        const u = world.useSB;
        const chip = (label, color, n) => `<span style="color:${color};font-weight:600">${label}</span>:${n ?? 0}`;
        dom.sbStockEl.innerHTML = [
            chip('P', '#ff9e00', u.POWER.count),
            chip('F', '#ef233c', u.FLAME.count),
            chip('X', '#06d6a0', u.PIERCE.count),
            chip('E', '#8338ec', u.EXPLO.count),
            chip('S', '#3a86ff', u.SPLIT.count),
        ].join(' | ');
    },
};

// ===== DOM 바인딩 =====
export const bindDOM = () => {
    const byId = (id) => document.getElementById(id);
    dom.canvas = byId('game');
    if (!dom.canvas) {
        throw new Error('#game canvas missing');
    }
    dom.ctx = dom.canvas.getContext('2d');
    dom.scoreEl = byId('score');
    dom.hpEl = byId('hp');
    dom.maxBallsEl = byId('maxBalls');
    dom.ballDmgEl = byId('ballDmg');
    dom.restartBtn = byId('restart');
    dom.sbStockEl = byId('sbStock');
};

// ===== Input =====
export const inputSetup = () => {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            key.left = true;
        } else if (e.key === 'ArrowRight') {
            key.right = true;
        } else if (e.key === 'ArrowUp') {
            key.up = true;
        } else if (e.key === 'ArrowDown') {
            key.down = true;
        } else if (e.code === 'Space') {
            key.auto = true;
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft') {
            key.left = false;
        } else if (e.key === 'ArrowRight') {
            key.right = false;
        } else if (e.key === 'ArrowUp') {
            key.up = false;
        } else if (e.key === 'ArrowDown') {
            key.down = false;
        }
    });
};

// ===== Reset =====
export const reset = () => {
    world.ts0 = 0;
    world.lastTs = 0;
    world.gameOver = false;
    world.score = 0;
    world.hp = 3;
    world.maxBalls = 5;
    world.ballDmgBase = 1.0;
    world.aim = -Math.PI / 2;
    world.lastFire = 0;
    world.lastSpawn = 0;
    world.lastBossAt = 0;
    world.bossSpawnCount = 0;
    world.bossPreFreezeUntil = 0;
    world.normalSpawnPausedUntil = 0;
    world.balls = [];
    world.sbBalls = [];
    world.blocks = [];
    world.items = [];
    world.useSB = {
        POWER: makeSBSlot(300),
        FLAME: makeSBSlot(300),
        PIERCE: makeSBSlot(260),
        EXPLO: makeSBSlot(380),
        SPLIT: makeSBSlot(320),
    };
    world.dropChanceBoss = 0.6;
    world.bossDropRolls = 3;
    world.hitSeq = 0;
    world.fx = [];

    player.x = 230;
    player.y = 720 - 46;
    key.auto = false;

    ui.setScore(world.score);
    ui.setHp(world.hp);
    ui.setMaxBalls(world.maxBalls);
    ui.setBallDmg(world.ballDmgBase);
    ui.setSBStock();
};
