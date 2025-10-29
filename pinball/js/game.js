// game.js
import { tryAutoFire, tryFireSpecial, updateBalls } from './balls.js';
import { dropBossRewards } from './boss.js';
import { colorOfKind } from './colors.js';
import { updateItems } from './items.js';
import { applyBlockDOT, updateBlocks, updatePlayer } from './physics.js';
import { maybeSpawnBoss, spawnNormals } from './spawn.js';
import { key, player, ui, world } from './state.js';
import { addDamageStat } from './stats.js';

// === FX 생성기 ===
const addExplosionFx = (x, y, rMax = 60, durMs = 220) => {
    if (!world.fx) {
        world.fx = [];
    }
    const now = world.lastTs || performance.now();
    world.fx.push({ type: 'EXPLO', x, y, rMax, start: now, end: now + durMs });
};

const addDamageFx = (x, y, val, color = '#ffffff', durMs = 520, sizePx = 12, isBold = false) => {
    if (!world.fx) {
        world.fx = [];
    }
    const now = world.lastTs || performance.now();
    world.fx.push({
        type: 'DMG',
        x,
        y,
        val,
        color,
        start: now,
        end: now + durMs,
        sizePx,
        isBold,
    });
};

const addLaserFx = (y, durMs = 160) => {
    if (!world.fx) {
        world.fx = [];
    }
    const now = world.lastTs || performance.now();
    world.fx.push({ type: 'LASER', y, start: now, end: now + durMs });
};

// === 충돌 분리 + 반사 유틸 ===
const separateAndReflect = (b, bl, bounce) => {
    const penL = Math.max(0, b.x + b.r - bl.x);
    const penR = Math.max(0, bl.x + bl.w - (b.x - b.r));
    const penT = Math.max(0, b.y + b.r - bl.y);
    const penB = Math.max(0, bl.y + bl.h - (b.y - b.r));

    let axis = 'x';
    let dir = -1;
    let pen = penL;

    if (penR < pen) {
        axis = 'x';
        dir = +1;
        pen = penR;
    }
    if (penT < pen) {
        axis = 'y';
        dir = -1;
        pen = penT;
    }
    if (penB < pen) {
        axis = 'y';
        dir = +1;
        pen = penB;
    }

    if (axis === 'x') {
        b.x += dir * pen;
        if (bounce === true) {
            if (dir < 0) {
                b.vx = -Math.abs(b.vx);
            } else {
                b.vx = Math.abs(b.vx);
            }
        }
    } else {
        b.y += dir * pen;
        if (bounce === true) {
            if (dir < 0) {
                b.vy = -Math.abs(b.vy);
            } else {
                b.vy = Math.abs(b.vy);
            }
        }
    }

    const still = b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w && b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h;

    if (still === true) {
        if (axis === 'x') {
            if (b.y < bl.y) {
                b.y = bl.y - b.r;
                if (bounce === true && b.vy > 0) {
                    b.vy = -Math.abs(b.vy);
                }
            } else {
                b.y = bl.y + bl.h + b.r;
                if (bounce === true && b.vy < 0) {
                    b.vy = Math.abs(b.vy);
                }
            }
        } else {
            if (b.x < bl.x) {
                b.x = bl.x - b.r;
                if (bounce === true && b.vx > 0) {
                    b.vx = -Math.abs(b.vx);
                }
            } else {
                b.x = bl.x + bl.w + b.r;
                if (bounce === true && b.vx < 0) {
                    b.vx = Math.abs(b.vx);
                }
            }
        }
    }
};

// === 충돌 처리(일반볼 + 특수볼) ===
const collideBallsAndBlocks = (ts) => {
    const handleHit = (b, bl, isSpecial, tsNow) => {
        let shouldReflect = true;
        if (isSpecial === true) {
            if (b.kind === 'VOID') {
                shouldReflect = false;
            } else {
                if (b.meta && b.meta.pierce === true) {
                    shouldReflect = false;
                }
            }
        }

        if (shouldReflect === true) {
            separateAndReflect(b, bl, true);
        }

        const preHp = bl.hp;

        let base = b.dmg;
        let bleedBonus = 0;

        if (bl.bleedStacks && bl.bleedUntil && tsNow < bl.bleedUntil) {
            const bleedBonusPerStack = 1.0;
            bleedBonus = b.dmg * bleedBonusPerStack * bl.bleedStacks;
        }

        const baseApplied = Math.min(preHp, base);
        const remainAfterBase = preHp - baseApplied;
        const bleedApplied = Math.min(remainAfterBase, bleedBonus);
        const totalApplied = baseApplied + bleedApplied;

        bl.hp = Math.max(0, preHp - totalApplied);

        if (tsNow != null) {
            bl.flashUntil = tsNow + 120;
        }

        addDamageFx(
            b.x,
            b.y - 6,
            totalApplied.toFixed(2),
            colorOfKind(b.kind),
            520,
            isSpecial === true ? 18 : 12,
            isSpecial === true ? true : false,
        );

        const kindForBase = b.kind ? b.kind : 'NORMAL';
        if (baseApplied > 0) {
            addDamageStat(kindForBase, baseApplied);
        }
        if (bleedApplied > 0) {
            addDamageStat('BLEED', bleedApplied);
        }

        if (isSpecial === true) {
            if (b.kind === 'FLAME') {
                if (bl.dotUntil == null || tsNow >= bl.dotUntil) {
                    bl.dotDps = 1.0 * (b.dmg / 1.0);
                    bl.dotUntil = tsNow + 3000;
                    bl.dotLastTs = tsNow;
                } else {
                    bl.dotDps = 1.0 * (b.dmg / 1.0);
                    bl.dotLastTs = tsNow;
                }
            } else {
                if (b.kind === 'EXPLO') {
                    const r = b.meta && b.meta.exploRadius ? b.meta.exploRadius : 100;
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
                            const preO = o.hp;
                            if (preO <= 0) {
                                continue;
                            }
                            const splash = b.dmg * 0.5;
                            const applied = Math.min(preO, splash);
                            o.hp = Math.max(0, preO - applied);

                            addDamageFx(cx, cy - 6, applied.toFixed(2), colorOfKind('EXPLO'), 520, 18, true);
                            addDamageStat('EXPLO', applied);
                        }
                    }
                } else {
                    if (b.kind === 'SPLIT') {
                        const ang = Math.atan2(b.vy, b.vx);
                        const spd = Math.hypot(b.vx, b.vy);
                        const a1 = ang;
                        const a2 = ang - 0.25;
                        const a3 = ang + 0.25;
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
                        world.balls.push({
                            x: b.x,
                            y: b.y,
                            vx: Math.cos(a3) * spd,
                            vy: Math.sin(a3) * spd,
                            r: 6,
                            dmg: world.ballDmgBase,
                            hitCD: {},
                        });
                        b._consume = true; // 재출사 트리거
                    } else {
                        if (b.kind === 'ICE') {
                            bl.slowMul = 0.35;
                            bl.slowUntil = tsNow + 2400;
                        } else {
                            if (b.kind === 'VOID') {
                                b._consume = true; // 첫 타격 후 소멸

                                if (bl.isBoss === true) {
                                    const basis = bl.maxHp || bl.hp;
                                    const extraRaw = basis * 0.1;
                                    const extraApplied = Math.min(bl.hp, extraRaw);
                                    bl.hp = Math.max(0, bl.hp - extraApplied);

                                    addDamageFx(
                                        bl.x + bl.w / 2,
                                        bl.y - 8,
                                        extraApplied.toFixed(2),
                                        colorOfKind('VOID'),
                                        520,
                                        18,
                                        true,
                                    );
                                    addDamageStat('VOID', extraApplied);
                                } else {
                                    const hpNow = bl.hp;
                                    if (hpNow > 0) {
                                        addDamageStat('VOID', hpNow);
                                    }
                                    bl.hp = 0;
                                }
                            } else {
                                if (b.kind === 'LASER') {
                                    const yLine = b.y;
                                    addLaserFx(yLine, 180);

                                    for (let k = 0; k < world.blocks.length; k++) {
                                        const o = world.blocks[k];
                                        if (o === bl) {
                                            continue;
                                        }
                                        if (yLine >= o.y && yLine <= o.y + o.h) {
                                            const preO = o.hp;
                                            if (preO <= 0) {
                                                continue;
                                            }
                                            const applied = Math.min(preO, b.dmg);
                                            o.hp = Math.max(0, preO - applied);

                                            addDamageFx(
                                                o.x + o.w / 2,
                                                yLine - 6,
                                                applied.toFixed(2),
                                                colorOfKind('LASER'),
                                                520,
                                                18,
                                                true,
                                            );
                                            addDamageStat('LASER', applied);
                                        }
                                    }
                                } else {
                                    if (b.kind === 'BLEED') {
                                        if (!bl.bleedStacks) {
                                            bl.bleedStacks = 0;
                                        }
                                        bl.bleedStacks += 1;
                                        bl.bleedUntil = tsNow + 4000;

                                        addDamageFx(
                                            bl.x + bl.w / 2,
                                            bl.y + bl.h + 10,
                                            `+${bl.bleedStacks}`,
                                            colorOfKind('BLEED'),
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        b.hitCD[bl.id] = tsNow + 80;
    };

    // 일반볼
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        for (let j = world.balls.length - 1; j >= 0; j--) {
            const b = world.balls[j];
            if (b.hitCD[bl.id] && b.hitCD[bl.id] > ts) {
                continue;
            }
            const within = b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w && b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h;
            if (within !== true) {
                continue;
            }
            handleHit(b, bl, false, ts);
            break;
        }
    }

    // 특수볼
    for (let i = world.blocks.length - 1; i >= 0; i--) {
        const bl = world.blocks[i];
        for (let j = world.sbBalls.length - 1; j >= 0; j--) {
            const b = world.sbBalls[j];
            if (b.hitCD[bl.id] && b.hitCD[bl.id] > ts) {
                continue;
            }
            const within = b.x + b.r > bl.x && b.x - b.r < bl.x + bl.w && b.y + b.r > bl.y && b.y - b.r < bl.y + bl.h;
            if (within !== true) {
                continue;
            }
            handleHit(b, bl, true, ts);

            if (b._consume === true) {
                const kind = b.kind;
                const r = b.r;
                const dmg = b.dmg;

                world.sbBalls.splice(j, 1);

                if (kind === 'VOID' || kind === 'SPLIT') {
                    const spd = Math.hypot(b.vx, b.vy);
                    const ang = world.aim;
                    world.sbBalls.push({
                        x: player.x,
                        y: player.y - player.h / 2 - r - 2,
                        vx: Math.cos(ang) * spd,
                        vy: Math.sin(ang) * spd,
                        r,
                        dmg,
                        kind,
                        hitCD: {},
                        meta: b.meta || {},
                    });
                } else {
                    const slot = world.useSB && world.useSB[kind];
                    if (slot) {
                        slot.active = Math.max(0, slot.active - 1);
                    }
                }
            }
            break;
        }
    }

    // HP<=0 제거 및 보상
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
