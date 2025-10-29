// assets-effects.js
let BASE = './assets/';
const ALT_BASE = './assets/';

const _cache = {};

// 베이스 경로 바꾸고 싶을 때 사용(옵션)
export const setEffectsBase = (base) => {
    if (typeof base === 'string') {
        if (base.endsWith('/') !== true) {
            BASE = base + '/';
        } else {
            BASE = base;
        }
    }
};

const _loadOne = (name) => {
    if (_cache[name]) {
        return _cache[name];
    }

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
            img.src = `${ALT_BASE}effect-${name.toLowerCase()}.svg`;
        } else {
            img._error = true;
        }
    };

    img.src = `${BASE}effect-${name.toLowerCase()}.svg`;
    _cache[name] = img;
    return img;
};

export const preloadEffects = () => {
    const kinds = ['FLAME', 'ICE', 'BLEED'];
    for (let i = 0; i < kinds.length; i++) {
        _loadOne(kinds[i]);
    }
};

export const getEffectSprite = (kind) => {
    if (!kind) {
        return null;
    }
    return _loadOne(kind);
};

export const isEffectReady = (kind) => {
    const img = _cache[kind];
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
