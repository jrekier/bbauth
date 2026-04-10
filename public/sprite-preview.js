// sprite-preview.js
// Draws a tinted composite sprite (base + recoloured armour) onto a <canvas>.
// Same compositing logic as webbb's sprites.js, self-contained for bbauth.

(function () {
    const sheetCache = {};  // absUrl → Image

    function resolveSheet(url) {
        const base = (typeof window !== 'undefined' && window.STATIC_BASE) || '';
        return base ? `${base}/${url}` : url;
    }

    function loadSheet(url, cb) {
        const abs = resolveSheet(url);
        if (sheetCache[abs]) {
            if (sheetCache[abs].complete) cb(sheetCache[abs]);
            else sheetCache[abs].addEventListener('load', () => cb(sheetCache[abs]));
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => cb(img);
        img.src = abs;
        sheetCache[abs] = img;
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if      (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        return [h / 6, s, l];
    }

    function hslToRgb(h, s, l) {
        if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        return [h + 1/3, h, h - 1/3].map(t => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return Math.round((p + (q - p) * 6 * t) * 255);
            if (t < 1/2) return Math.round(q * 255);
            if (t < 2/3) return Math.round((p + (q - p) * (2/3 - t) * 6) * 255);
            return Math.round(p * 255);
        });
    }

    // Draw a composite tinted sprite onto canvas.
    // spriteDef: { sheet, base: {x,y,w,h}, armour: {x,y,w,h} }
    // colour: [r, g, b]
    function drawSpritePreview(canvas, spriteDef, colour) {
        const { sheet, base, armour } = spriteDef;
        const [cr, cg, cb] = colour;

        loadSheet(sheet, (img) => {
            const W = Math.max(base.w, armour.w);
            const H = Math.max(base.h, armour.h);

            // Scale to fill the canvas while keeping pixels crisp
            const scale = Math.min(canvas.width / W, canvas.height / H);
            const dw = Math.round(W * scale);
            const dh = Math.round(H * scale);
            const dx = Math.round((canvas.width  - dw) / 2);
            const dy = Math.round((canvas.height - dh) / 2);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;

            // Base layer — drawn as-is
            ctx.drawImage(img, base.x, base.y, base.w, base.h, dx, dy, dw, dh);

            // Armour layer — composite onto an offscreen canvas for tinting
            const off    = new OffscreenCanvas(armour.w, armour.h);
            const offCtx = off.getContext('2d');
            offCtx.imageSmoothingEnabled = false;
            offCtx.drawImage(img, armour.x, armour.y, armour.w, armour.h, 0, 0, armour.w, armour.h);

            const imgData = offCtx.getImageData(0, 0, armour.w, armour.h);
            const d = imgData.data;
            const [th, ts] = rgbToHsl(cr, cg, cb);
            for (let i = 0; i < d.length; i += 4) {
                if (d[i + 3] < 10) continue;
                const [,, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
                const [nr, ng, nb] = hslToRgb(th, ts, l);
                d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
            }
            offCtx.putImageData(imgData, 0, 0);

            ctx.drawImage(off, 0, 0, armour.w, armour.h, dx, dy, dw, dh);
        });
    }

    window.drawSpritePreview = drawSpritePreview;
})();
