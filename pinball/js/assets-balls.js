// assets-balls.js
let BASE = './assets/';
const ALT_BASE = './assets/';

const _cache = {};

export const setBallsBase = (base) => {
    if (typeof base === 'string') {
        if (base.endsWith('/') !== true) {
            BASE = base + '/';
        } else {
            BASE = base;
        }
    }
};

const fileStemOfKind = (kind) => {
    if (kind === 'POWER') {
        return 'ball-power';
    }
    if (kind === 'FLAME') {
        return 'ball-flame';
    }
    if (kind === 'PIERCE') {
        return 'ball-pierce';
    }
    if (kind === 'EXPLO') {
        return 'ball-explo';
    }
    if (kind === 'SPLIT') {
        return 'ball-split';
    }
    if (kind === 'ICE') {
        return 'ball-ice';
    }
    if (kind === 'VOID') {
        return 'ball-void';
    }
    if (kind === 'LASER') {
        return 'ball-laser';
    }
    if (kind === 'BLEED') {
        return 'ball-bleed';
    }
    return 'ball-generic';
};

const _loadOne = (kind) => {
    const key = kind || 'GENERIC';
    if (_cache[key]) {
        return _cache[key];
    }

    const stem = fileStemOfKind(kind);
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';

    img._ready = false;
    img._error = false;
    img._triedAlt = false;

    img.onload = () => {
        img._ready = true;
    };
    img.onerror = () => {
        if (img._triedAlt !== true) {
            img._triedAlt = true;
            img.src = `${ALT_BASE}${stem}.svg`;
        } else {
            img._error = true;
        }
    };

    img.src = `${BASE}${stem}.svg`;
    _cache[key] = img;
    return img;
};

export const preloadBallSprites = () => {
    const kinds = ['POWER', 'FLAME', 'PIERCE', 'EXPLO', 'SPLIT', 'ICE', 'VOID', 'LASER', 'BLEED'];
    for (let i = 0; i < kinds.length; i++) {
        _loadOne(kinds[i]);
    }
};

export const getBallSprite = (kind) => {
    return _loadOne(kind);
};

export const isBallReady = (kind) => {
    const img = _cache[kind] || null;
    if (!img) {
        return false;
    }
    if (img._error === true) {
        return false;
    }
    if (img.complete !== true) {
        return false;
    }
    if (!img.naturalWidth || !img.naturalHeight) {
        return false;
    }
    return true;
};
