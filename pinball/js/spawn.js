import {
    BLOCK_SKINS,
    BOSS_FIRST_DELAY,
    BOSS_HP_MULT,
    BOSS_INTERVAL,
    BOSS_SIZE,
    HP_GROWTH_PER_SEC,
    ITEM_H,
    ITEM_W,
    LEFT_PAD,
    MIN_V_GAP,
    POST_BOSS_FREEZE,
    PRE_BOSS_FREEZE,
    RIGHT_PAD,
    W,
} from './config.js';
import { world } from './state.js';
import { aabbOverlap } from './utils.js';

const leftPad = 20;
const rightPad = 20;

const cfg = {
    blockCols: 8,
    blockGap: 6,
    cell: Math.floor((460 - leftPad - rightPad) / 8),
    blockSize: null,
    minBlockGap: 8,
    hpGrowthPerSec: 0.05,
    bossSizeMul: 3,
    bossHpMul: 8,
    bossFirstDelaySec: 10,
    bossIntervalSec: 25,
    preBossFreezeSec: 3,
    postBossFreezeSec: 2,
};
cfg.blockSize = cfg.cell - cfg.blockGap;

export const pushItemCenter = (cx, cy, kind) => {
    const w = ITEM_W;
    const h = ITEM_H;

    const x = Math.floor(cx - w / 2);
    const y = Math.floor(cy - h / 2);

    world.items.push({ x, y, w, h, kind });
};

const nowElapsedSec = (ts) => {
    if (world.ts0 === 0) {
        return 0;
    }
    return (ts - world.ts0) / 1000;
};

const rectsOverlapHoriz = (ax, aw, bx, bw) => {
    if (ax + aw <= bx) {
        return false;
    }
    if (bx + bw <= ax) {
        return false;
    }
    return true;
};

const hasVerticalClearance = (x, w, ySpawn, needClear) => {
    let topY = Infinity;
    for (let i = 0; i < world.blocks.length; i++) {
        const b = world.blocks[i];
        if (rectsOverlapHoriz(x, w, b.x, b.w) === true) {
            if (b.y < topY) {
                topY = b.y;
            }
        }
    }
    if (topY === Infinity) {
        return true;
    }
    if (topY - ySpawn >= needClear) {
        return true;
    }
    return false;
};

// ── 일반 블록 스폰
export const spawnNormals = (ts) => {
    if (ts < world.normalSpawnPausedUntil) {
        return;
    }
    const interval = 1600 - Math.min(world.score * 4, 600);
    if (ts - world.lastSpawn < interval) {
        return;
    }
    world.lastSpawn = ts;

    const ySpawn = 24;
    const elapsedSec = nowElapsedSec(ts);

    for (let c = 0; c < cfg.blockCols; c++) {
        const willSpawn = Math.random() < 0.78;
        if (willSpawn !== true) {
            continue;
        }

        const x = leftPad + c * cfg.cell + cfg.blockGap / 2;
        const needClear = cfg.blockSize + cfg.minBlockGap;
        if (hasVerticalClearance(x, cfg.blockSize, ySpawn, needClear) !== true) {
            continue;
        }

        const hpAtSpawn = 1 + cfg.hpGrowthPerSec * elapsedSec;
        const skinMax = Math.max(1, BLOCK_SKINS | 0);
        const skin = 1 + Math.floor(Math.random() * skinMax);

        world.blocks.push({
            id: (world._nextId = (world._nextId || 1) + 1),
            x,
            y: ySpawn,
            w: cfg.blockSize,
            h: cfg.blockSize,
            hp: hpAtSpawn,
            maxHp: hpAtSpawn, // 체력 기준치
            skin,
            isBoss: false,
        });
    }
};

export const elapsedSec = (ts) => {
    if (world.ts0 === 0) {
        return 0;
    }
    return (ts - world.ts0) / 1000;
};

const verticalClearOk = (x, w, ySpawn, need) => {
    let topY = Infinity;
    for (let i = 0; i < world.blocks.length; i++) {
        const b = world.blocks[i];
        const hOverlap = !(x + w <= b.x || b.x + b.w <= x);
        if (hOverlap === true) {
            if (b.y < topY) {
                topY = b.y;
            }
        }
    }
    if (topY === Infinity) {
        return true;
    }
    if (topY - ySpawn >= need) {
        return true;
    }
    return false;
};

const clearAreaForBoss = (bx, by, bw, bh, margin) => {
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const b = world.blocks[i];
        if (b.isBoss === true) {
            continue;
        }
        if (aabbOverlap(bx - margin, by - margin, bw + margin * 2, bh + margin * 2, b.x, b.y, b.w, b.h) === true) {
            world.blocks.splice(i, 1);
        }
    }
};

export const maybeSpawnBoss = (ts) => {
    const e = elapsedSec(ts);
    if (e < BOSS_FIRST_DELAY) {
        return;
    }

    const needCount = Math.floor((e - BOSS_FIRST_DELAY) / BOSS_INTERVAL) + 1;
    if (world.bossSpawnCount >= needCount) {
        return;
    }

    if (world.bossPreFreezeUntil === 0) {
        world.bossPreFreezeUntil = ts + PRE_BOSS_FREEZE * 1000;
        world.normalSpawnPausedUntil = world.bossPreFreezeUntil;
        return;
    }
    if (ts < world.bossPreFreezeUntil) {
        return;
    }

    const ySpawn = 24;
    const xMin = LEFT_PAD;
    const xMax = W - RIGHT_PAD - BOSS_SIZE;

    let placed = false;
    let x = xMin + Math.floor(Math.random() * Math.max(1, xMax - xMin + 1));
    for (let tries = 0; tries < 14; tries++) {
        if (verticalClearOk(x, BOSS_SIZE, ySpawn, BOSS_SIZE + MIN_V_GAP) === true) {
            placed = true;
            break;
        }
        x = xMin + Math.floor(Math.random() * Math.max(1, xMax - xMin + 1));
    }
    if (placed !== true) {
        x = Math.floor((W - BOSS_SIZE) / 2);
    }

    clearAreaForBoss(x, ySpawn, BOSS_SIZE, BOSS_SIZE, 6);

    if (typeof world.hitSeq !== 'number') {
        world.hitSeq = 0;
    }

    const hp = (1 + HP_GROWTH_PER_SEC * e) * BOSS_HP_MULT;
    const randomSkin = 1 + Math.floor(Math.random() * Math.max(1, BLOCK_SKINS));

    world.blocks.push({
        id: ++world.hitSeq,
        x,
        y: ySpawn,
        w: BOSS_SIZE,
        h: BOSS_SIZE,
        hp,
        maxHp: hp,
        isBoss: true,
        skin: randomSkin,
    });

    world.bossSpawnCount += 1;
    world.normalSpawnPausedUntil = ts + POST_BOSS_FREEZE * 1000;
    world.bossPreFreezeUntil = 0;
};

// ── 보스 드랍: 2그룹(일반 1개 + 특수 1개)
export const dropForBlock = (bl) => {
    if (bl.isBoss !== true) {
        return;
    }

    const pick = (arr) => {
        if (!arr || arr.length === 0) {
            return null;
        }
        return arr[Math.floor(Math.random() * arr.length)];
    };

    // 드랍 위치: 보스 상단 기준, 위로 쌓기
    const cxBase = bl.x + bl.w / 2; // 센터 X. 기존 "-8" 제거
    const stepY = 24;

    let base = bl.y - 8; // 상단 앵커 유지
    if (base - stepY < 6) {
        base = 6 + stepY;
    }

    const yGroup1 = base; // 1번 그룹(Y 센터)
    const yGroup2 = base - stepY; // 2번 그룹(Y 센터)

    // 그룹1: MAX_BALL / DMG_UP / HP_UP 중 1개
    const g1 = ['MAX_BALL', 'DMG_UP', 'HP_UP'];
    const k1 = pick(g1);

    // 그룹2: 특수볼 중 1개
    const g2 = [
        'SB_POWER',
        'SB_FLAME',
        'SB_PIERCE',
        'SB_EXPLO',
        'SB_SPLIT',
        'SB_ICE',
        'SB_VOID',
        'SB_LASER',
        'SB_BLEED',
    ];
    const k2 = pick(g2);

    // 가로 랜덤은 "센터 X" 기준
    const randCenterX = () => {
        return cxBase + (Math.random() * 20 - 10);
    };

    if (k1) {
        pushItemCenter(randCenterX(), yGroup1, k1);
    }

    if (k2) {
        pushItemCenter(randCenterX(), yGroup2, k2);
    }
};
