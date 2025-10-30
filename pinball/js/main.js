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
import { bindDOM, dom, inputSetup, reset, view } from './state.js';

const fitCanvas = () => {
    if (!dom.canvas) {
        return;
    }

    // 1) DPR
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;

    // 2) 화면에 맞는 스케일 결정. 세로 기준로 꽉 차게, 가로는 레터박스 허용.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    view.scale = s;
    view.cssW = Math.floor(W * s);
    view.cssH = Math.floor(H * s);

    // 3) 캔버스 CSS 크기와 내부 버퍼 크기 모두 설정
    dom.canvas.style.width = `${view.cssW}px`;
    dom.canvas.style.height = `${view.cssH}px`;
    dom.canvas.width = Math.floor(W * s * dpr);
    dom.canvas.height = Math.floor(H * s * dpr);

    // 4) 렌더 좌표 변환을 한 번에 적용
    const ctx = dom.ctx;
    if (ctx) {
        ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
        if (ctx.imageSmoothingEnabled !== true) {
            ctx.imageSmoothingEnabled = true;
        }
    }
};

const loop = (ts) => {
    step(ts);
    // 안전: 리사이즈 후 한 번 더 변환 보장
    if (dom.ctx) {
        dom.ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, 0, 0);
    }
    draw();
    requestAnimationFrame(loop);
};

const init = async () => {
    bindDOM();

    if (!dom.canvas.width) {
        dom.canvas.width = 460;
    }
    if (!dom.canvas.height) {
        dom.canvas.height = 720;
    }

    // 블록 스프라이트 사전 로드
    await preloadBlockSprites();

    inputSetup();
    reset();
    preloadEffects();
    preloadBallSprites();
    preloadItemSprites();
    preloadPlayerSprites();
    bindHudGrantForTest(); // test hud

    if (dom.restartBtn) {
        dom.restartBtn.addEventListener('click', () => {
            reset();
        });
    }

    // 리사이즈 바인딩
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
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
