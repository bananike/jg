// assets-player.js
import { ASSET_BASE } from './config.js';

const base = (ASSET_BASE || './assets').replace(/\/+$/, '');
const DIRS = [`${base}/`, `${base}/player/`]; // 둘 다 탐색
const _cache = {};

export const setPlayerBase = (baseUrl) => {
    if (typeof baseUrl === 'string') {
        const b = baseUrl.replace(/\/+$/, '');
        DIRS[0] = `${b}/`;
        DIRS[1] = `${b}/player/`;
    }
};

const _nameVariants = (name) => {
    const slug = String(name).toLowerCase().replace(/_/g, '-'); // PLAYER -> player
    return [
        `${slug}.svg`,
        `${slug}.png`,
        `${slug}.webp`,
        `player-${slug}.svg`,
        `player-${slug}.png`,
        `player-${slug}.webp`,
    ];
};

const _candidatesFor = (name) => {
    const files = _nameVariants(name);
    const out = [];
    for (let i = 0; i < DIRS.length; i++) {
        for (let j = 0; j < files.length; j++) {
            out.push(DIRS[i] + files[j]);
        }
    }
    return out;
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
    img._ix = 0;
    img._cands = _candidatesFor(name);

    const _tryNext = () => {
        if (img._ix >= img._cands.length) {
            img._error = true;
            return;
        }
        const url = img._cands[img._ix];
        img._ix += 1;
        img.src = url;
    };

    img.onload = () => {
        img._ready = true;
    };

    img.onerror = () => {
        _tryNext();
    };

    _tryNext();
    _cache[name] = img;
    return img;
};

export const preloadPlayerSprites = () => {
    _loadOne('PLAYER'); // 기본 이름
};

export const getPlayerSprite = (name = 'PLAYER') => {
    return _loadOne(name);
};

export const isPlayerReady = (name = 'PLAYER') => {
    const img = _cache[name];
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
