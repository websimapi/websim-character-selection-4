// Color shader and recoloring system
const slotColors = {
    blue: 240,
    green: 120,
    yellow: 60,
    red: 0
};

// Apply CSS filter to shift image color
function applyColorShader(slot) {
    const image = slot.querySelector('.character-image');
    const slotColorName = slot.dataset.color;
    applyColorShaderToImage(image, slotColorName);
}

function applyColorShaderToImage(image, slotColorName) {
    if (!image) return Promise.resolve();

    return new Promise(resolve => {
        const process = async () => {
            const blobUrl = await processAndCacheImage(image, { baseHue: image.dataset.baseHue }, slotColorName);
            if (blobUrl) {
                if (image.dataset.blobUrl) URL.revokeObjectURL(image.dataset.blobUrl);
                image.src = blobUrl;
                image.dataset.blobUrl = blobUrl;
            }
            resolve();
        };
        
        if (image.complete && image.naturalWidth) {
            process();
        } else {
            image.addEventListener('load', process, { once: true });
        }
    });
}

function processAndCacheImage(img, characterData, slotColorName) {
    const baseHue = parseInt(characterData.baseHue, 10);
    const targetHue = slotColors[slotColorName];

    if (baseHue === 120) { 
        return selectiveRecolorArcher(img, targetHue, true);
    }
    if (baseHue === 240) {
        return selectiveRecolorWarrior(img, targetHue, true);
    }
    if (baseHue === 0) {
        return selectiveRecolorValkyrie(img, targetHue, true);
    }
    
    // For characters without special logic (like Wizard), just return null as CSS filter is fine.
    // We only need to cache canvas-processed images.
    // To implement hue-rotate via canvas for them too, we would add that logic here.
    return Promise.resolve(null);
}

function selectiveRecolorWarrior(img, targetHue, returnBlob = false) {
    const shift = ((targetHue - 240) + 360) % 360;
    return new Promise((resolve) => {
        const process = () => {
            try {
                const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                x.drawImage(img, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
                for (let i = 0; i < p.length; i += 4) {
                    const r = p[i], g = p[i+1], b = p[i+2], a = p[i+3];
                    if (a < 5) continue;
                    const hsl = rgbToHsl(r, g, b); // h:0-360 s,l:0-1

                    // Check for near-#878787 grey pixels and make them transparent
                    // HSL of #878787 is h:0, s:0, l:0.53
                    if (hsl.s < 0.1 && hsl.l > 0.5 && hsl.l < 0.56) {
                        const pixelIndex = i / 4;
                        const px = pixelIndex % c.width;
                        const py = Math.floor(pixelIndex / c.width);

                        // Apply to bottom-left quadrant, and bottom half of bottom-right quadrant
                        const isBottomLeft = px < c.width / 2 && py > c.height / 2;
                        const isBottomHalfOfBottomRight = px >= c.width / 2 && py > c.height * 0.75;

                        if (isBottomLeft || isBottomHalfOfBottomRight) {
                            p[i+3] = 0; // Set alpha to transparent
                            continue; // Skip other color processing for this pixel
                        }
                    }

                    if (isBluish(hsl.h, hsl.s, hsl.l, r, g, b)) {
                        let h = (hsl.h + shift) % 360; let s = hsl.s, l = hsl.l;
                        if (targetHue === 60) { 
                            h = 52; 
                            s = Math.min(1, s * 1.22); 
                            l = Math.max(0, Math.min(1, l * 1.12)); 
                        }
                        const rgb = hslToRgb(h, s, l);
                        let rr = rgb.r, gg = rgb.g, bb = rgb.b;
                        if (targetHue === 60) {
                           rr = Math.min(255, rgb.r + 22);
                           gg = Math.max(0, rgb.g - 4);
                           bb = Math.max(0, rgb.b - 36);
                        }
                        p[i] = rr; p[i+1] = gg; p[i+2] = bb;
                    }
                }
                x.putImageData(d, 0, 0);
                c.toBlob(blob => {
                    if (!blob) { resolve(returnBlob ? null : undefined); return; }
                    const url = URL.createObjectURL(blob);
                    if (returnBlob) {
                        resolve(url);
                    } else {
                        if (img.dataset.blobUrl) URL.revokeObjectURL(img.dataset.blobUrl);
                        img.dataset.blobUrl = url;
                        img.style.filter = ''; img.src = url;
                        console.info('[Warrior Recolor] Applied selective blue shift -> hue', targetHue);
                        resolve();
                    }
                });
            } catch (e) { 
                console.warn('[Warrior Recolor] Fallback to CSS filter', e); 
                if (!returnBlob) img.style.filter = `hue-rotate(${targetHue-240}deg)`;
                resolve(returnBlob ? null : undefined);
            }
        };
        if (img.complete && img.naturalWidth) process(); else img.addEventListener('load', process, { once: true });
    });
}

function selectiveRecolorArcher(img, targetHue, returnBlob = false) {
    const shift = ((targetHue - 120) + 360) % 360;
    return new Promise((resolve) => {
        const process = () => {
            try {
                const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                x.drawImage(img, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
                for (let i = 0; i < p.length; i += 4) {
                    const r = p[i], g = p[i+1], b = p[i+2], a = p[i+3];
                    if (a < 5) continue;
                    const hsl = rgbToHsl(r, g, b); // h:0-360 s,l:0-1
                    if (isGreenish(hsl.h, hsl.s, hsl.l, r, g, b)) {
                        let h = (hsl.h + shift) % 360; let s = hsl.s, l = hsl.l;
                        if (targetHue === 0) { h = 0; s = Math.min(1, s * 1.22); l = Math.max(0, Math.min(1, l * 1.12)); }
                        else if (targetHue === 60) { h = 52; s = Math.min(1, s * 1.22); l = Math.max(0, Math.min(1, l * 1.12)); }
                        const rgb = hslToRgb(h, s, l);
                        const rr = targetHue === 0 ? Math.min(255, rgb.r + 8)  : (targetHue === 60 ? Math.min(255, rgb.r + 22) : rgb.r);
                        const gg = targetHue === 0 ? Math.max(0, rgb.g - 10) : (targetHue === 60 ? Math.max(0, rgb.g - 4)  : rgb.g);
                        const bb = targetHue === 0 ? Math.max(0, rgb.b - 24) : (targetHue === 60 ? Math.max(0, rgb.b - 36) : rgb.b);
                        p[i] = rr; p[i+1] = gg; p[i+2] = bb;
                    }
                }
                x.putImageData(d, 0, 0);
                c.toBlob(blob => {
                    if (!blob) { resolve(returnBlob ? null : undefined); return; }
                    const url = URL.createObjectURL(blob);
                    if (returnBlob) {
                        resolve(url);
                    } else {
                        if (img.dataset.blobUrl) URL.revokeObjectURL(img.dataset.blobUrl);
                        img.dataset.blobUrl = url;
                        img.style.filter = ''; img.src = url;
                        console.info('[Archer Recolor] Applied selective green shift -> hue', targetHue);
                        resolve();
                    }
                });
            } catch (e) { 
                console.warn('[Archer Recolor] Fallback to CSS filter', e); 
                if (!returnBlob) img.style.filter = `hue-rotate(${targetHue-120}deg)`;
                resolve(returnBlob ? null : undefined);
            }
        };
        if (img.complete && img.naturalWidth) process(); else img.addEventListener('load', process, { once: true });
    });
}

function selectiveRecolorValkyrie(img, targetHue, returnBlob = false) {
    const shift = ((targetHue - 0) + 360) % 360;
    return new Promise((resolve) => {
        const process = () => {
            try {
                const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
                c.width = img.naturalWidth; c.height = img.naturalHeight;
                x.drawImage(img, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height); const p = d.data;
                for (let i = 0; i < p.length; i += 4) {
                    const r = p[i], g = p[i+1], b = p[i+2], a = p[i+3];
                    if (a < 5) continue;
                    
                    const pixelIndex = i / 4;
                    const y = Math.floor(pixelIndex / c.width);

                    const hsl = rgbToHsl(r, g, b); // h:0-360 s,l:0-1
                    if (isReddish(hsl.h, hsl.s, hsl.l, r, g, b, y, c.height)) {
                        let h = (hsl.h + shift) % 360; 
                        let s = hsl.s, l = hsl.l;

                        if (targetHue === 60) { // Yellow - "light golden bright yellow"
                            h = 50; // Nudge hue towards orange/gold, away from green
                            s = Math.min(1, s * 1.25); // Increase saturation for brightness
                            l = Math.min(1, l * 1.15); // Increase lightness
                        }

                        const rgb = hslToRgb(h, s, l);
                        let rr = rgb.r, gg = rgb.g, bb = rgb.b;

                        if (targetHue === 60) {
                            // Further tweak RGB to enhance the golden feel
                            rr = Math.min(255, rgb.r + 15);
                            gg = Math.max(0, rgb.g - 5);
                            bb = Math.max(0, rgb.b - 30);
                        }
                        
                        p[i] = rr; p[i+1] = gg; p[i+2] = bb;
                    }
                }
                x.putImageData(d, 0, 0);
                c.toBlob(blob => {
                    if (!blob) { resolve(returnBlob ? null : undefined); return; }
                    const url = URL.createObjectURL(blob);
                    if (returnBlob) {
                        resolve(url);
                    } else {
                        if (img.dataset.blobUrl) URL.revokeObjectURL(img.dataset.blobUrl);
                        img.dataset.blobUrl = url;
                        img.style.filter = ''; img.src = url;
                        console.info('[Valkyrie Recolor] Applied selective red shift -> hue', targetHue);
                        resolve();
                    }
                });
            } catch (e) { 
                console.warn('[Valkyrie Recolor] Fallback to CSS filter', e); 
                if (!returnBlob) img.style.filter = `hue-rotate(${targetHue-0}deg)`;
                resolve(returnBlob ? null : undefined);
            }
        };
        if (img.complete && img.naturalWidth) process(); else img.addEventListener('load', process, { once: true });
    });
}

function isBluish(h, s, l, r, g, b) {
    const d = Math.abs(h - 240); const hueDist = Math.min(d, 360 - d);
    const hueOK = hueDist <= 65;
    const blueDominance = b - Math.max(r, g);
    const chromaOK = blueDominance > 5;
    const satOK = s > 0.10;
    const lightOK = l > 0.06 && l < 0.92;
    const darkBlueGuard = (b > r && b > g) && (b >= 28) && l < 0.35;
    return ((hueOK && satOK && lightOK) || chromaOK || darkBlueGuard);
}

function isReddish(h, s, l, r, g, b, y, imageHeight) {
    // Skin Tone Guard: Exclude pixels that fall within typical skin tone ranges.
    // Skin tones are usually in the orange-to-red hue range (15-45), with
    // moderate saturation (0.2-0.7) and lightness (0.3-0.9).
    // We only apply this guard to the top 60% of the image to protect the face/arms.
    const isUpperBody = y < imageHeight * 0.6;
    if (isUpperBody) {
        const isSkinTone = (h >= 15 && h <= 45) && (s >= 0.2 && s <= 0.7) && (l >= 0.3 && l <= 0.9);
        if (isSkinTone) {
            return false;
        }
    }

    // Hue check: Target reds, magentas, and oranges near red.
    const hueOK = (h >= 335 || h <= 30);
    // Chroma check: Ensure red is the dominant color component.
    const redDominance = r - Math.max(g, b);
    const chromaOK = redDominance > 10;
    // Saturation & Lightness checks: Avoid greys, blacks, whites.
    const satOK = s > 0.15;
    const lightOK = l > 0.08 && l < 0.95;
    // Special guard for dark, less saturated reds.
    const darkRedGuard = (r > g && r > b) && (r >= 30) && l < 0.40 && s > 0.1;

    // A specific check to include brownish-reds like the cape highlights (#AE734C)
    // h=24, s=0.39, l=0.49
    const isCapeBrown = (h >= 20 && h <= 28) && (s >= 0.35 && s <= 0.5) && (l >= 0.4 && l < 0.6);
    
    return (hueOK && satOK && lightOK && chromaOK) || darkRedGuard || isCapeBrown;
}

function isGreenish(h, s, l, r, g, b) {
    const d = Math.abs(h - 120); const hueDist = Math.min(d, 360 - d);
    const hueOK = hueDist <= 65;
    const greenDominance = g - Math.max(r, b);
    const chromaOK = greenDominance > 5;
    const satOK = s > 0.10;
    const lightOK = l > 0.06 && l < 0.92;
    const darkGreenGuard = (g > r && g > b) && (g >= 28) && l < 0.35;
    return ((hueOK && satOK && lightOK) || chromaOK || darkGreenGuard);
}

function rgbToHsl(r, g, b) {
    r/=255; g/=255; b/=255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = 0; s = 0; }
    else {
        const d = max - min;
        s = l > .5 ? d/(2-max-min) : d/(max+min);
        switch (max) {
            case r: h = (g-b)/d + (g<b?6:0); break;
            case g: h = (b-r)/d + 2; break;
            default: h = (r-g)/d + 4;
        }
        h *= 60;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2*l - 1)) * s;
    const hp = h / 60; const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1=0,g1=0,b1=0;
    if (hp>=0&&hp<1) { r1=c; g1=x; }
    else if (hp<2) { r1=x; g1=c; }
    else if (hp<3) { g1=c; b1=x; }
    else if (hp<4) { g1=x; b1=c; }
    else if (hp<5) { r1=x; b1=c; }
    else { r1=c; b1=x; }
    const m = l - c/2;
    return { r: Math.round((r1+m)*255), g: Math.round((g1+m)*255), b: Math.round((b1+m)*255) };
}