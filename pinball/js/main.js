// main.js
import { preloadBallSprites /*, setBallsBase*/ } from './assets-balls.js';
import { preloadBlockSprites } from './assets-blocks.js';
import { preloadEffects /*, setEffectsBase*/ } from './assets-effects.js';
import { preloadItemSprites } from './assets-items.js';
import { preloadPlayerSprites } from './assets-player.js';
import { H, W } from './config.js';
import { bindHudGrantForTest } from './dev-hud-grant.js';
import { step } from './game.js';
import { draw } from './render.js';
import { bindDOM, dom, inputSetup, reset, ui, view } from './state.js';

const fitCanvas = () => {
    if (!dom.canvas || !dom.ctx) {
        return;
    }

    // 1) DPR
    const dprRaw = window.devicePixelRatio || 1;
    const dpr = Math.min(Math.max(dprRaw, 1), 2);
    view.dpr = dpr;

    // 2) 화면 스케일(CSS로만) — 논리 좌표는 W×H 유지
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    if (s <= 0) {
        return;
    }
    view.scale = s;
    view.cssW = Math.floor(W * s);
    view.cssH = Math.floor(H * s);

    // 3) CSS 크기만 스케일. 내부 버퍼는 W×H×DPR로 고정.
    dom.canvas.style.width = `${view.cssW}px`;
    dom.canvas.style.height = `${view.cssH}px`;
    dom.canvas.width = Math.floor(W * dpr);
    dom.canvas.height = Math.floor(H * dpr);

    // 4) 논리좌표 → 픽셀 변환은 DPR만 적용
    const ctx = dom.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (ctx.imageSmoothingEnabled !== true) {
        ctx.imageSmoothingEnabled = true;
    }

    // 5) 헬프보드 위치 갱신
    if (ui && typeof ui.setHelpBoard === 'function') {
        ui.setHelpBoard();
    }
};

const loop = (ts) => {
    step(ts);
    if (dom.ctx) {
        // 좌표계 보정 유지
        dom.ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    }
    draw();
    requestAnimationFrame(loop);
};

const init = async () => {
    bindDOM();

    // 고정 속성 사전설정 불필요. fitCanvas에서 일괄 설정.
    await preloadBlockSprites();

    inputSetup();
    reset(); // 상태 및 HUD 초기화
    preloadEffects();
    preloadBallSprites();
    preloadItemSprites();
    preloadPlayerSprites();
    bindHudGrantForTest(); // test hud

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
