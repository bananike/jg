// assets-items.js
import { ASSET_BASE } from './config.js';

const BASE = (ASSET_BASE || './assets').replace(/\/+$/, '') + '/';
const _cache = {};

const NAME_MAP = {
    MAX_BALL: 'item-max_ball.svg',
    DMG_UP: 'item-dmg_up.svg',
    HP_UP: 'item-hp_up.svg',
};

const _urlFor = (kind) => {
    if (!NAME_MAP[kind]) {
        return null;
    }
    return BASE + NAME_MAP[kind];
};

const _loadOne = (kind) => {
    if (_cache[kind]) {
        return _cache[kind];
    }

    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';

    img._ready = false;
    img._error = false;

    img.onload = () => {
        img._ready = true;
    };
    img.onerror = () => {
        img._error = true;
        // 필요 시 콘솔 로그
        // console.error('[items] load failed:', kind, img.src);
    };

    const url = _urlFor(kind);
    if (url != null) {
        img.src = url;
    } else {
        img._error = true;
    }

    _cache[kind] = img;
    return img;
};

export const preloadItemSprites = () => {
    const kinds = ['MAX_BALL', 'DMG_UP', 'HP_UP'];
    for (let i = 0; i < kinds.length; i++) {
        _loadOne(kinds[i]);
    }
};

export const getItemSprite = (kind) => {
    if (!kind) {
        return null;
    }
    return _loadOne(kind);
};

export const isItemReady = (kind) => {
    const img = _cache[kind];
    if (!img) {
        return false;
    }
    if (img._error === true) {
        return false;
    }
    if (img._ready === true) {
        return true;
    }
    if (img.complete === true && img.naturalWidth > 0 && img.naturalHeight > 0) {
        img._ready = true;
        return true;
    }
    return false;
};
