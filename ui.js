// UI interaction management
import { characters } from './characters.js';
import { applyColorShader } from './color-shader.js';
import { updateCharacterSlot } from './characters.js';
import { broadcastToClients, sendToHost, hostSwitchToSlot } from './connection.js';

export function initializeCharacterSelection() {
    const characterSlots = document.querySelectorAll('.character-slot');

    characterSlots.forEach((slot, index) => {
        // Initial setup
        const slotData = window.playerSlots[index];
        if (!slotData.occupied) {
            slot.classList.add('empty');
            // ensure skull overlay exists for empty slots on load
            if (!slot.querySelector('.skull-overlay')) {
                const wrap = slot.querySelector('.character-image-wrapper');
                const skull = document.createElement('div');
                skull.className = 'skull-overlay';
                skull.innerHTML = '<img src="/skull.png" alt="Empty Slot">';
                wrap.appendChild(skull);
            }
        }

        // Initial gender setup for archer
        if(slot.dataset.characterIndex === '1') {
            slot.dataset.archerGender = 'male';
            slot.querySelector('.gender-toggle-container').style.visibility = 'visible';
        }

        // Initial color shader application
        applyColorShader(slot);

        // Arrow click listeners for character swapping (only for host or own slot)
        const leftArrow = slot.querySelector('.left-arrow');
        const rightArrow = slot.querySelector('.right-arrow');

        leftArrow.addEventListener('click', () => {
            if (!canControlSlot(index)) return;
            
            let currentIndex = parseInt(slot.dataset.characterIndex, 10);
            currentIndex = (currentIndex - 1 + characters.length) % characters.length;
            
            if (window.isHost) {
                updateCharacterSlot(slot, characters[currentIndex], 'left');
                window.playerSlots[index].characterIndex = currentIndex;
                broadcastToClients({ type: 'character_change', slotIndex: index, characterIndex: currentIndex, direction: 'left' });
            } else {
                slot.querySelectorAll('.arrow, .gender-toggle').forEach(el => el.disabled = true);
                sendToHost({ type: 'character_change', slotIndex: index, characterIndex: currentIndex, direction: 'left' });
            }
        });

        rightArrow.addEventListener('click', () => {
            if (!canControlSlot(index)) return;
            
            let currentIndex = parseInt(slot.dataset.characterIndex, 10);
            currentIndex = (currentIndex + 1) % characters.length;
            
            if (window.isHost) {
                updateCharacterSlot(slot, characters[currentIndex], 'right');
                window.playerSlots[index].characterIndex = currentIndex;
                broadcastToClients({ type: 'character_change', slotIndex: index, characterIndex: currentIndex, direction: 'right' });
            } else {
                slot.querySelectorAll('.arrow, .gender-toggle').forEach(el => el.disabled = true);
                sendToHost({ type: 'character_change', slotIndex: index, characterIndex: currentIndex, direction: 'right' });
            }
        });

        // Gender toggle listeners
        const genderToggles = slot.querySelectorAll('.gender-toggle');
        genderToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                if (!canControlSlot(index)) return;
                
                const newGender = toggle.dataset.gender;
                if (slot.dataset.archerGender === newGender) return; // No change

                if (window.isHost) {
                    slot.dataset.archerGender = newGender;
                    genderToggles.forEach(t => t.classList.toggle('active', t.dataset.gender === newGender));
                    updateCharacterSlot(slot, characters[parseInt(slot.dataset.characterIndex, 10)], 'fade');
                    window.playerSlots[index].gender = newGender;
                    broadcastToClients({ type: 'gender_change', slotIndex: index, gender: newGender });
                } else {
                    slot.querySelectorAll('.arrow, .gender-toggle').forEach(el => el.disabled = true);
                    sendToHost({ type: 'gender_change', slotIndex: index, gender: newGender });
                }
            });
        });

        // Desktop: click empty slot to switch into it
        slot.addEventListener('click', () => {
            const finePointer = window.matchMedia('(pointer: fine)').matches;
            if (!finePointer) return;
            if (window.playerSlots[index]?.occupied) return;
            requestSlotSwitch(index);
        });
    });
    setupMobileSlotPicker();
}

function setupMobileSlotPicker() {
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

function updateMobileSlotPicker() {
    const picker = document.getElementById('mobile-slot-picker');
    if (!picker) return;
    picker.querySelectorAll('.slot-pill').forEach(btn => {
        const idx = parseInt(btn.dataset.slot, 10);
        btn.classList.toggle('occupied', !!window.playerSlots[idx]?.occupied);
    });
}

function canControlSlot(slotIndex) {
    // Host can control any slot; clients only their assigned slot.
    const slotData = window.playerSlots[slotIndex];
    if (window.isHost) return true;
    return slotData.occupied && slotData.playerId === window.peerId;
}

function requestSlotSwitch(targetIndex) {
    if (window.isHost) {
        hostSwitchToSlot(targetIndex);
    } else {
        sendToHost({ type: 'slot_switch', targetIndex });
    }
}