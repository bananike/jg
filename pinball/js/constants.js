// constants.js  (호환 레이어)
// config.js에서 정의한 값을 단일 진실원천으로 사용한다고 가정
// - SB: { POWER, FLAME, PIERCE, EXPLO, SPLIT }
// - ITEM: { MAX_BALL, DMG_UP, HP_UP, SB_POWER, SB_FLAME, SB_PIERCE, SB_EXPLO, SB_SPLIT }

export const SB = {
    POWER: 'POWER',
    FLAME: 'FLAME',
    PIERCE: 'PIERCE',
    EXPLO: 'EXPLO',
    SPLIT: 'SPLIT',
};

// 보스 드랍 아이템 포함(특수볼 획득용 키는 SB_* 로 통일)
export const ITEM = {
    MAX_BALL: 'MAX_BALL',
    DMG_UP: 'DMG_UP',
    HP_UP: 'HP_UP',
    SB_POWER: 'SB_POWER',
    SB_FLAME: 'SB_FLAME',
    SB_PIERCE: 'SB_PIERCE',
    SB_EXPLO: 'SB_EXPLO',
    SB_SPLIT: 'SB_SPLIT',
};

// 구 코드 호환용 별칭(렌더/스폰/충돌 코드가 ITEM_TYPE, SB_KIND를 import 하던 경우 대비)
export const ITEM_TYPE = ITEM;
export const SB_KIND = SB;
