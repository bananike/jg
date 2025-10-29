// items.js
import { H, ITEM_FALL } from './config.js';
import { player, SB_KIND, ui, world } from './state.js';

const toSBKind = (itemKind) => {
    if (itemKind === 'SB_POWER') {
        return SB_KIND.POWER;
    }
    if (itemKind === 'SB_FLAME') {
        return SB_KIND.FLAME;
    }
    if (itemKind === 'SB_PIERCE') {
        return SB_KIND.PIERCE;
    }
    if (itemKind === 'SB_EXPLO') {
        return SB_KIND.EXPLO;
    }
    if (itemKind === 'SB_SPLIT') {
        return SB_KIND.SPLIT;
    }
    if (itemKind === 'SB_ICE') {
        return SB_KIND.ICE;
    }
    if (itemKind === 'SB_VOID') {
        return SB_KIND.VOID;
    }
    if (itemKind === 'SB_LASER') {
        return SB_KIND.LASER;
    }
    if (itemKind === 'SB_BLEED') {
        return SB_KIND.BLEED;
    }
    if (
        itemKind === SB_KIND.POWER ||
        itemKind === SB_KIND.FLAME ||
        itemKind === SB_KIND.PIERCE ||
        itemKind === SB_KIND.EXPLO ||
        itemKind === SB_KIND.SPLIT ||
        itemKind === SB_KIND.ICE ||
        itemKind === SB_KIND.VOID ||
        itemKind === SB_KIND.LASER ||
        itemKind === SB_KIND.BLEED
    ) {
        return itemKind;
    }
    return null;
};

export const updateItems = () => {
    for (let i = world.items.length - 1; i >= 0; i--) {
        const it = world.items[i];
        if (!it) {
            continue;
        }
        it.y += ITEM_FALL;

        const px1 = player.x - player.w / 2;
        const py1 = player.y - player.h / 2;
        const px2 = player.x + player.w / 2;
        const py2 = player.y + player.h / 2;
        const hit = it.x + it.w > px1 && it.x < px2 && it.y + it.h > py1 && it.y < py2;

        if (hit === true) {
            if (it.kind === 'MAX_BALL') {
                world.maxBalls += 1;
                ui.setMaxBalls(world.maxBalls);
            } else {
                if (it.kind === 'DMG_UP') {
                    world.ballDmgBase += 0.05;
                } else {
                    if (it.kind === 'HP_UP') {
                        world.hp += 1;
                        ui.setHp(world.hp);
                    } else {
                        const sbKind = toSBKind(it.kind);
                        if (sbKind !== null && world.useSB && world.useSB[sbKind]) {
                            const slot = world.useSB[sbKind];
                            slot.count += 1;
                            slot.max += 1;
                            ui.setSBStock();
                        }
                    }
                }
            }
            world.items.splice(i, 1);
            continue;
        }

        if (it.y > H) {
            world.items.splice(i, 1);
        }
    }
};

export const pushItem = (x, y, kind) => {
    if (!world || !world.items) {
        return;
    }
    world.items.push({
        x: x,
        y: y,
        w: 16,
        h: 16,
        kind: kind,
    });
};
