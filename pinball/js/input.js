// input.js
import { BALL_R } from './config.js';
import { dom, key, player, world } from './state.js';
import { clamp } from './utils.js';

const _updateAimFromPoint = (clientX, clientY) => {
    if (!dom || !dom.canvas) {
        return;
    }
    const rect = dom.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const mx = player.x;
    const my = player.y - player.h / 2 - BALL_R - 2; // 발사 위치와 동일

    const ang = Math.atan2(y - my, x - mx);

    const mn = typeof world.aimMin === 'number' ? world.aimMin : -Math.PI / 2 - Math.PI / 3;
    const mxA = typeof world.aimMax === 'number' ? world.aimMax : -Math.PI / 2 + Math.PI / 3;

    world.aim = clamp(ang, mn, mxA);
};

export const inputSetup = () => {
    // 키보드
    window.addEventListener('keydown', (e) => {
        if (e.key === 'z' || e.key === 'Z') {
            key.up = true;
        } else {
            if (e.key === 'x' || e.key === 'X') {
                key.down = true;
            } else {
                if (e.key === 'ArrowLeft') {
                    key.left = true;
                } else {
                    if (e.key === 'ArrowRight') {
                        key.right = true;
                    } else {
                        if (e.code === 'Space') {
                            key.auto = true;
                        }
                    }
                }
            }
        }
    });
    window.addEventListener('keyup', (e) => {
        if (e.key === 'z' || e.key === 'Z') {
            key.up = false;
        } else {
            if (e.key === 'x' || e.key === 'X') {
                key.down = false;
            } else {
                if (e.key === 'ArrowLeft') {
                    key.left = false;
                } else {
                    if (e.key === 'ArrowRight') {
                        key.right = false;
                    }
                }
            }
        }
    });

    // 모바일 터치 각도조절
    if (dom && dom.canvas) {
        dom.canvas.style.touchAction = 'none';

        let touching = false;

        const onPointerDown = (e) => {
            if (e.pointerType === 'touch') {
                world.isTouch = true; // 모바일 모드 플래그
            }
            touching = true;
            _updateAimFromPoint(e.clientX, e.clientY);
            e.preventDefault();
        };

        const onPointerMove = (e) => {
            if (touching === true) {
                _updateAimFromPoint(e.clientX, e.clientY);
                e.preventDefault();
            }
        };

        const onPointerUp = () => {
            touching = false;
        };

        dom.canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
        dom.canvas.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp, { passive: true });
        window.addEventListener('pointercancel', onPointerUp, { passive: true });
    }
};
