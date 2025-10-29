// 항상 중괄호 사용, 화살표 함수 사용
const cache = new Map();

export const loadImage = (src) => {
    return new Promise((resolve) => {
        if (cache.has(src) === true) {
            resolve(cache.get(src));
            return;
        }
        const img = new Image();
        img.onload = () => {
            cache.set(src, img);
            resolve(img);
        };
        img.onerror = () => {
            resolve(null);
        };
        img.src = src;
    });
};

export const preloadImages = async (list) => {
    const jobs = [];
    for (let i = 0; i < list.length; i++) {
        jobs.push(loadImage(list[i]));
    }
    await Promise.all(jobs);
};

export const getCachedImage = (src) => {
    if (cache.has(src) === true) {
        return cache.get(src);
    }
    return null;
};
