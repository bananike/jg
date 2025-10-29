// game.js
import { tryAutoFire, tryFireSpecial, updateBalls } from './balls.js';
import { dropBossRewards } from './boss.js';
import { updateItems } from './items.js';
import { applyBlockDOT, updateBlocks, updatePlayer } from './physics.js';
import { maybeSpawnBoss, spawnNormals } from './spawn.js';
import { key, ui, world } from './state.js';

// FX 생성기
const addExplosionFx = (x, y, rMax = 60, durMs = 220) => {
    if (!world.fx) {
        world.fx = [];
    }
    const now = world.lastTs || performance.now();
    world.fx.push({ type: 'EXPLO', x, y, rMax, start: now, end: now + durMs });
};

// 충돌 처리(일반볼 + 특수볼)
// game.js
const collideBallsAndBlocks = (ts) => {
    // ── 여기: 공통 히트 처리
    const handleHit = (b, bl, isSpecial) => {
        const penL = b.x + b.r - bl.x;
        const penR = bl.x + bl.w - (b.x - b.r);
        const penT = b.y + b.r - bl.y;
        const penB = bl.y + bl.h - (b.y - b.r);
        const minPen = Math.min(penL, penR, penT, penB);

        if (!isSpecial || (isSpecial && !b.meta.pierce)) {
            if (minPen === penL) {
                b.x -= penL;
                b.vx = -Math.abs(b.vx);
            } else {
                if (minPen === penR) {
                    b.x += penR;
                    b.vx = Math.abs(b.vx);
                } else {
                    if (minPen === penT) {
                        b.y -= penT;
                        b.vy = -Math.abs(b.vy);
                    } else {
                        b.y += penB;
                        b.vy = Math.abs(b.vy);
                    }
                }
            }
        }

        bl.hp -= b.dmg;

        if (ts != null) {
            bl.flashUntil = ts + 120;
        }

        if (isSpecial === true) {
            if (b.kind === 'FLAME') {
                if (bl.dotUntil == null || ts >= bl.dotUntil) {
                    bl.dotDps = 1.0 * (b.dmg / 1.0);
                    bl.dotUntil = ts + 3000;
                    bl.dotLastTs = ts;
                } else {
                    bl.dotDps = 1.0 * (b.dmg / 1.0);
                    bl.dotLastTs = ts;
                }
            } else {
                if (b.kind === 'EXPLO') {
                    const r = b.meta && b.meta.exploRadius ? b.meta.exploRadius : 60;
                    const r2 = r * r;
                    addExplosionFx(b.x, b.y, r, 220);
                    for (let k = 0; k < world.blocks.length; k++) {
                        const o = world.blocks[k];
                        if (o === bl) {
                            continue;
                        }
                        const cx = o.x + o.w / 2;
                        const cy = o.y + o.h / 2;
                        const dx = cx - b.x;
                        const dy = cy - b.y;
                        if (dx * dx + dy * dy <= r2) {
                            o.hp -= b.dmg * 0.5;
                            if (o.hp < 0) {
                                o.hp = 0;
                            }
                        }
                    }
                } else {
                    if (b.kind === 'SPLIT') {
                        const ang = Math.atan2(b.vy, b.vx);
                        const spd = Math.hypot(b.vx, b.vy);
                        const a1 = ang - 0.25;
                        const a2 = ang + 0.25;
                        world.balls.push({
                            x: b.x,
                            y: b.y,
                            vx: Math.cos(a1) * spd,
                            vy: Math.sin(a1) * spd,
                            r: 6,
                            dmg: world.ballDmgBase,
                            hitCD: {},
                        });
                        world.balls.push({
                            x: b.x,
                            y: b.y,
                            vx: Math.cos(a2) * spd,
                            vy: Math.sin(a2) * spd,
                            r: 6,
                            dmg: world.ballDmgBase,
                            hitCD: {},
                        });
                        b._consume = true;
                    }
                }
            }
        }

        if (bl.hp < 0) {
            bl.hp = 0;
        }

        b.hitCD[bl.id] = ts + 80;
    };

    // ── 일반볼 충돌
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        for (let j = world.balls.length - 1; j >= 0; j--) {
            const b = world.balls[j];
            if (b.hitCD[bl.id] && b.hitCD[bl.id] > ts) {
                continue;
            }
            const within = b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w && b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h;
            if (!within) {
                continue;
            }
            handleHit(b, bl, false);
            break;
        }
    }

    // ── 특수볼 충돌
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        for (let j = world.sbBalls.length - 1; j >= 0; j--) {
            const b = world.sbBalls[j];
            if (b.hitCD[bl.id] && b.hitCD[bl.id] > ts) {
                continue;
            }
            const within = b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w && b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h;
            if (!within) {
                continue;
            }
            handleHit(b, bl, true);
            if (b._consume === true) {
                const slot = world.useSB && world.useSB[b.kind];
                if (slot) {
                    slot.active = Math.max(0, slot.active - 1);
                }
                world.sbBalls.splice(j, 1);
            }
            break;
        }
    }

    // ── HP<=0 제거 및 보상
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        if (bl.hp <= 0) {
            if (bl.isBoss === true) {
                dropBossRewards(bl);
                world.score += 50;
            } else {
                world.score += 10;
            }
            world.blocks.splice(i, 1);
        }
    }
};

export const step = (ts) => {
    if (world.ts0 === 0) {
        world.ts0 = ts;
    }
    if (world.lastTs === 0) {
        world.lastTs = ts;
    }
    world.lastTs = ts;

    if (world.gameOver !== true) {
        updatePlayer();
        if (key.auto === true) {
            tryAutoFire(ts);
        }
        tryFireSpecial(ts);
        updateBalls();
        updateBlocks(ts);
        applyBlockDOT(ts);
        collideBallsAndBlocks(ts);
        updateItems();
        spawnNormals(ts);
        maybeSpawnBoss(ts);
    }

    ui.setScore(world.score);
    ui.setHp(world.hp);
};
