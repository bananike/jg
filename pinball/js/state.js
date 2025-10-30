import { colorOfKind } from './colors.js';
import { PLAYER_SIZE, PLAYER_SPEED } from './config.js';
import { initStats, resetStats } from './stats.js';

// ===== State (순수 데이터) =====
export const key = { left: false, right: false, up: false, down: false, auto: false };
export const player = { x: 230, y: 720 - 46, w: PLAYER_SIZE, h: PLAYER_SIZE, speed: PLAYER_SPEED };
export const SB_KIND = {
    POWER: 'POWER',
    FLAME: 'FLAME',
    PIERCE: 'PIERCE',
    EXPLO: 'EXPLO',
    SPLIT: 'SPLIT',
    ICE: 'ICE',
    VOID: 'VOID',
    LASER: 'LASER',
    BLEED: 'BLEED',
};

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
        ICE: makeSBSlot(340),
        VOID: makeSBSlot(420),
        LASER: makeSBSlot(360),
        BLEED: makeSBSlot(300),
    },
    dropChanceBoss: 0.6,
    bossDropRolls: 3,
    hitSeq: 0,
    flameTintUntil: 0,

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
        const chip = (n, key) =>
            `<button data-sb="${key}" style="color:${colorOfKind(
                key,
            )};font-weight:600; padding:0; height:16.5px; width: 16.5px;background-color: ${colorOfKind(
                key,
            )}; object-fit:contain;"><img src="./assets/ball-${key.toLowerCase()}.svg" alt="" /></button>:${n ?? 0}`;
        dom.sbStockEl.innerHTML = [
            chip(u.POWER.count, 'POWER'),
            chip(u.FLAME.count, 'FLAME'),
            chip(u.PIERCE.count, 'PIERCE'),
            chip(u.EXPLO.count, 'EXPLO'),
            chip(u.SPLIT.count, 'SPLIT'),
            chip(u.ICE.count, 'ICE'),
            chip(u.VOID.count, 'VOID'),
            chip(u.LASER.count, 'LASER'),
            chip(u.BLEED.count, 'BLEED'),
        ].join(' | ');
    },
    setHelpBoard: () => {
        if (!dom.sbHelpBoard || !dom.canvas) {
            return;
        }
        const canvasWidth = dom.canvas.width;
        const canvasOffset = dom.canvas.offsetTop;
        dom.sbHelpBoard.style.transform = `translateX(${canvasWidth / 2}px)`;
        dom.sbHelpBoard.style.top = canvasOffset + 'px';
        const childLi = dom.sbHelpBoard.querySelectorAll('li');
        [...childLi].forEach((el) => {
            const key = el.getAttribute('data-sb');
            el.querySelector('img').style.borderColor = colorOfKind(key);
        });
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
    dom.sbHelpBoard = byId('helpBoard');
};

// ===== Input =====
export const inputSetup = () => {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            key.left = true;
        }
        if (e.key === 'ArrowRight') {
            key.right = true;
        }
        if (e.code === 'KeyZ') {
            key.up = true; // 각도 위쪽(감소)
        }
        if (e.code === 'KeyX') {
            key.down = true; // 각도 아래쪽(증가)
        }
        if (e.code === 'Space') {
            key.auto = true;
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft') {
            key.left = false;
        }
        if (e.key === 'ArrowRight') {
            key.right = false;
        }
        if (e.code === 'KeyZ') {
            key.up = false;
        }
        if (e.code === 'KeyX') {
            key.down = false;
        }
    });
};

// ===== Reset =====
export const reset = () => {
    initStats();
    resetStats();

    world.ts0 = 0;
    world.lastTs = 0;
    world.gameOver = false;
    world.score = 0;
    world.hp = 3;
    world.maxBalls = 5;
    world.ballDmgBase = 0.5; // 기존 1.0 → 0.5
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
        ICE: makeSBSlot(340),
        VOID: makeSBSlot(420),
        LASER: makeSBSlot(360),
        BLEED: makeSBSlot(300),
    };
    world.dropChanceBoss = 0.6;
    world.bossDropRolls = 3;
    world.hitSeq = 0;
    world.flameTintUntil = 0;
    world.fx = [];

    player.x = 230;
    player.y = 720 - 46;
    key.auto = false;

    ui.setScore(world.score);
    ui.setHp(world.hp);
    ui.setMaxBalls(world.maxBalls);
    ui.setBallDmg(world.ballDmgBase);
    ui.setSBStock();
    ui.setHelpBoard();
};
