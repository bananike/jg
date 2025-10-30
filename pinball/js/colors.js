// colors.js
export const SB_COLOR = {
    NORMAL: '#ffffff',
    POWER: '#aa00ff',
    FLAME: '#ff3d32',
    PIERCE: '#06d6a0',
    EXPLO: '#855e2e',
    SPLIT: '#ebea0b',
    ICE: '#00bcd4',
    VOID: '#8d99ae',
    LASER: '#0055ff',
    BLEED: '#701c1c',
};

const ITEM_COLOR = {
    MAX_BALL: '#ffd166',
    DMG_UP: '#4cc9f0',
    HP_UP: '#f72585',
};

export const colorOfKind = (kind, fallback) => {
    if (!kind) {
        return fallback ? fallback : SB_COLOR.NORMAL;
    }
    if (SB_COLOR[kind]) {
        return SB_COLOR[kind];
    }
    return fallback ? fallback : SB_COLOR.NORMAL;
};

export const colorOfItem = (kind) => {
    if (!kind) {
        return '#999999';
    }
    if (ITEM_COLOR[kind]) {
        return ITEM_COLOR[kind];
    }
    if (kind.startsWith('SB_') === true) {
        const k = kind.slice(3); // SB_POWER -> POWER
        if (SB_COLOR[k]) {
            return SB_COLOR[k];
        }
    }
    return '#999999';
};

export const colorOfPlayer = (hp) => {
    if (hp <= 0) {
        return '#6b7280';
    }
    if (hp === 1) {
        return '#f4a261';
    }
    if (hp === 2) {
        return '#9b5de5';
    }
    return '#3a86ff';
};
