// stats.js
import { world } from './state.js';

const BASE_KEYS = ['NORMAL', 'POWER', 'FLAME', 'PIERCE', 'EXPLO', 'SPLIT', 'ICE', 'VOID', 'LASER', 'BLEED', 'DOT'];

export const initStats = () => {
    world.stats = { byKind: Object.create(null), total: 0 };
    for (let i = 0; i < BASE_KEYS.length; i++) {
        const k = BASE_KEYS[i];
        world.stats.byKind[k] = 0;
    }
};

export const resetStats = () => {
    initStats();
};

export const addDamageStat = (kind, val) => {
    if (!world.stats) {
        initStats();
    }
    if (typeof val !== 'number' || !isFinite(val)) {
        return;
    }
    const k = kind || 'NORMAL';
    if (world.stats.byKind[k] == null) {
        world.stats.byKind[k] = 0;
    }
    world.stats.byKind[k] += val;
    world.stats.total += val;
};

export const getDamageStatsSnapshot = () => {
    if (!world.stats) {
        initStats();
    }
    const rows = [];
    const by = world.stats.byKind;
    for (const k in by) {
        const v = Number(by[k] || 0);
        if (v > 0) {
            rows.push({ kind: k, dmg: v });
        }
    }
    rows.sort((a, b) => {
        return b.dmg - a.dmg;
    });
    return { rows, total: Number(world.stats.total || 0) };
};
