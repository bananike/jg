// balls.js
import { BALL_R, BALL_SPEED, FIRE_INTERVAL_MS, H, W } from './config.js';
import { player, SB_KIND, ui, world } from './state.js';

// 특수볼 push
const pushSBBall = (vx, vy, r, dmg, meta, kind) => {
    const x = player.x;
    const y = player.y - player.h / 2 - r - 2;

    world.sbBalls.push({
        x,
        y,
        px: x,
        py: y,
        vx,
        vy,
        r,
        dmg,
        kind,
        hitCD: {},
        meta: meta || {},
    });
};

// 특수볼 소멸 공통 처리
export const onSpecialBallRemoved = (kind) => {
    const slot = world.useSB && world.useSB[kind];
    if (slot) {
        slot.active -= 1;
        if (slot.active < 0) {
            slot.active = 0;
        }
        ui.setSBStock();
    }
};

// 일반볼 자동 발사
export const tryAutoFire = (ts) => {
    if (world.gameOver === true) {
        return;
    }
    if (world.balls.length >= world.maxBalls) {
        return;
    }
    if (ts - world.lastFire < FIRE_INTERVAL_MS) {
        return;
    }

    world.lastFire = ts;
    const vx = Math.cos(world.aim) * BALL_SPEED;
    const vy = Math.sin(world.aim) * BALL_SPEED;

    const x = player.x;
    const y = player.y - player.h / 2 - BALL_R - 2;

    world.balls.push({
        x,
        y,
        px: x,
        py: y,
        vx,
        vy,
        r: BALL_R,
        dmg: world.ballDmgBase,
        hitCD: {},
    });
};

// 특수볼 자동 발사(보유 중인 종류별 슬롯 한도 내)
export const tryFireSpecial = (ts) => {
    if (!world.useSB) {
        return;
    }

    const order = [
        SB_KIND.POWER,
        SB_KIND.FLAME,
        SB_KIND.PIERCE,
        SB_KIND.EXPLO,
        SB_KIND.SPLIT,
        SB_KIND.ICE,
        SB_KIND.VOID,
        SB_KIND.LASER,
        SB_KIND.BLEED,
    ];

    for (let i = 0; i < order.length; i++) {
        const k = order[i];
        const slot = world.useSB[k];

        if (!slot) {
            continue;
        }
        if (slot.count <= 0) {
            continue;
        }
        if (slot.active >= slot.max) {
            continue;
        }
        if (ts < slot.nextFire) {
            continue;
        }

        slot.nextFire = ts + slot.fireInterval;

        const baseSpeed = BALL_SPEED;
        const ang = world.aim;

        if (k === SB_KIND.POWER) {
            const sp = baseSpeed * 0.8;
            pushSBBall(Math.cos(ang) * sp, Math.sin(ang) * sp, 8, world.ballDmgBase * 4.0, { color: '#ff9e00' }, k);
        } else {
            if (k === SB_KIND.FLAME) {
                const sp = baseSpeed;
                pushSBBall(
                    Math.cos(ang) * sp,
                    Math.sin(ang) * sp,
                    8,
                    world.ballDmgBase,
                    { flame: true, color: '#ef233c' },
                    k,
                );
            } else {
                if (k === SB_KIND.PIERCE) {
                    const sp = baseSpeed * 2.0;
                    pushSBBall(
                        Math.cos(ang) * sp,
                        Math.sin(ang) * sp,
                        7,
                        world.ballDmgBase,
                        { pierce: true, color: '#06d6a0' },
                        k,
                    );
                } else {
                    if (k === SB_KIND.EXPLO) {
                        const sp = baseSpeed * 0.95;
                        pushSBBall(
                            Math.cos(ang) * sp,
                            Math.sin(ang) * sp,
                            9,
                            world.ballDmgBase,
                            { exploRadius: 100, color: '#8338ec' },
                            k,
                        );
                    } else {
                        if (k === SB_KIND.SPLIT) {
                            const sp = baseSpeed;
                            pushSBBall(
                                Math.cos(ang) * sp,
                                Math.sin(ang) * sp,
                                7,
                                world.ballDmgBase,
                                { splitOnce: true, color: '#3a86ff' },
                                k,
                            );
                        } else {
                            if (k === SB_KIND.ICE) {
                                const sp = baseSpeed;
                                pushSBBall(
                                    Math.cos(ang) * sp,
                                    Math.sin(ang) * sp,
                                    8,
                                    world.ballDmgBase,
                                    { ice: true, color: '#00bcd4' },
                                    k,
                                );
                            } else {
                                if (k === SB_KIND.VOID) {
                                    const sp = baseSpeed * 0.9;
                                    pushSBBall(
                                        Math.cos(ang) * sp,
                                        Math.sin(ang) * sp,
                                        8,
                                        world.ballDmgBase,
                                        { void: true, color: '#8d99ae' },
                                        k,
                                    );
                                } else {
                                    if (k === SB_KIND.LASER) {
                                        const sp = baseSpeed;
                                        pushSBBall(
                                            Math.cos(ang) * sp,
                                            Math.sin(ang) * sp,
                                            8,
                                            world.ballDmgBase,
                                            { laser: true, color: '#ffd166' },
                                            k,
                                        );
                                    } else {
                                        if (k === SB_KIND.BLEED) {
                                            const sp = baseSpeed;
                                            pushSBBall(
                                                Math.cos(ang) * sp,
                                                Math.sin(ang) * sp,
                                                8,
                                                world.ballDmgBase,
                                                { bleed: true, color: '#d00000' },
                                                k,
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 소모 없이 순환 발사. 활성 수만 관리.
        slot.active += 1;
        ui.setSBStock();
        return;
    }
};

// 포지션 업데이트
export const updateBalls = () => {
    // 일반볼
    for (let i = world.balls.length - 1; i >= 0; i--) {
        const b = world.balls[i];

        // 이전 위치 저장
        b.px = b.x;
        b.py = b.y;

        b.x += b.vx;
        b.y += b.vy;

        if (b.x - b.r < 0) {
            b.x = b.r;
            b.vx = Math.abs(b.vx);
        } else {
            if (b.x + b.r > W) {
                b.x = W - b.r;
                b.vx = -Math.abs(b.vx);
            }
        }
        if (b.y - b.r < 0) {
            b.y = b.r;
            b.vy = Math.abs(b.vy);
        }

        if (b.y + b.r > H) {
            world.balls.splice(i, 1);
            continue;
        }

        const withinX = b.x > player.x - player.w / 2 && b.x < player.x + player.w / 2;
        const withinY = b.y + b.r > player.y - player.h / 2 && b.y - b.r < player.y + player.h / 2;
        if (withinX === true && withinY === true) {
            world.balls.splice(i, 1);
            continue;
        }
    }

    // 특수볼
    for (let i = world.sbBalls.length - 1; i >= 0; i--) {
        const b = world.sbBalls[i];

        // 이전 위치 저장
        b.px = b.x;
        b.py = b.y;

        b.x += b.vx;
        b.y += b.vy;

        if (b.x - b.r < 0) {
            b.x = b.r;
            b.vx = Math.abs(b.vx);
        } else {
            if (b.x + b.r > W) {
                b.x = W - b.r;
                b.vx = -Math.abs(b.vx);
            }
        }
        if (b.y - b.r < 0) {
            b.y = b.r;
            b.vy = Math.abs(b.vy);
        }

        const hitPlayer =
            b.x > player.x - player.w / 2 &&
            b.x < player.x + player.w / 2 &&
            b.y + b.r > player.y - player.h / 2 &&
            b.y - b.r < player.y + player.h / 2;

        if (b.y + b.r > H || hitPlayer === true) {
            onSpecialBallRemoved(b.kind);
            world.sbBalls.splice(i, 1);
            continue;
        }
    }
};
