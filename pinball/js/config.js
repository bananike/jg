export const W = 460;
export const H = 720;

// 플레이어
export const PLAYER_SIZE = 34;
export const PLAYER_SPEED = 6;

// 일반 볼
export const BALL_R = 6;
export const BALL_SPEED = 4.2;
export const FIRE_INTERVAL_MS = 140;
export const INITIAL_MAX_BALLS = 5;

// 블록 그리드
export const COLS = 8;
export const LEFT_PAD = 20;
export const RIGHT_PAD = 20;
export const GAP = 6;
export const CELL = Math.floor((W - LEFT_PAD - RIGHT_PAD) / COLS);
export const BLOCK_SIZE = CELL - GAP;

// 낙하 및 난이도
export const FALL_BASE = 0.32;
export const FALL_GAIN_PER_SEC = 0.0008;
export const HP_GROWTH_PER_SEC = 0.05;
export const MIN_V_GAP = 8;

// 아이템
export const DROP_CHANCE = 0.03; // 일반 블록
export const ITEM_FALL = 0.95;

// 보스
export const BOSS_SIZE = BLOCK_SIZE * 3;
export const BOSS_HP_MULT = 8;
export const BOSS_FIRST_DELAY = 10; // s
export const BOSS_INTERVAL = 25; // s
export const PRE_BOSS_FREEZE = 3; // s
export const POST_BOSS_FREEZE = 2; // s
export const BOSS_DROP_ROLLS = 2;

// 특수볼
export const SB = {
    POWER: 'POWER', // 1
    FLAME: 'FLAME', // 2
    PIERCE: 'PIERCE', // 3
    EXPLO: 'EXPLO', // 4
    SPLIT: 'SPLIT', // 5
};

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
