// boss.js
import {
    BOSS_FIRST_DELAY,
    BOSS_HP_MULT,
    BOSS_INTERVAL,
    BOSS_SIZE,
    HP_GROWTH_PER_SEC,
    ITEM,
    LEFT_PAD,
    MIN_V_GAP,
    POST_BOSS_FREEZE,
    PRE_BOSS_FREEZE,
    RIGHT_PAD,
    W,
} from './config.js';
import { pushItem } from './items.js';
import { world } from './state.js';
import { aabbOverlap } from './utils.js';

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
    const randomSkin = 1 + Math.floor(Math.random() * 8); // 가용 스킨 수에 맞게 조정

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

export const dropBossRewards = (bl) => {
    // 가운데 세로 스택으로 드롭
    const cx = Math.floor(W / 2) - 8;
    const startY = bl.y + bl.h + 6;
    const stepY = 24;

    pushItem(cx, startY + stepY * 0, ITEM.MAX_BALL);
    pushItem(cx, startY + stepY * 1, ITEM.DMG_UP);

    const sbPool = [
        ITEM.SB_POWER,
        ITEM.SB_FLAME,
        ITEM.SB_PIERCE,
        ITEM.SB_EXPLO,
        ITEM.SB_SPLIT,
        ITEM.SB_ICE,
        ITEM.SB_VOID,
        ITEM.SB_LASER,
        ITEM.SB_BLEED,
    ];
    const sbKind = sbPool[Math.floor(Math.random() * sbPool.length)];
    pushItem(cx, startY + stepY * 2, sbKind);
};
