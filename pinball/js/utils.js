export const clamp = (v, min, max) => {
    if (v < min) {
        return min;
    }
    if (v > max) {
        return max;
    }
    return v;
};

export const aabbOverlap = (ax, ay, aw, ah, bx, by, bw, bh) => {
    if (ax + aw <= bx) {
        return false;
    }
    if (bx + bw <= ax) {
        return false;
    }
    if (ay + ah <= by) {
        return false;
    }
    if (by + bh <= ay) {
        return false;
    }
    return true;
};

export const drawContainImage = (ctx, img, dx, dy, dw, dh) => {
    if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        return;
    }
    const sw = img.naturalWidth;
    const sh = img.naturalHeight;

    const s = Math.min(dw / sw, dh / sh);
    const rw = Math.max(1, Math.floor(sw * s));
    const rh = Math.max(1, Math.floor(sh * s));
    const rx = Math.floor(dx + (dw - rw) / 2);
    const ry = Math.floor(dy + (dh - rh) / 2);

    ctx.drawImage(img, rx, ry, rw, rh);
};
