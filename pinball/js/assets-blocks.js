// assets-blocks.js
import { getCachedImage, preloadImages } from './assets.js';
import { ASSET_BASE, BLOCK_SKINS } from './config.js';

const TIERS = ['high', 'mid', 'low'];

const pathOf = (skin, tier) => {
    return `${ASSET_BASE}/block${skin}-${tier}.svg`;
};

export const preloadBlockSprites = async () => {
    const list = [];
    for (let s = 1; s <= BLOCK_SKINS; s++) {
        for (let i = 0; i < TIERS.length; i++) {
            list.push(pathOf(s, TIERS[i]));
        }
    }
    await preloadImages(list);
};

const tierOf = (hp, maxHp) => {
    if (maxHp <= 0) {
        return 'low';
    }
    const ratio = hp / maxHp;
    if (ratio > 2 / 3) {
        return 'high';
    }
    if (ratio > 1 / 3) {
        return 'mid';
    }
    return 'low';
};

export const getBlockSprite = (skin, hp, maxHp) => {
    const tier = tierOf(hp, maxHp);
    return getCachedImage(pathOf(skin || 1, tier));
};
