import { H, ITEM_FALL } from './config.js';
import { player, SB_KIND, ui, world } from './state.js';

const toSBKind = (k) => {
    if (k === 'SB_POWER' || k === SB_KIND.POWER) return SB_KIND.POWER;
    if (k === 'SB_FLAME' || k === SB_KIND.FLAME) return SB_KIND.FLAME;
    if (k === 'SB_PIERCE' || k === SB_KIND.PIERCE) return SB_KIND.PIERCE;
    if (k === 'SB_EXPLO' || k === SB_KIND.EXPLO) return SB_KIND.EXPLO;
    if (k === 'SB_SPLIT' || k === SB_KIND.SPLIT) return SB_KIND.SPLIT;
    return null;
};

export const updateItems = () => {
    for (let i = world.items.length - 1; i >= 0; i--) {
        const it = world.items[i];
        it.y += ITEM_FALL;

        const px1 = player.x - player.w / 2;
        const py1 = player.y - player.h / 2;
        const px2 = player.x + player.w / 2;
        const py2 = player.y + player.h / 2;
        const hit = it.x + it.w > px1 && it.x < px2 && it.y + it.h > py1 && it.y < py2;

        if (hit) {
            if (it.kind === 'MAX_BALL') {
                world.maxBalls += 1;
                ui.setMaxBalls(world.maxBalls);
            } else if (it.kind === 'DMG_UP') {
                world.ballDmgBase += 0.05;
                ui.setBallDmg(world.ballDmgBase);
            } else if (it.kind === 'HP_UP') {
                world.hp += 1;
                ui.setHp(world.hp);
            } else {
                const sbKind = toSBKind(it.kind);
                if (sbKind && world.useSB[sbKind]) {
                    const slot = world.useSB[sbKind];
                    slot.count += 1;
                    slot.max += 1;
                    ui.setSBStock();
                }
            }
            world.items.splice(i, 1);
            continue;
        }
        if (it.y > H) world.items.splice(i, 1);
    }
};

export const pushItem = (x, y, kind) => {
    world.items.push({ x, y, w: 16, h: 16, kind });
};
