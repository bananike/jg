import { getBallSprite, isBallReady } from './assets-balls.js';
import { getBlockSprite } from './assets-blocks.js';
import { getEffectSprite, isEffectReady } from './assets-effects.js';
import { getItemSprite, isItemReady } from './assets-items.js';
import { getPlayerSprite, isPlayerReady } from './assets-player.js';
import { colorOfKind, colorOfPlayer } from './colors.js';
import { BALL_R, BLOCK_SIZE, BLOCK_SKINS, H, ITEM_BOX_COLOR, ITEM_RADIUS, W } from './config.js';
import { dom, player, world } from './state.js';
import { drawContainImage } from './utils.js';

const labelOfItem = (kind) => {
    const map = {
        MAX_BALL: '+',
        DMG_UP: 'D',
        HP_UP: 'H',
        SB_POWER: 'P',
        SB_FLAME: 'F',
        SB_PIERCE: 'X',
        SB_EXPLO: 'E',
        SB_SPLIT: 'S',
        SB_ICE: 'I',
        SB_VOID: 'V',
        SB_LASER: 'L',
        SB_BLEED: 'B',
    };
    return map[kind] || '?';
};

const colorOfSpecialBall = (b) => {
    if (b && b.meta && b.meta.color) {
        return b.meta.color;
    }
    return colorOfKind(b && b.kind, '#4cc9f0');
};

// 헬퍼
const fillRect = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
};

// 조준선
const drawAim = (ctx) => {
    const mx = player.x;
    const my = player.y - player.h / 2 - BALL_R - 2; // 머즐과 동일
    const dx = Math.cos(world.aim);
    const dy = Math.sin(world.aim);
    const len = 72;

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + dx * len, my + dy * len);
    ctx.stroke();
};

// 플레이어
const drawPlayer = (ctx) => {
    const w = player.w;
    const h = player.h;
    const x = Math.floor(player.x - w / 2);
    const y = Math.floor(player.y - player.h / 2);

    if (isPlayerReady('PLAYER') === true) {
        const img = getPlayerSprite('PLAYER');

        // 단순 스트레치. 원본 비율 유지하려면 아래 주석을 사용.
        // const ar = img.naturalWidth / img.naturalHeight;
        // let dw = w, dh = h;
        // if (ar > 1) { dh = Math.floor(w / ar); } else { dw = Math.floor(h * ar); }
        // const ox = Math.floor(player.x - dw / 2);
        // const oy = Math.floor(player.y - dh / 2);
        // ctx.drawImage(img, ox, oy, dw, dh);

        ctx.drawImage(img, x, y, w, h);
        return;
    }

    // 폴백: 기존 사각형
    ctx.fillStyle = colorOfPlayer(world.hp);
    ctx.fillRect(x, y, w, h);
};

// 볼
const drawNormalBalls = (ctx) => {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < world.balls.length; i++) {
        const b = world.balls[i];
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    }
};

// drawSpecialBalls 교체
const drawSpecialBalls = (ctx) => {
    for (let i = 0; i < world.sbBalls.length; i++) {
        const b = world.sbBalls[i];
        const r = b.r || 7.5;
        const size = r * 2;

        if (isBallReady(b.kind) === true) {
            const img = getBallSprite(b.kind);
            ctx.drawImage(img, b.x - r, b.y - r, size, size);
        } else {
            // 폴백: 기존 색 원
            ctx.fillStyle = colorOfSpecialBall(b);
            ctx.beginPath();
            ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // 고유색 보더
        ctx.save();
        ctx.lineWidth = 2;
        ctx.strokeStyle = colorOfKind(b && b.kind, '#ffffff');
        ctx.beginPath();
        ctx.arc(b.x, b.y, r + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (b.kind === 'PIERCE') {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r + 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
};

// 보스 스킨 1회 랜덤 할당
const ensureBossSkin = (bl) => {
    if (bl._bossSkinned === true && typeof bl.skin === 'number' && bl.skin > 0) {
        return;
    }

    if (typeof bl.skin === 'number' && bl.skin > 0) {
        const ok = getBlockSprite(bl.skin, bl.hp, bl.maxHp || bl.hp);
        if (ok) {
            bl._bossSkinned = true;
            return;
        }
    }

    const max = Math.max(1, BLOCK_SKINS | 0);

    const tryList = [];
    if (typeof bl.id === 'number') {
        const cand0 = 1 + (bl.id % max);
        tryList.push(cand0);
    }
    for (let t = 0; t < 6; t++) {
        const cand = 1 + Math.floor(Math.random() * max);
        tryList.push(cand);
    }

    for (let i = 0; i < tryList.length; i++) {
        const s = tryList[i];
        const img = getBlockSprite(s, bl.hp, bl.maxHp || bl.hp);
        if (img) {
            bl.skin = s;
            bl._bossSkinned = true;
            return;
        }
    }

    // 아직 스프라이트 준비 전. 이번 프레임은 폴백으로 그리고 다음 프레임에 재시도.
    bl._bossSkinned = false;
};

// 블록 위 상태이펙트 오버레이
const drawEffectOverlay = (ctx, bl, kind) => {
    if (isEffectReady(kind) === true) {
        const img = getEffectSprite(kind);
        ctx.drawImage(img, bl.x, bl.y, bl.w, bl.h);
        return;
    }
    if (kind === 'FLAME') {
        ctx.fillStyle = 'rgba(239,35,60,0.22)';
    } else {
        if (kind === 'ICE') {
            ctx.fillStyle = 'rgba(0,188,212,0.22)';
        } else {
            ctx.fillStyle = 'rgba(208,0,0,0.22)';
        }
    }
    ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
};

// 블록(보스 포함, 공통 스프라이트 경로 사용)
const drawBlocks = (ctx) => {
    for (let i = 0; i < world.blocks.length; i++) {
        const bl = world.blocks[i];

        if (bl.isBoss === true) {
            ensureBossSkin(bl);
        }

        const img = getBlockSprite(bl.skin || 0, bl.hp, bl.maxHp || bl.hp);
        if (img) {
            ctx.drawImage(img, bl.x, bl.y, bl.w, bl.h);
        } else {
            // 폴백: 보스는 진한 색, 일반은 기존 톤
            if (bl.isBoss === true) {
                ctx.fillStyle = '#ff006e';
            } else {
                const hpVis = Math.max(0, Math.min(bl.hp, 5));
                const hue = 40 + hpVis * 18;
                ctx.fillStyle = `hsl(${hue},80%,55%)`;
            }
            ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
            ctx.fillStyle = 'rgba(255,255,255,0.12)';
            ctx.fillRect(bl.x, bl.y, bl.w, 4);
        }

        const now = world.lastTs;

        if (bl.flameUntil && bl.flameUntil > now) {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            drawEffectOverlay(ctx, bl, 'FLAME');
            ctx.restore();
        }

        if (bl.slowUntil && bl.slowUntil > now) {
            ctx.save();
            ctx.globalCompositeOperation = 'color-dodge';
            drawEffectOverlay(ctx, bl, 'ICE');
            ctx.restore();
        }

        if (bl.bleedUntil && bl.bleedUntil > now) {
            if (bl.bleedStacks && bl.bleedStacks > 0) {
                ctx.save();
                ctx.globalCompositeOperation = 'multiply';
                drawEffectOverlay(ctx, bl, 'BLEED');
                ctx.restore();
            }
        }

        // 히트 플래시 외곽선
        if (bl.flashUntil && bl.flashUntil > world.lastTs) {
            const expand = 2;
            const ox = bl.x - expand;
            const oy = bl.y - expand;
            const ow = bl.w + expand * 2;
            const oh = bl.h + expand * 2;
            const stroke = bl.isBoss === true ? 'rgba(255, 0, 110, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = stroke;
            ctx.strokeRect(ox, oy, ow, oh);
            ctx.restore();
        }
    }
};

// 라운드 박스 헬퍼
const fillRoundRect = (ctx, x, y, w, h, r, fill) => {
    if (r <= 0) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
        return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
};

// 아이템
const drawItems = (ctx) => {
    for (let i = 0; i < world.items.length; i++) {
        const it = world.items[i];

        // 컨테이너 색 결정
        let boxColor = ITEM_BOX_COLOR.SB;
        if (it.kind === 'MAX_BALL') {
            boxColor = ITEM_BOX_COLOR.MAX_BALL;
        } else {
            if (it.kind === 'DMG_UP') {
                boxColor = ITEM_BOX_COLOR.DMG_UP;
            } else {
                if (it.kind === 'HP_UP') {
                    boxColor = ITEM_BOX_COLOR.HP_UP;
                }
            }
        }

        // 컨테이너(라운드)
        fillRoundRect(ctx, it.x, it.y, it.w, it.h, ITEM_RADIUS, boxColor);

        // 아이콘 패딩 및 배치
        const pad = Math.max(2, Math.floor(Math.min(it.w, it.h) * 0.18));
        const ix = it.x + pad;
        const iy = it.y + pad;
        const iw = it.w - pad * 2;
        const ih = it.h - pad * 2;

        let drawn = false;

        // SB_* → 특수볼 에셋 재사용
        if (typeof it.kind === 'string' && it.kind.startsWith('SB_') === true) {
            const ballKey = it.kind.slice(3); // SB_POWER → POWER
            if (isBallReady(ballKey) === true) {
                const img = getBallSprite(ballKey);
                drawContainImage(ctx, img, ix, iy, iw, ih);
                drawn = true;
            }
        } else {
            // 일반 아이템 → item-*.svg
            if (isItemReady(it.kind) === true) {
                const img = getItemSprite(it.kind);
                drawContainImage(ctx, img, ix, iy, iw, ih);
                drawn = true;
            }
        }

        // 폴백 텍스트
        if (drawn !== true) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.font = '10px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                it.kind && it.kind.startsWith('SB_') ? it.kind.slice(3, 4) : '?',
                it.x + it.w / 2,
                it.y + it.h / 2 + 3,
            );
        }
    }
};

// FX
const drawFx = (ctx, ts) => {
    if (!world.fx || world.fx.length === 0) {
        return;
    }
    for (let i = world.fx.length - 1; i >= 0; i--) {
        const f = world.fx[i];
        if (ts >= f.end) {
            world.fx.splice(i, 1);
            continue;
        }

        if (f.type === 'EXPLO') {
            const t = (ts - f.start) / (f.end - f.start);
            const r = f.rMax * (0.12 + 0.88 * t);
            const a = 1 - t;

            ctx.save();
            // ctx.globalCompositeOperation = 'lighter';

            // 코어
            let grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 0.6);
            grd.addColorStop(0.0, `rgba(133,94,46,${a})`);
            grd.addColorStop(0.7, `rgba(133,94,46,${a * 0.9})`);
            grd.addColorStop(1.0, `rgba(133,94,46,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r * 0.6, 0, Math.PI * 2);
            ctx.fill();

            // 외곽 블룸
            grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
            grd.addColorStop(0.0, `rgba(133,94,46,${a * 0.7})`);
            grd.addColorStop(1.0, `rgba(133,94,46,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
            ctx.fill();

            // 링
            ctx.strokeStyle = `rgba(133,94,46,${a * 0.95})`;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r * 0.78, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
            continue;
        }

        if (f.type === 'DMG') {
            const t = (ts - f.start) / (f.end - f.start);
            const a = 1 - t;
            const y = f.y - 18 * t;

            ctx.save();
            ctx.globalAlpha = a;
            ctx.textAlign = 'center';

            const px = f.sizePx || 12;
            const weight = f.isBold === true ? '700 ' : '';
            ctx.font = `${weight}${px}px system-ui, sans-serif`;

            // 외곽선
            ctx.lineWidth = Math.max(2, Math.floor(px * 0.14));
            ctx.strokeStyle = 'rgba(0,0,0,0.65)';
            ctx.strokeText(f.val, f.x, y);

            // 본문
            ctx.fillStyle = f.color || '#ffffff';
            ctx.fillText(f.val, f.x, y);
            ctx.restore();
            continue;
        }

        if (f.type === 'LASER') {
            const t = (ts - f.start) / (f.end - f.start);
            const fade = 1 - t;

            const h = BLOCK_SIZE; // 요청: 블록사이즈 두께
            const ctxW = W;
            const yTop = f.y - h / 2;

            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.max(0, Math.min(1, 0.95 * fade)); // 페이드만 적용

            if (isEffectReady('LASER') === true) {
                const img = getEffectSprite('LASER');
                drawContainImage(ctx, img, 0, yTop, ctxW, h);
            } else {
                // 폴백: 아주 옅은 단색 띠만 표시(디버그용)
                ctx.fillStyle = 'rgba(255,188,0,0.25)';
                ctx.fillRect(0, yTop, ctxW, h);
            }

            ctx.restore();
            continue;
        }
    }
};

const drawStatsOverlay = (ctx) => {
    if (world.gameOver !== true || !world.stats || !world.stats.byKind) {
        return;
    }

    const entries = Object.entries(world.stats.byKind)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

    const pad = 12;
    const rowH = 20;
    const headerH = 28;
    const boxW = 360;
    const boxH = headerH + rowH * (entries.length + 2) + pad * 2;

    const x = Math.floor((W - boxW) / 2);
    const y = Math.floor((H - boxH) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x, y, boxW, boxH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText('볼 타입별 누적 데미지', x + pad, y + pad + 16);

    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('타입', x + pad, y + headerH + pad);
    ctx.textAlign = 'right';
    ctx.fillText('데미지', x + boxW - pad, y + headerH + pad);

    let cy = y + headerH + pad + rowH;
    ctx.font = '14px system-ui, sans-serif';
    for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        ctx.textAlign = 'left';
        ctx.fillText(k, x + pad, cy);
        ctx.textAlign = 'right';
        ctx.fillText(v.toFixed(2), x + boxW - pad, cy);
        cy += rowH;
    }

    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('합계', x + pad, cy + 4);
    ctx.textAlign = 'right';
    ctx.fillText((world.stats.total || 0).toFixed(2), x + boxW - pad, cy + 4);
    ctx.restore();
};

// 메인 렌더러
export const draw = () => {
    if (!dom || !dom.ctx) {
        return;
    }
    const ctx = dom.ctx;

    // 스프라이트 스케일 품질
    if (ctx.imageSmoothingEnabled !== true) {
        ctx.imageSmoothingEnabled = true;
    }

    ctx.clearRect(0, 0, W, H);

    drawAim(ctx);
    drawPlayer(ctx);
    drawNormalBalls(ctx);
    drawSpecialBalls(ctx);
    drawBlocks(ctx);
    drawItems(ctx);
    drawFx(ctx, performance.now());

    if (world.gameOver === true) {
        drawStatsOverlay(ctx);
    }
};
