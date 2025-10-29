import { dom, player, world } from './state.js';

// 색
const colorOfPlayer = () => {
    if (world.hp <= 0) {
        return '#6b7280';
    }
    if (world.hp === 1) {
        return '#f4a261';
    }
    if (world.hp === 2) {
        return '#9b5de5';
    }
    return '#3a86ff';
};
const colorOfSpecialBall = (b) => {
    const map = { POWER: '#ff9e00', FLAME: '#ef233c', PIERCE: '#06d6a0', EXPLO: '#8338ec', SPLIT: '#3a86ff' };
    return (b.meta && b.meta.color) || map[b.kind] || '#4cc9f0';
};
const colorOfItem = (kind) => {
    const map = {
        MAX_BALL: '#ffd166',
        DMG_UP: '#4cc9f0',
        HP_UP: '#f72585',
        SB_POWER: '#ff9e00',
        SB_FLAME: '#ef233c',
        SB_PIERCE: '#06d6a0',
        SB_EXPLO: '#8338ec',
        SB_SPLIT: '#3a86ff',
        POWER: '#ff9e00',
        FLAME: '#ef233c',
        PIERCE: '#06d6a0',
        EXPLO: '#8338ec',
        SPLIT: '#3a86ff',
    };
    return map[kind] || '#999999';
};
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
    };
    return map[kind] || '?';
};

// 헬퍼
const fillRect = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
};

// 조준선
const drawAim = (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - player.h / 2);
    ctx.lineTo(player.x + Math.cos(world.aim) * 64, player.y + Math.sin(world.aim) * 64);
    ctx.stroke();
};

// 플레이어
const drawPlayer = (ctx) => {
    fillRect(ctx, player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, colorOfPlayer());
};

// 볼
const drawNormalBalls = (ctx) => {
    ctx.fillStyle = '#ffffff'; // 기본볼=흰색
    for (let i = 0; i < world.balls.length; i++) {
        const b = world.balls[i];
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
    }
};
const drawSpecialBalls = (ctx) => {
    for (let i = 0; i < world.sbBalls.length; i++) {
        const b = world.sbBalls[i];
        const r = b.r || 7.5;
        ctx.fillStyle = colorOfSpecialBall(b);
        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fill();

        if (b.kind === 'PIERCE') {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, r + 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
};

// 블록(HP 숫자 제거)
const drawBlocks = (ctx) => {
    for (let i = 0; i < world.blocks.length; i++) {
        const bl = world.blocks[i];
        if (bl.isBoss === true) {
            fillRect(ctx, bl.x, bl.y, bl.w, bl.h, '#ff006e');
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bl.x + 1, bl.y + 1, bl.w - 2, bl.h - 2);
        } else {
            const hpVis = Math.max(0, Math.min(bl.hp, 5));
            const hue = 40 + hpVis * 18;
            fillRect(ctx, bl.x, bl.y, bl.w, bl.h, `hsl(${hue},80%,55%)`);
            fillRect(ctx, bl.x, bl.y, bl.w, 4, 'rgba(255,255,255,0.12)');
        }
        if (bl.dotUntil && bl.dotUntil > world.lastTs) {
            ctx.fillStyle = 'rgba(239,35,60,0.25)';
            ctx.fillRect(bl.x, bl.y, bl.w, bl.h);
        }

        if (bl.flashUntil && bl.flashUntil > world.lastTs) {
            const expand = 2;
            const ox = bl.x - expand;
            const oy = bl.y - expand;
            const ow = bl.w + expand * 2;
            const oh = bl.h + expand * 2;

            // 보스는 밝은 핫핑크, 일반은 흰색 계열로 살짝 투명
            const stroke = bl.isBoss === true ? 'rgba(255, 0, 110, 0.9)' : 'rgba(255, 255, 255, 0.9)';

            const ctx = dom.ctx;
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = stroke;
            ctx.strokeRect(ox, oy, ow, oh);
            ctx.restore();
        }
    }
};

// 아이템
const drawItems = (ctx) => {
    for (let i = 0; i < world.items.length; i++) {
        const it = world.items[i];
        fillRect(ctx, it.x, it.y, it.w, it.h, colorOfItem(it.kind));
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(labelOfItem(it.kind), it.x + it.w / 2, it.y + it.h / 2 + 3);
    }
};

// FX
// FX
const drawFx = (ctx, ts) => {
    for (let i = world.fx.length - 1; i >= 0; i--) {
        const f = world.fx[i];
        if (ts >= f.end) {
            world.fx.splice(i, 1);
            continue;
        }

        if (f.type === 'EXPLO') {
            const t = (ts - f.start) / (f.end - f.start);
            const r = f.rMax * (0.2 + 0.8 * t);
            const alpha = 0.35 * (1 - t);

            const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
            grd.addColorStop(0, `rgba(255,200,120,${alpha})`);
            grd.addColorStop(1, `rgba(255,100,50,0)`);
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = `rgba(255,160,60,${0.45 * (1 - t)})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r * 0.9, 0, Math.PI * 2);
            ctx.stroke();
            continue;
        }

        if (f.type === 'DMG') {
            const t = (ts - f.start) / (f.end - f.start);
            const a = 1 - t;
            const y = f.y - 18 * t;

            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = f.color || '#ffffff';
            ctx.font = '12px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(f.val, f.x, y);
            ctx.restore();
            continue;
        }
    }
};

// 메인 렌더러
export const draw = () => {
    if (!dom || !dom.ctx) {
        return;
    }
    const ctx = dom.ctx;
    const W = dom.canvas.width;
    const H = dom.canvas.height;

    ctx.clearRect(0, 0, W, H);

    drawAim(ctx);
    drawPlayer(ctx);
    drawNormalBalls(ctx);
    drawSpecialBalls(ctx);
    drawBlocks(ctx);
    drawItems(ctx);
    drawFx(ctx, performance.now());
};
