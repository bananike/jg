// boss.js
import { ITEM, W } from './config.js';
import { pushItem } from './items.js';

export const dropBossRewards = (bl) => {
    const cx = Math.floor(W / 2) - 8; // 중앙 정렬
    const stepY = 24;

    // 보스 상단 기준. 너무 위로 가면 보정.
    const topAnchor = bl.y - 8; // 보스 위쪽 시작점
    let base = topAnchor;
    if (base - stepY * 2 < 6) {
        base = 6 + stepY * 2; // 최소 여백 6px 확보 후 간격 유지
    }

    // 위쪽으로 쌓이게 배치
    const y0 = base - stepY * 0;
    const y1 = base - stepY * 1;
    const y2 = base - stepY * 2;

    pushItem(cx, y0, ITEM.MAX_BALL);
    pushItem(cx, y1, ITEM.DMG_UP);

    const sbPool = [
        ITEM.SB_POWER,
        ITEM.SB_FLAME,
        ITEM.SB_PIERCE,
        ITEM.SB_EXPLO,
        ITEM.SB_SPLIT,
        ITEM.SB_ICE,
        ITEM.SB_VOID,
        ITEM.SB_LASER,
        ITEM.SB_BLEED,
    ];
    const sbKind = sbPool[Math.floor(Math.random() * sbPool.length)];
    pushItem(cx, y2, sbKind);
};
