import { FALL_BASE, FALL_GAIN_PER_SEC, H, W } from './config.js';
import { key, player, ui, world } from './state.js';
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
    const mn = -Math.PI / 2 - Math.PI / 4;
    const mx = -Math.PI / 2 + Math.PI / 4;
    world.aim = clamp(world.aim, mn, mx);
};

export const updateBlocks = (ts) => {
    const e = world.ts0 === 0 ? 0 : (ts - world.ts0) / 1000;
    const v = FALL_BASE + e * FALL_GAIN_PER_SEC;

    for (let i = world.blocks.length - 1; i >= 0; i--) {
        world.blocks[i].y += v;
    }

    for (let i = world.blocks.length - 1; i >= 0; i--) {
        if (world.blocks[i].y + world.blocks[i].h >= H - 20) {
            world.blocks.splice(i, 1);
            world.hp -= 1;
            ui.setHp(world.hp); // 즉시 반영
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
    world.fx.push({ type: 'DMG', x, y, val: Math.round(val), color: color || '#ef233c', start: now, end: now + 500 });
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
            bl.hp -= dealt;
            if (bl.hp < 0) {
                bl.hp = 0;
            }
            addDmgFx(bl.x + bl.w / 2, bl.y + bl.h / 2, dealt, '#ef233c');
        }
        bl.dotLastTs = ts;

        if (ts >= until) {
            bl.dotUntil = null;
            bl.dotDps = 0;
            bl.dotLastTs = null;
        }
    }

    // DOT로 0 이하 정리(기존 로직 유지)
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        if (world.blocks[i].hp <= 0) {
            world.blocks.splice(i, 1);
            world.score += 10;
        }
    }
};
