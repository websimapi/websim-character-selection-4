// UI interaction management
function initializeCharacterSelection() {
    const characterSlots = document.querySelectorAll('.character-slot');

    characterSlots.forEach((slot, index) => {
        // Initial setup
        const slotData = playerSlots[index];
        if (!slotData.occupied) {
            slot.classList.add('empty');
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
            
            if (isHost) {
                updateCharacterSlot(slot, characters[currentIndex], 'left');
                playerSlots[index].characterIndex = currentIndex;
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
            
            if (isHost) {
                updateCharacterSlot(slot, characters[currentIndex], 'right');
                playerSlots[index].characterIndex = currentIndex;
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

                if (isHost) {
                    slot.dataset.archerGender = newGender;
                    genderToggles.forEach(t => t.classList.toggle('active', t.dataset.gender === newGender));
                    updateCharacterSlot(slot, characters[parseInt(slot.dataset.characterIndex, 10)], 'fade');
                    playerSlots[index].gender = newGender;
                    broadcastToClients({ type: 'gender_change', slotIndex: index, gender: newGender });
                } else {
                    slot.querySelectorAll('.arrow, .gender-toggle').forEach(el => el.disabled = true);
                    sendToHost({ type: 'gender_change', slotIndex: index, gender: newGender });
                }
            });
        });
    });
}

function canControlSlot(slotIndex) {
    // Host can only control their slot (index 0).
    // Clients can only control their assigned slot.
    const slotData = playerSlots[slotIndex];

    if (isHost) {
        return slotIndex === 0;
    } else {
        return slotData.occupied && slotData.playerId === peerId;
    }
}

// Set up the start overlay
function initializeStartOverlay() {
    const startOverlay = document.getElementById('start-overlay');
    const hostBtn = document.getElementById('host-btn');
    const scanBtn = document.getElementById('scan-qr-btn');
    const joinInput = document.getElementById('join-id-input');
    const realtimeBtn = document.getElementById('realtime-mode-btn');
    
    hostBtn.addEventListener('click', () => {
        if (peerId) {
            startHosting();
        } else {
            console.log('PeerJS not ready yet');
            alert('Connection service is not ready, please wait a moment.');
        }
    });

    scanBtn.addEventListener('click', () => {
        if (peerId) {
            startCameraScanner();
        } else {
            console.log('PeerJS not ready yet');
            alert('Connection service is not ready, please wait a moment.');
        }
    });

    joinInput.addEventListener('click', async () => {
        if (peerId && navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
            try {
                // This may trigger a browser permission prompt
                const clipboardText = await navigator.clipboard.readText();
                const trimmedText = clipboardText.trim();
                // Basic check for a plausible ID (not empty)
                if (trimmedText.length > 3) {
                    joinInput.value = trimmedText;
                    joinGame(trimmedText);
                }
            } catch (err) {
                console.warn('Could not read from clipboard or permission denied:', err.name);
                // Fail silently, user can still type manually.
            }
        }
    });

    joinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const hostId = joinInput.value.trim();
            if (hostId) {
                joinGame(hostId);
            } else {
                alert('Please enter a valid join code.');
            }
        }
    });

    realtimeBtn.addEventListener('click', () => {
        // Disabled for now
        console.log('Realtime mode not implemented yet');
    });

    const qrOverlay = document.getElementById('qr-code-overlay');
    const closeQrBtn = document.getElementById('close-qr-overlay');
    const copyIdBtn = document.getElementById('copy-id-btn');
    const peerIdSpan = document.getElementById('peer-id-display');

    closeQrBtn.addEventListener('click', () => {
        qrOverlay.classList.add('hidden');
    });

    copyIdBtn.addEventListener('click', () => {
        const hostId = peerIdSpan.textContent;
        if (hostId && navigator.clipboard) {
            navigator.clipboard.writeText(hostId).then(() => {
                const originalText = copyIdBtn.textContent;
                copyIdBtn.textContent = 'Copied!';
                copyIdBtn.disabled = true;
                setTimeout(() => {
                    copyIdBtn.textContent = originalText;
                    copyIdBtn.disabled = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy ID: ', err);
                alert('Could not copy ID to clipboard.');
            });
        }
    });

    // Add listener for mini QR code to show fullscreen overlay
    const hostQrDisplay = document.getElementById('host-qr-display');
    hostQrDisplay.addEventListener('click', () => {
        if (isHost) {
            qrOverlay.classList.remove('hidden');
        }
    });
}

function startHosting() {
    gameMode = 'scan';
    isHost = true;
    
    // Hide start overlay
    document.getElementById('start-overlay').classList.add('hidden');
    
    // Show mini QR code in top right
    document.getElementById('host-qr-display').classList.add('visible');
    
    // Initialize audio
    initializeAudio();
    
    console.log('Started Scan to Play mode as host with ID:', peerId);
    mySlotIndex = 0;
    applyMobileSingleSlotMode();
}

async function startCameraScanner() {
    const cameraOverlay = document.getElementById('camera-scanner');
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d');
    const closeBtn = document.getElementById('close-camera');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' } // Use back camera if available
        });
        
        video.srcObject = stream;
        cameraOverlay.classList.remove('hidden');
        
        // Scanning loop
        const scanLoop = () => {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                
                if (code && code.data) {
                    console.log('QR Code detected:', code.data);
                    joinGame(code.data);
                    stopCameraScanner(stream);
                    return;
                }
            }
            
            requestAnimationFrame(scanLoop);
        };
        
        video.addEventListener('loadedmetadata', () => {
            scanLoop();
        });
        
        closeBtn.addEventListener('click', () => {
            stopCameraScanner(stream);
        }, { once: true });
        
    } catch (error) {
        console.error('Camera access failed:', error);
        alert('Camera access is required to scan QR codes');
    }
}

function stopCameraScanner(stream) {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    document.getElementById('camera-scanner').classList.add('hidden');
}

function joinGame(hostId) {
    console.log('Attempting to join game with host:', hostId);
    isHost = false;
    
    const conn = peer.connect(hostId);
    
    conn.on('open', () => {
        console.log('Connected to host:', hostId);
        connections = [conn]; // Client only has one connection (to host)
        
        // Hide start overlay
        document.getElementById('start-overlay').classList.add('hidden');
        
        // Initialize audio
        initializeAudio();
    });
    
    conn.on('data', (data) => {
        handleHostMessage(data);
    });
    
    conn.on('close', () => {
        console.log('Disconnected from host');
        // Could show reconnection UI here
    });
}

function handleHostMessage(data) {
    const slotElement = document.querySelector(`.character-slot[data-player="${data.slotIndex + 1}"]`);
    switch (data.type) {
        case 'slot_assignment':
            console.log('Assigned to slot:', data.slot);
            playerSlots = data.playerSlots;
            updateCharacterSlotsUI(); // Full sync on first join
            mySlotIndex = data.slot;
            applyMobileSingleSlotMode();
            break;
            
        case 'player_slots_update':
            // Used for players joining/leaving
            playerSlots = data.playerSlots;
            updateCharacterSlotsUI();
            break;
            
        case 'character_change':
            if (slotElement) {
                playerSlots[data.slotIndex].characterIndex = data.characterIndex;
                updateCharacterSlot(slotElement, characters[data.characterIndex], data.direction);
            }
            updatePlayerChip(data.slotIndex, data.direction);
            break;
            
        case 'gender_change':
            if (slotElement) {
                playerSlots[data.slotIndex].gender = data.gender;
                slotElement.dataset.archerGender = data.gender;
                slotElement.querySelectorAll('.gender-toggle').forEach(t => {
                    t.classList.toggle('active', t.dataset.gender === data.gender);
                });
                updateCharacterSlot(slotElement, characters[playerSlots[data.slotIndex].characterIndex], 'fade');
            }
            updatePlayerChip(data.slotIndex, 'fade');
            break;
    }
}

function applyMobileSingleSlotMode() {
    if (!document.body.classList.contains('mobile')) return;
    document.querySelectorAll('.character-slot').forEach((el, i) => {
        el.classList.toggle('own-slot', i === mySlotIndex);
    });
    document.body.classList.add('mobile-single-slot');
    renderPlayersStrip();
}
window.applyMobileSingleSlotMode = applyMobileSingleSlotMode;

function renderPlayersStrip() {
    const strip = document.getElementById('players-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const me = mySlotIndex;
    playerSlots.forEach((slot, i) => {
        if (!slot.occupied || i === me) return;
        const c = characters[slot.characterIndex];
        const imgSrc = c.genders ? c.genders[slot.gender || 'male'].img : c.img;
        const cached = (window.characterImageCache?.[imgSrc] || {})[playerSlots[i].color];
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.dataset.color = playerSlots[i].color;
        chip.dataset.slotIndex = i;
        const img = document.createElement('img');
        img.src = cached || imgSrc;
        img.alt = c.name;
        chip.appendChild(img);
        colorizeChipImage(img, c, playerSlots[i].color);
        strip.appendChild(chip);
    });
}

function updatePlayerChip(slotIndex, direction = 'fade') {
    if (!document.body.classList.contains('mobile-single-slot')) return;
    if (slotIndex === mySlotIndex) return;
    const chip = document.querySelector(`.player-chip[data-slot-index="${slotIndex}"]`);
    if (!chip) { renderPlayersStrip(); return; }
    const slot = playerSlots[slotIndex];
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
    const cached = (window.characterImageCache?.[(character.genders ? character.genders[(playerSlots.find(s=>s.color===colorName)?.gender || 'male')]?.img : character.img)] || {})[colorName];
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