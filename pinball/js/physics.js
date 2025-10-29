import { AIM_SPREAD_DEG, CELL, COLS, FALL_BASE, FALL_GAIN_PER_SEC, H, LEFT_PAD, MIN_V_GAP, W } from './config.js';
import { key, player, ui, world } from './state.js';
import { addDamageStat } from './stats.js';
import { clamp } from './utils.js';

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

const addDmgFx = (x, y, val, color) => {
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
        color: color || '#ef233c',
        start: now,
        end: now + 500,
    });
};

// DOT
export const applyBlockDOT = (ts) => {
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        if (bl.dotUntil == null) {
            continue;
        }
        if (bl.dotLastTs == null) {
            bl.dotLastTs = ts;
        }

        const until = bl.dotUntil;
        const t0 = bl.dotLastTs;
        const t1 = ts > until ? until : ts;

        let dtSec = (t1 - t0) / 1000;
        if (dtSec < 0) {
            dtSec = 0;
        }

        const dealt = (bl.dotDps || 0) * dtSec;
        if (dealt > 0) {
            const pre = bl.hp;
            let applied = dealt;
            if (applied > pre) {
                applied = pre;
            }
            bl.hp = Math.max(0, pre - applied);

            const cx = bl.x + bl.w / 2;
            const cy = bl.y + bl.h / 2;
            addDmgFx(cx, cy, applied, '#ef233c');

            // 프레임: 지속데미지 모두 산정
            addDamageStat('FLAME', applied);
        }
        bl.dotLastTs = ts;

        if (ts >= until) {
            bl.dotUntil = null;
            bl.dotDps = 0;
            bl.dotLastTs = null;
        }
    }

    for (let i = world.blocks.length - 1; i >= 0; i--) {
        if (world.blocks[i].hp <= 0) {
            world.blocks.splice(i, 1);
            world.score += 10;
        }
    }
};
