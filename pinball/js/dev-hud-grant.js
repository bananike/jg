// dev-hud-grant.js
import { SB_KIND, ui, world } from './state.js';

const toSB = (s) => {
    if (s === 'POWER') {
        return SB_KIND.POWER;
    }
    if (s === 'FLAME') {
        return SB_KIND.FLAME;
    }
    if (s === 'PIERCE') {
        return SB_KIND.PIERCE;
    }
    if (s === 'EXPLO') {
        return SB_KIND.EXPLO;
    }
    if (s === 'SPLIT') {
        return SB_KIND.SPLIT;
    }
    if (s === 'ICE') {
        return SB_KIND.ICE;
    }
    if (s === 'VOID') {
        return SB_KIND.VOID;
    }
    if (s === 'LASER') {
        return SB_KIND.LASER;
    }
    if (s === 'BLEED') {
        return SB_KIND.BLEED;
    }
    return null;
};

export const grantSB = (kind, amount) => {
    if (!world.useSB || !world.useSB[kind]) {
        return;
    }
    if (typeof amount !== 'number') {
        amount = 1;
    }

    const slot = world.useSB[kind];
    slot.count += amount;
    slot.max += amount; // 아이템 획득과 동일하게 활성 한도도 증가
    ui.setSBStock();
};

export const bindHudGrantForTest = () => {
    const root = document.querySelector('#hud-sb');
    if (!root) {
        return;
    }

    root.addEventListener('click', (ev) => {
        const el = ev.target.closest('[data-sb]');
        if (!el) {
            return;
        }

        const key = el.getAttribute('data-sb');
        const kind = toSB(key);
        if (kind === null) {
            return;
        }

        const amount = ev.shiftKey === true ? 5 : 1; // Shift 클릭이면 +5
        grantSB(kind, amount);
    });
};
