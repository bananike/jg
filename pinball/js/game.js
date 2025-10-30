// game.js
import { tryAutoFire, tryFireSpecial, updateBalls } from './balls.js';
import { colorOfKind } from './colors.js';
import { BLOCK_SIZE } from './config.js';
import { updateItems } from './items.js';
import { applyBlockDOT, updateBlocks, updatePlayer } from './physics.js';
import { dropForBlock, maybeSpawnBoss, spawnNormals } from './spawn.js';
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
        // 보스 최대체력 보정
        if (bl && bl.isBoss === true) {
            if (typeof bl.maxHp !== 'number' || bl.maxHp <= 0) {
                bl.maxHp = bl.maxHp || bl.hp; // 첫 타격 직전 HP를 최대치로 메모
            }
        }

        // 반사 여부
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

        // 관통 아님: 분리 + 반사
        if (shouldReflect === true) {
            separateAndReflect(b, bl, true);
        }

        // === 데미지 계산 및 표시 ===

        // 기본 + 블리드 추가
        const preHp = bl.hp;

        let base = b.dmg;
        let bleedBonus = 0;
        if (bl.bleedStacks && bl.bleedUntil && tsNow < bl.bleedUntil) {
            const bleedBonusPerStack = 0.5; // 스택당 타격볼 데미지의 50%
            bleedBonus = b.dmg * bleedBonusPerStack * bl.bleedStacks;
        }

        // 실제 적용량(게임 로직)
        const baseApplied = Math.min(preHp, base);
        const remainAfterBase = preHp - baseApplied;
        const bleedApplied = Math.min(remainAfterBase, bleedBonus);
        const totalApplied = baseApplied + bleedApplied;

        // HP 반영
        bl.hp = Math.max(0, preHp - totalApplied);

        // 표기값 계산
        const intendedTotal = base + bleedBonus; // 클램프 없는 "볼 기준" 데미지
        const isLethal = intendedTotal >= preHp; // 막타 여부
        const shownVal = isLethal ? intendedTotal : totalApplied;
        const sizePx = isSpecial === true ? 48 : 24;

        if (tsNow != null) {
            bl.flashUntil = tsNow + 120;
        }

        addDamageFx(
            b.x,
            b.y - 6,
            shownVal.toFixed(2),
            colorOfKind(b.kind),
            520,
            sizePx,
            isSpecial === true ? true : false,
        );

        // 통계는 "실제 적용량" 기준 유지
        const kindForBase = b.kind ? b.kind : 'NORMAL';
        if (baseApplied > 0) {
            addDamageStat(kindForBase, baseApplied);
        }
        if (bleedApplied > 0) {
            addDamageStat('BLEED', bleedApplied);
        }

        // 특수 효과
        if (isSpecial === true) {
            if (b.kind === 'FLAME') {
                if (bl.flameUntil == null || tsNow >= bl.flameUntil) {
                    bl.flameUntil = tsNow + 5000; // 5초
                    bl.flameNextTick = tsNow + 1000; // 1초 후 첫 틱
                } else {
                    bl.flameUntil = tsNow + 5000; // 재적중 시 남은 시간을 5초로 연장
                    if (bl.flameNextTick == null) {
                        bl.flameNextTick = tsNow + 1000;
                    }
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
                            const shown = splash >= preO ? splash : applied;
                            addDamageFx(cx, cy - 6, shown.toFixed(2), colorOfKind('EXPLO'), 520, 48, true);
                            addDamageStat('EXPLO', applied);
                        }
                    }
                } else {
                    if (b.kind === 'SPLIT') {
                        // 자식은 더 분열 금지. 원본 1회 분열 후 재출사.
                        if (!(b.meta && b.meta.splitChild === true)) {
                            const ang = Math.atan2(b.vy, b.vx);
                            const spd = Math.hypot(b.vx, b.vy);
                            const spread = 0.25;
                            const childR = 5;
                            const childMeta = { splitChild: true, color: '#3a86ff' };
                            const dmgChild = world.ballDmgBase; // 부모와 동일 데미지

                            const spawnChild = (a) => {
                                world.sbBalls.push({
                                    x: b.x,
                                    y: b.y,
                                    vx: Math.cos(a) * spd,
                                    vy: Math.sin(a) * spd,
                                    r: childR,
                                    dmg: dmgChild,
                                    kind: 'SPLIT',
                                    hitCD: {},
                                    meta: childMeta,
                                });
                            };

                            spawnChild(ang);
                            spawnChild(ang - spread);
                            spawnChild(ang + spread);

                            b._consume = true;
                        }
                    } else {
                        if (b.kind === 'ICE') {
                            bl.slowMul = 0.35;
                            bl.slowUntil = tsNow + 2400;
                        } else {
                            if (b.kind === 'VOID') {
                                b._consume = true;

                                // 보스 퍼뎀: 기준은 maxHp 우선, 없으면 첫타 직전 HP
                                if (bl.isBoss === true) {
                                    if (typeof bl.maxHp !== 'number' || bl.maxHp <= 0) {
                                        bl.maxHp = preHp; // 보정
                                    }

                                    const basis = bl.maxHp;
                                    const percent = 0.1 * basis; // 10%
                                    const flat = 0.5 * b.dmg; // 타격볼 데미지의 50%
                                    const extraRaw = percent + flat;

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
                                    bl.hp = 0; // 일반 블록 즉사
                                }
                            } else {
                                if (b.kind === 'LASER') {
                                    const yLine = b.y;
                                    addLaserFx(yLine, 180);

                                    const bandH = BLOCK_SIZE;
                                    const halfH = bandH / 2;
                                    const yTop = yLine - halfH;
                                    const yBot = yLine + halfH;

                                    for (let k = 0; k < world.blocks.length; k++) {
                                        const o = world.blocks[k];
                                        if (o === bl) {
                                            continue;
                                        }
                                        // 레이저 두께 밴드와 블록의 세로 구간이 겹치면 히트
                                        const overlap = yBot >= o.y && yTop <= o.y + o.h;
                                        if (overlap !== true) {
                                            continue;
                                        }

                                        const preO = o.hp;
                                        if (preO <= 0) {
                                            continue;
                                        }
                                        const applied = Math.min(preO, b.dmg);
                                        o.hp = Math.max(0, preO - applied);

                                        addDamageFx(
                                            o.x + o.w / 2,
                                            Math.max(o.y, Math.min(yLine, o.y + o.h)) - 6,
                                            applied.toFixed(2),
                                            colorOfKind('LASER'),
                                            520,
                                            18,
                                            true,
                                        );
                                        addDamageStat('LASER', applied);
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

        // 타격 쿨다운
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

                // 기존 볼 제거
                world.sbBalls.splice(j, 1);

                // 스플릿 자식은 재출사 금지
                const isSplitChild = !!(b.meta && b.meta.splitChild === true);

                if ((kind === 'VOID' || kind === 'SPLIT') && isSplitChild !== true) {
                    // 원본만 즉시 재출사: 현재 에임 각도로 동일 속도 유지
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
                    // active 감소 금지
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
                dropForBlock(bl);
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
