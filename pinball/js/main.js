// main.js
import { preloadBallSprites /*, setBallsBase*/ } from './assets-balls.js';
import { preloadBlockSprites } from './assets-blocks.js';
import { preloadEffects /*, setEffectsBase*/ } from './assets-effects.js';
import { preloadItemSprites } from './assets-items.js';
import { preloadPlayerSprites } from './assets-player.js';
import { bindHudGrantForTest } from './dev-hud-grant.js';
import { step } from './game.js';
import { draw } from './render.js';
import { bindDOM, dom, inputSetup, reset } from './state.js';

const loop = (ts) => {
    step(ts);
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

    requestAnimationFrame(loop);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
