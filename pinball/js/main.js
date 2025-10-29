import { step } from './game.js';
import { draw } from './render.js';
import { bindDOM, dom, inputSetup, reset, ui } from './state.js';

const loop = (ts) => {
    step(ts);
    draw();
    requestAnimationFrame(loop);
};

const init = () => {
    bindDOM();
    if (!dom.canvas.width) dom.canvas.width = 460;
    if (!dom.canvas.height) dom.canvas.height = 720;

    inputSetup();
    reset();
    ui.setSBStock();

    if (dom.restartBtn) {
        dom.restartBtn.addEventListener('click', () => reset());
    }

    requestAnimationFrame(loop);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
