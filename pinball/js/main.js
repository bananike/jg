// main.js
import { preloadBallSprites } from './assets-balls.js';
import { preloadBlockSprites } from './assets-blocks.js';
import { preloadEffects } from './assets-effects.js';
import { preloadItemSprites } from './assets-items.js';
import { preloadPlayerSprites } from './assets-player.js';
import { H, W } from './config.js';
import { bindHudGrantForTest } from './dev-hud-grant.js';
import { step } from './game.js';
import { draw } from './render.js';
import { bindDOM, dom, inputSetup, reset, ui, view } from './state.js';

const lockViewport = () => {
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
};

const fitCanvas = () => {
    if (!dom.canvas || !dom.ctx) {
        return;
    }

    const dprRaw = window.devicePixelRatio || 1;
    const dpr = Math.min(Math.max(dprRaw, 1), 2);
    view.dpr = dpr;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    if (s <= 0) {
        return;
    }
    view.scale = s;
    view.cssW = Math.floor(W * s);
    view.cssH = Math.floor(H * s);

    // CSS 크기
    dom.canvas.style.width = `${view.cssW}px`;
    dom.canvas.style.height = `${view.cssH}px`;
    if (dom.wrap) {
        dom.wrap.style.width = `${view.cssW}px`; // HUD 폭을 캔버스와 동일하게
    }

    // 내부 버퍼는 논리 W×H에 DPR만 반영
    dom.canvas.width = Math.floor(W * dpr);
    dom.canvas.height = Math.floor(H * dpr);

    const ctx = dom.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ctx.imageSmoothingEnabled !== true) {
        ctx.imageSmoothingEnabled = true;
    }

    if (ui && typeof ui.setHelpBoard === 'function') {
        ui.setHelpBoard();
    }
};

const loop = (ts) => {
    step(ts);
    if (dom.ctx) {
        dom.ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    }
    draw();
    requestAnimationFrame(loop);
};

const init = async () => {
    lockViewport();
    bindDOM();

    await preloadBlockSprites();
    inputSetup();
    reset();

    preloadEffects();
    preloadBallSprites();
    preloadItemSprites();
    preloadPlayerSprites();
    bindHudGrantForTest();

    if (dom.restartBtn) {
        dom.restartBtn.addEventListener('click', () => {
            reset();
            fitCanvas();
        });
    }

    window.addEventListener('resize', () => {
        fitCanvas();
    });
    window.addEventListener('orientationchange', () => {
        fitCanvas();
    });

    fitCanvas();
    requestAnimationFrame(loop);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
    });
} else {
    init();
}
