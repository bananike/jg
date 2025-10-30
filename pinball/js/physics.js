import { colorOfKind } from './colors.js';
import { AIM_SPREAD_DEG, CELL, COLS, FALL_BASE, FALL_GAIN_PER_SEC, H, LEFT_PAD, MIN_V_GAP, W } from './config.js';
import { key, player, ui, world } from './state.js';
import { addDamageStat } from './stats.js';
import { clamp } from './utils.js';

// 플레임 현재 데미지 계산: base 1.0, 증가치 0.5, 레벨은 (ballDmgBase - 0.5)/0.25
const flameLevel = () => {
    const lvl = Math.round((world.ballDmgBase - 0.5) / 0.25);
    if (lvl < 0) {
        return 0;
    }
    return lvl;
};

const flameTickDamage = () => {
    return 1.0 + 0.5 * flameLevel();
};

export const updatePlayer = () => {
    if (world.gameOver === true) {
        return;
    }
    if (key.left === true) {
        player.x -= player.speed;
    }
    if (key.right === true) {
        player.x += player.speed;
    }
    player.x = clamp(player.x, player.w / 2 + 6, W - player.w / 2 - 6);

    if (key.up === true) {
        world.aim -= 0.03;
    }
    if (key.down === true) {
        world.aim += 0.03;
    }

    const spread = (Math.PI / 180) * AIM_SPREAD_DEG; // ±80°
    const mn = -Math.PI / 2 - spread;
    const mx = -Math.PI / 2 + spread;
    world.aim = clamp(world.aim, mn, mx);
};

export const updateBlocks = (ts) => {
    const e = world.ts0 === 0 ? 0 : (ts - world.ts0) / 1000;
    const vBase = FALL_BASE + e * FALL_GAIN_PER_SEC;

    // 1) 블록별 이동(ICE 감속 반영)
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];

        let mul = 1;
        if (bl.slowUntil && ts < bl.slowUntil) {
            if (typeof bl.slowMul === 'number') {
                mul = bl.slowMul;
            } else {
                mul = 0.35;
            }
        } else {
            if (bl.slowUntil && ts >= bl.slowUntil) {
                bl.slowUntil = null;
                bl.slowMul = null;
            }
        }

        bl.y += vBase * mul;
    }

    // 2) 컬럼별 겹침 정렬(아래→위)
    const cols = Array.from({ length: COLS }, () => []);
    for (let i = 0; i < world.blocks.length; i++) {
        const bl = world.blocks[i];
        const c = Math.max(0, Math.min(COLS - 1, Math.floor((bl.x - LEFT_PAD) / CELL)));
        cols[c].push(bl);
    }

    for (let c = 0; c < COLS; c++) {
        const arr = cols[c];
        if (arr.length <= 1) {
            continue;
        }
        arr.sort((a, b) => b.y - a.y); // 아래쪽부터

        let aboveLimit = Infinity;
        for (let k = 0; k < arr.length; k++) {
            const blk = arr[k];
            if (k === 0) {
                aboveLimit = blk.y - MIN_V_GAP;
            } else {
                const maxY = aboveLimit - blk.h;
                if (blk.y > maxY) {
                    blk.y = maxY;
                }
                if (blk.y < 0) {
                    blk.y = 0;
                }
                aboveLimit = blk.y - MIN_V_GAP;
            }
        }
    }

    // 3) 바닥 체크
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        if (world.blocks[i].y + world.blocks[i].h >= H - 20) {
            world.blocks.splice(i, 1);
            world.hp -= 1;
            ui.setHp(world.hp);
            if (world.hp <= 0) {
                world.gameOver = true;
            }
        }
    }
};

const addDmgFx = (x, y, val, color, sizePx) => {
    if (!world.fx) {
        world.fx = [];
    }
    const now = world.lastTs || performance.now();
    const text = typeof val === 'number' ? val.toFixed(2) : String(val);

    world.fx.push({
        type: 'DMG',
        x,
        y,
        val: text,
        color: color || '#ffffff',
        start: now,
        end: now + 520,
        sizePx: typeof sizePx === 'number' ? sizePx : 24, // 기본 24px(특수볼 표기 크기)
        isBold: true,
    });
};

// DOT
export const applyBlockDOT = (ts) => {
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];

        // 플레임 지속 아님
        if (bl.flameUntil == null) {
            continue;
        }

        // 지속 종료
        if (ts >= bl.flameUntil) {
            bl.flameUntil = null;
            bl.flameNextTick = null;
            continue;
        }

        // 다음 틱 예약이 없다면 예약
        if (bl.flameNextTick == null) {
            bl.flameNextTick = ts + 1000;
        }

        // 틱 도래
        if (ts >= bl.flameNextTick) {
            const dmg = flameTickDamage(); // “현재” 증가 수치 반영
            const pre = bl.hp;
            let applied = dmg;
            if (applied > pre) {
                applied = pre;
            }
            bl.hp = Math.max(0, pre - applied);

            const cx = bl.x + bl.w / 2;
            const cy = bl.y - 6;
            addDmgFx(cx, cy, applied, colorOfKind('FLAME'), 24);
            addDamageStat('FLAME', applied);

            bl.flameNextTick += 1000; // 다음 1초 후
        }
    }

    // 사망 처리
    // for (let i = world.blocks.length - 1; i >= 0; i--) {
    //     if (world.blocks[i].hp <= 0) {
    //         world.blocks.splice(i, 1);
    //         world.score += 10;
    //     }
    // }
};
