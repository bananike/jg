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
    const scale = Math.min(vw / W, vh / H);
    if (scale <= 0) {
        return;
    }
    view.scale = scale;
    view.cssW = Math.floor(W * scale);
    view.cssH = Math.floor(H * scale);

    dom.canvas.style.width = `${view.cssW}px`;
    dom.canvas.style.height = `${view.cssH}px`;

    if (dom.wrap) {
        dom.wrap.style.width = `${view.cssW}px`;
    }
    if (dom.hud) {
        dom.hud.style.width = `${view.cssW}px`;
    }

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

const preventFocusAndMenus = () => {
    const cv = dom.canvas;
    if (!cv) {
        return;
    }
    cv.setAttribute('tabindex', '-1');
    cv.style.touchAction = 'none';

    cv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    document.addEventListener('mousedown', () => {
        if (document.activeElement) {
            document.activeElement.blur();
        }
    });
    document.addEventListener(
        'touchstart',
        () => {
            if (document.activeElement) {
                document.activeElement.blur();
            }
        },
        { passive: true },
    );
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

    preventFocusAndMenus();

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
