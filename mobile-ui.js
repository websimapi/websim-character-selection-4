// Mobile-specific UI logic, extracted from ui.js
import { characters } from './characters.js';
import { slotColors, processAndCacheImage } from './color-shader.js';
import { stoneShiftBuffer, playSound } from './audio.js';
import { requestSlotSwitch } from './ui.js';

export function setupMobileSlotPicker() {
    const picker = document.getElementById('mobile-slot-picker');
    if (!picker) return;
    const isMobile = document.body.classList.contains('mobile');
    picker.classList.toggle('hidden', !isMobile);
    picker.querySelectorAll('.slot-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.slot, 10);
            if (window.playerSlots[idx]?.occupied) return;
            requestSlotSwitch(idx);
        });
    });
    updateMobileSlotPicker();
}

export function updateMobileSlotPicker() {
    const picker = document.getElementById('mobile-slot-picker');
    if (!picker) return;
    picker.querySelectorAll('.slot-pill').forEach(btn => {
        const idx = parseInt(btn.dataset.slot, 10);
        btn.classList.toggle('occupied', !!window.playerSlots[idx]?.occupied);
    });
}


export function applyMobileSingleSlotMode() {
    if (!document.body.classList.contains('mobile')) return;
    document.querySelectorAll('.character-slot').forEach((el, i) => {
        el.classList.toggle('own-slot', i === window.mySlotIndex);
    });
    document.body.classList.add('mobile-single-slot');
    renderPlayersStrip();
}
window.applyMobileSingleSlotMode = applyMobileSingleSlotMode;

export function renderPlayersStrip() {
    const strip = document.getElementById('players-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const me = window.mySlotIndex;
    window.playerSlots.forEach((slot, i) => {
        if (!slot.occupied || i === me) return;
        const c = characters[slot.characterIndex];
        const imgSrc = c.genders ? c.genders[slot.gender || 'male'].img : c.img;
        const cached = (window.characterImageCache?.[imgSrc] || {})[window.playerSlots[i].color];
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.dataset.color = window.playerSlots[i].color;
        chip.dataset.slotIndex = i;
        const img = document.createElement('img');
        img.src = cached || imgSrc;
        img.alt = c.name;
        chip.appendChild(img);
        colorizeChipImage(img, c, window.playerSlots[i].color);
        strip.appendChild(chip);
    });
}

export function updatePlayerChip(slotIndex, direction = 'fade') {
    if (!document.body.classList.contains('mobile-single-slot')) return;
    if (slotIndex === window.mySlotIndex) return;
    const chip = document.querySelector(`.player-chip[data-slot-index="${slotIndex}"]`);
    if (!chip) { renderPlayersStrip(); return; }
    const slot = window.playerSlots[slotIndex];
    const c = characters[slot.characterIndex];
    const src = c.genders ? c.genders[slot.gender || 'male'].img : c.img;
    const cached = (window.characterImageCache?.[src] || {})[slot.color];
    const oldImg = chip.querySelector('img');
    const newImg = document.createElement('img');
    newImg.src = cached || src; newImg.alt = c.name;
    chip.appendChild(newImg);
    colorizeChipImage(newImg, c, slot.color);
    if (direction === 'fade') newImg.style.opacity = '0';
    else newImg.classList.add(direction === 'right' ? 'slide-in-from-right' : 'slide-in-from-left');
    if (oldImg) {
        if (direction === 'fade') {
            oldImg.style.transition = 'opacity 500ms ease-in-out';
            oldImg.style.opacity = '0';
            newImg.style.transition = 'opacity 500ms ease-in-out';
            requestAnimationFrame(()=>requestAnimationFrame(()=>newImg.style.opacity='1'));
        } else {
            oldImg.classList.add(direction === 'right' ? 'slide-out-to-left' : 'slide-out-to-right');
        }
        setTimeout(()=>{ oldImg.remove(); newImg.style.opacity=''; newImg.classList.remove('slide-in-from-left','slide-in-from-right'); }, 500);
    }
    try { playSound(stoneShiftBuffer); } catch(e) {}
}

function colorizeChipImage(img, character, colorName) {
    const cached = (window.characterImageCache?.[(character.genders ? character.genders[(window.playerSlots.find(s=>s.color===colorName)?.gender || 'male')]?.img : character.img)] || {})[colorName];
    if (cached) { img.src = cached; return; }
    processAndCacheImage(img, character, colorName).then(blobUrl => {
        if (blobUrl) {
            img.src = blobUrl;
            img.dataset.blobUrl = blobUrl;
        } else {
            const targetHue = slotColors[colorName];
            const angle = targetHue - character.baseHue;
            img.style.filter = `hue-rotate(${angle}deg)`;
        }
    });
}