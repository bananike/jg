import { SB_KIND } from './constants.js';
import { world } from './state.js';

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
        const spawn = Math.random() < 0.78;
        if (spawn !== true) {
            continue;
        }
        const x = leftPad + c * cfg.cell + cfg.blockGap / 2;
        const needClear = cfg.blockSize + cfg.minBlockGap;
        if (hasVerticalClearance(x, cfg.blockSize, ySpawn, needClear) !== true) {
            continue;
        }
        const hpAtSpawn = 1 + cfg.hpGrowthPerSec * elapsedSec;
        world.blocks.push({
            id: (world._nextId = (world._nextId || 1) + 1),
            x,
            y: ySpawn,
            w: cfg.blockSize,
            h: cfg.blockSize,
            hp: hpAtSpawn,
            isBoss: false,
        });
    }
};

export const maybeSpawnBoss = (ts) => {
    const elapsedSec = nowElapsedSec(ts);
    if (elapsedSec < cfg.bossFirstDelaySec) {
        return;
    }
    const hasAliveBoss = world.blocks.some((b) => b.isBoss === true);
    if (hasAliveBoss === true) {
        return;
    }
    if (world.lastBossAt > 0) {
        const needMs = cfg.bossIntervalSec * 1000;
        if (ts - world.lastBossAt < needMs) {
            return;
        }
    }
    if (world.bossPreFreezeUntil === 0) {
        world.bossPreFreezeUntil = ts + cfg.preBossFreezeSec * 1000;
        world.normalSpawnPausedUntil = world.bossPreFreezeUntil;
        return;
    }
    if (ts < world.bossPreFreezeUntil) {
        return;
    }

    const bossW = cfg.blockSize * cfg.bossSizeMul;
    const ySpawn = 24;
    const xMin = leftPad;
    const xMax = 460 - rightPad - bossW;
    let placed = false;
    let x = xMin + Math.floor(Math.random() * Math.max(1, xMax - xMin + 1));
    const need1 = bossW + cfg.minBlockGap;

    for (let t = 0; t < 12; t++) {
        if (hasVerticalClearance(x, bossW, ySpawn, need1) === true) {
            placed = true;
            break;
        }
        x = xMin + Math.floor(Math.random() * Math.max(1, xMax - xMin + 1));
    }
    if (placed !== true) {
        const need2 = bossW + Math.max(2, Math.floor(cfg.minBlockGap / 2));
        for (let t = 0; t < 16; t++) {
            x = xMin + Math.floor(Math.random() * Math.max(1, xMax - xMin + 1));
            if (hasVerticalClearance(x, bossW, ySpawn, need2) === true) {
                placed = true;
                break;
            }
        }
    }
    if (placed !== true) {
        x = Math.floor((460 - bossW) / 2);
    }

    const hpAtSpawn = (1 + cfg.hpGrowthPerSec * elapsedSec) * cfg.bossHpMul;
    world.blocks.push({
        id: (world._nextId = (world._nextId || 1) + 1),
        x,
        y: ySpawn,
        w: bossW,
        h: bossW,
        hp: hpAtSpawn,
        isBoss: true,
    });

    world.bossSpawnCount += 1;
    world.lastBossAt = ts;
    world.normalSpawnPausedUntil = ts + cfg.postBossFreezeSec * 1000;
    world.bossPreFreezeUntil = 0;
};

// 보스에게서만 드랍
export const dropForBlock = (bl) => {
    if (bl.isBoss !== true) {
        return;
    }
    const kinds = ['HP_UP', SB_KIND.POWER, SB_KIND.FLAME, SB_KIND.PIERCE, SB_KIND.EXPLO, SB_KIND.SPLIT];
    for (let r = 0; r < world.bossDropRolls; r++) {
        if (Math.random() < world.dropChanceBoss) {
            const k = kinds[Math.floor(Math.random() * kinds.length)];
            world.items.push({
                x: bl.x + bl.w / 2 - 8 + (Math.random() * 20 - 10),
                y: bl.y + bl.h / 2 - 8,
                w: 16,
                h: 16,
                kind: k,
            });
        }
    }
};
