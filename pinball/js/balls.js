// balls.js
import { BALL_R, BALL_SPEED, FIRE_INTERVAL_MS, H, W } from './config.js';
import { player, SB_KIND, world } from './state.js';

// 특수볼 push
const pushSBBall = (vx, vy, r, dmg, meta, kind) => {
    world.sbBalls.push({
        x: player.x,
        y: player.y - player.h / 2 - r - 2,
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

    world.balls.push({
        x: player.x,
        y: player.y - player.h / 2 - BALL_R - 2,
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

    const order = [SB_KIND.POWER, SB_KIND.FLAME, SB_KIND.PIERCE, SB_KIND.EXPLO, SB_KIND.SPLIT];

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

        const baseSpeed = 4.2;
        const ang = world.aim;

        if (k === SB_KIND.POWER) {
            const sp = baseSpeed * 0.5;
            pushSBBall(Math.cos(ang) * sp, Math.sin(ang) * sp, 8, world.ballDmgBase * 2.0, {}, k);
        } else {
            if (k === SB_KIND.FLAME) {
                const sp = baseSpeed;
                pushSBBall(Math.cos(ang) * sp, Math.sin(ang) * sp, 8, world.ballDmgBase, { flame: true }, k);
            } else {
                if (k === SB_KIND.PIERCE) {
                    const sp = baseSpeed;
                    pushSBBall(Math.cos(ang) * sp, Math.sin(ang) * sp, 7, world.ballDmgBase, { pierce: true }, k);
                } else {
                    if (k === SB_KIND.EXPLO) {
                        const sp = baseSpeed * 0.9;
                        pushSBBall(
                            Math.cos(ang) * sp,
                            Math.sin(ang) * sp,
                            9,
                            world.ballDmgBase,
                            { exploRadius: 60 },
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
                                { splitOnce: true },
                                k,
                            );
                        }
                    }
                }
            }
        }

        slot.active += 1;
        return; // 한 틱에 한 발만
    }
};

// 포지션 업데이트
export const updateBalls = () => {
    // 일반볼
    for (let i = world.balls.length - 1; i >= 0; i--) {
        const b = world.balls[i];

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
