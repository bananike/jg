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

// 보스 영역 확보: 겹치는 일반 블록 제거
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

    // 필요 소환 횟수 계산
    const needCount = Math.floor((e - BOSS_FIRST_DELAY) / BOSS_INTERVAL) + 1;
    if (world.bossSpawnCount >= needCount) {
        return;
    }

    // 보스 전 일반 스폰 동결 창 설정
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

    // 겹침 정리 후 배치
    clearAreaForBoss(x, ySpawn, BOSS_SIZE, BOSS_SIZE, 6);

    // id 시퀀스 보정
    if (typeof world.hitSeq !== 'number') {
        world.hitSeq = 0;
    }

    const hp = (1 + HP_GROWTH_PER_SEC * e) * BOSS_HP_MULT;
    world.blocks.push({
        id: ++world.hitSeq,
        x,
        y: ySpawn,
        w: BOSS_SIZE,
        h: BOSS_SIZE,
        hp,
        isBoss: true,
    });

    world.bossSpawnCount += 1;
    world.normalSpawnPausedUntil = ts + POST_BOSS_FREEZE * 1000;
    world.bossPreFreezeUntil = 0;
};

export const dropBossRewards = (bl) => {
    const cx = bl.x + bl.w / 2;
    const cy = bl.y + bl.h / 2;

    // 1) 볼 최대치 +1
    pushItem(cx - 8 - 14, cy - 8, ITEM.MAX_BALL);

    // 2) 볼 데미지 +0.05
    pushItem(cx - 8, cy - 8, ITEM.DMG_UP);

    // 3) 특수볼 1종 랜덤
    const sbPool = [ITEM.SB_POWER, ITEM.SB_FLAME, ITEM.SB_PIERCE, ITEM.SB_EXPLO, ITEM.SB_SPLIT];
    const sbKind = sbPool[Math.floor(Math.random() * sbPool.length)];
    pushItem(cx - 8 + 14, cy - 8, sbKind);
};
