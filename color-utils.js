// Color conversion and detection utilities

export function isBluish(h, s, l, r, g, b) {
    const d = Math.abs(h - 240); const hueDist = Math.min(d, 360 - d);
    const hueOK = hueDist <= 65;
    const blueDominance = b - Math.max(r, g);
    const chromaOK = blueDominance > 5;
    const satOK = s > 0.10;
    const lightOK = l > 0.06 && l < 0.92;
    const darkBlueGuard = (b > r && b > g) && (b >= 28) && l < 0.35;
    return ((hueOK && satOK && lightOK) || chromaOK || darkBlueGuard);
}

function isYellowish(h, s, l, r, g, b, y, imageHeight) {
    // Robe Guard: Exclude dark, low-saturation colors to protect the robes.
    if (s < 0.25 && l < 0.45) {
        return false;
    }
    // Also check for greyish colors by component difference.
    const maxComp = Math.max(r, g, b);
    const minComp = Math.min(r, g, b);
    if ((maxComp - minComp) < 20 && l < 0.5) {
        return false;
    }
    
    // Staff Glow Guard: Exclude very bright, near-white colors.
    if (l > 0.85 && s < 0.4) {
        return false;
    }

    // Staff Guard: Exclude brownish colors that might be on the staff.
    // Brown hues are in the orange/yellow range, but less saturated.
    // The staff's brown is around hue 25-35. The gold trim is hue 45-55.
    if (h > 20 && h < 40 && s < 0.6) {
        return false;
    }

    // Skin Tone Guard: Exclude pixels that fall within typical skin tone ranges.
    // This is refined to be more specific to avoid accidentally filtering out gold/yellow tones.
    const isUpperBody = y < imageHeight * 0.65;
    if (isUpperBody) {
        // More specific skin tone check: skin is typically in the orange hue range,
        // with moderate saturation and brightness. Very bright or very saturated pixels
        // are less likely to be skin. Gold can be bright and saturated.
        const isSkinHue = h >= 18 && h <= 45; // Broadened slightly
        const isSkinSat = s >= 0.20 && s <= 0.65;
        const isSkinLight = l >= 0.35 && l <= 0.85;

        if (isSkinHue && isSkinSat && isSkinLight) {
            // Check for color dominance. Skin has r > g > b.
            // Gold/yellow has r ~= g > b. If green is much lower than red, it's more likely skin.
            if (r > g && (r - g) > 25) {
                return false;
            }
        }
    }

    // Hue check: Target yellows and golds, avoiding greenish yellows.
    const hueOK = (h >= 42 && h <= 70);
    // Chroma check: Ensure yellow/gold is dominant. Yellow is high R and G, low B.
    const yellowDominance = (r + g) / 2 - b;
    const chromaOK = yellowDominance > 25; 
    // Saturation & Lightness checks: Avoid greys, blacks, whites.
    const satOK = s > 0.25; 
    const lightOK = l > 0.20 && l < 0.90; 
    
    // A specific guard for dark, less saturated gold/brass colors.
    const darkYellowGuard = (g > b && r > b) && (g > 60 && r > 60) && l < 0.55 && s > 0.20;

    return (hueOK && satOK && lightOK && chromaOK) || darkYellowGuard;
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

export function rgbToHsl(r, g, b) {
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

export function hslToRgb(h, s, l) {
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