// state.js
import { colorOfKind } from './colors.js';
import { PLAYER_SIZE, PLAYER_SPEED } from './config.js';
import { initStats, resetStats } from './stats.js';

// ===== State (순수 데이터) =====
export const key = { left: false, right: false, up: false, down: false, auto: false };
export const player = { x: 230, y: 720 - 46, w: PLAYER_SIZE, h: PLAYER_SIZE, speed: PLAYER_SPEED };
export const view = {
    dpr: 1,
    scale: 1,
    cssW: 460,
    cssH: 720,
};

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

const makeSBSlot = (intervalMs) => {
    return {
        count: 0,
        max: 0,
        active: 0,
        nextFire: 0,
        fireInterval: intervalMs,
    };
};

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
    fx: [],
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
    sbHelpBoard: null,
};

// ===== UI helpers =====
export const ui = {
    setScore: (n) => {
        if (dom.scoreEl) {
            dom.scoreEl.textContent = String(n);
        }
    },
    setHp: (n) => {
        if (dom.hpEl) {
            dom.hpEl.textContent = String(n);
        }
    },
    setMaxBalls: (n) => {
        if (dom.maxBallsEl) {
            dom.maxBallsEl.textContent = String(n);
        }
    },
    setBallDmg: (v) => {
        if (dom.ballDmgEl) {
            dom.ballDmgEl.textContent = v.toFixed(2);
        }
    },
    setSBStock: () => {
        if (!dom.sbStockEl || !world.useSB) {
            return;
        }
        const u = world.useSB;
        const chip = (n, key) => {
            return `<button data-sb="${key}" style="color:${colorOfKind(
                key,
            )};font-weight:600; padding:0; height:16.5px; width:16.5px; background-color:${colorOfKind(
                key,
            )}; object-fit:contain;">
<img src="./assets/ball-${key.toLowerCase()}.svg" alt="" />
</button>:${n ?? 0}`;
        };
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

        // 캔버스의 화면상 위치와 CSS 크기 기준으로 정렬
        const r = dom.canvas.getBoundingClientRect();
        dom.sbHelpBoard.style.position = 'absolute';
        dom.sbHelpBoard.style.left = '50%';
        dom.sbHelpBoard.style.transform = 'translateX(-50%)';
        dom.sbHelpBoard.style.top = `${Math.round(r.top + window.scrollY)}px`;

        const nodes = dom.sbHelpBoard.querySelectorAll('li[data-sb]');
        nodes.forEach((el) => {
            const key = el.getAttribute('data-sb');
            const img = el.querySelector('img');
            if (img) {
                img.style.borderColor = colorOfKind(key);
            }
        });
    },
};

// ===== DOM 바인딩 =====
export const bindDOM = () => {
    const byId = (id) => {
        return document.getElementById(id);
    };
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
            key.up = true;
        }
        if (e.code === 'KeyX') {
            key.down = true;
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
    world.ballDmgBase = 0.5; // 0.5부터 시작
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
