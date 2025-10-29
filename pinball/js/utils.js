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
