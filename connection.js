// Networking and connection management, extracted from ui.js and main.js
import { initializeAudio } from './audio.js';
import { playerSlots, connections, peer, isHost, mySlotIndex, gameMode, peerId } from './main.js';
import { characters, updateCharacterSlot } from './characters.js';
import { updateCharacterSlotsUI } from './main.js';
import { updateMobileSlotPicker, applyMobileSingleSlotMode, updatePlayerChip } from './mobile-ui.js';

// From ui.js
export function initializeStartOverlay() {
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
    window.gameMode = 'scan';
    window.isHost = true;
    
    // Hide start overlay
    document.getElementById('start-overlay').classList.add('hidden');
    
    // Show mini QR code in top right
    document.getElementById('host-qr-display').classList.add('visible');
    
    // Initialize audio
    initializeAudio();
    
    console.log('Started Scan to Play mode as host with ID:', window.peerId);
    window.mySlotIndex = 0;
    
    // Update the UI to show empty slots correctly
    updateCharacterSlotsUI();

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
    window.isHost = false;
    
    const conn = window.peer.connect(hostId);
    
    conn.on('open', () => {
        console.log('Connected to host:', hostId);
        window.connections = [conn]; // Client only has one connection (to host)
        
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
            window.playerSlots = data.playerSlots;
            updateCharacterSlotsUI(); // Full sync on first join
            window.mySlotIndex = data.slot;
            applyMobileSingleSlotMode();
            break;
            
        case 'player_slots_update':
            // Used for players joining/leaving
            window.playerSlots = data.playerSlots;
            updateCharacterSlotsUI();
            updateMobileSlotPicker();
            break;
            
        case 'character_change':
            if (slotElement) {
                window.playerSlots[data.slotIndex].characterIndex = data.characterIndex;
                updateCharacterSlot(slotElement, characters[data.characterIndex], data.direction);
            }
            updatePlayerChip(data.slotIndex, data.direction);
            break;
            
        case 'gender_change':
            if (slotElement) {
                window.playerSlots[data.slotIndex].gender = data.gender;
                slotElement.dataset.archerGender = data.gender;
                slotElement.querySelectorAll('.gender-toggle').forEach(t => {
                    t.classList.toggle('active', t.dataset.gender === data.gender);
                });
                updateCharacterSlot(slotElement, characters[window.playerSlots[data.slotIndex].characterIndex], 'fade');
            }
            updatePlayerChip(data.slotIndex, 'fade');
            break;
    }
}

// From main.js
export function initializePeerJS() {
    window.peer = new Peer();
    
    window.peer.on('open', (id) => {
        window.peerId = id;
        console.log('PeerJS initialized with ID:', id);
        generateHostQRCodes(id);
    });

    window.peer.on('connection', (conn) => {
        console.log('Incoming connection:', conn.peer);
        handleIncomingConnection(conn);
    });

    window.peer.on('error', (error) => {
        console.error('PeerJS error:', error);
    });
}

export function generateHostQRCodes(id) {
    // Generate mini QR code for in-game display
    new QRious({
        element: document.getElementById('mini-qr-code'),
        value: id,
        size: 80,
        foreground: '#ffffff',
        background: 'transparent'
    });

    // Generate fullscreen QR code
    new QRious({
        element: document.getElementById('fullscreen-qr-code'),
        value: id,
        size: Math.min(window.innerWidth, window.innerHeight) * 0.6,
        foreground: '#ffffff',
        background: 'transparent',
        padding: 20
    });

    // Display the Peer ID text
    document.getElementById('peer-id-display').textContent = id;
}

export function handleIncomingConnection(conn) {
    window.connections.push(conn);
    
    conn.on('open', () => {
        console.log('Connection established with:', conn.peer);
        
        // Assign player to available slot
        const availableSlot = window.playerSlots.find(slot => !slot.occupied);
        if (availableSlot) {
            availableSlot.occupied = true;
            availableSlot.playerId = conn.peer;
            
            // Send slot assignment to new player
            conn.send({
                type: 'slot_assignment',
                slot: window.playerSlots.indexOf(availableSlot),
                playerSlots: window.playerSlots
            });
            
            // Broadcast updated player slots to all clients
            broadcastToClients({
                type: 'player_slots_update',
                playerSlots: window.playerSlots
            });
            
            updateCharacterSlotsUI();
        }
    });

    conn.on('data', (data) => {
        handleClientMessage(conn, data);
    });

    conn.on('close', () => {
        console.log('Connection closed:', conn.peer);
        removePlayer(conn.peer);
    });
}

export function sendToHost(message) {
    // Client function to send data to the host
    if (!window.isHost && window.connections.length > 0 && window.connections[0].open) {
        window.connections[0].send(message);
    }
}

function handleClientMessage(conn, data) {
    const playerSlot = window.playerSlots.find(slot => slot.playerId === conn.peer);
    if (!playerSlot) {
        console.warn('Received message from unassigned player:', conn.peer);
        return;
    }
    const slotIndex = window.playerSlots.indexOf(playerSlot);
    const oldCharacterIndex = playerSlot.characterIndex;

    switch (data.type) {
        case 'character_change':
            if (slotIndex === data.slotIndex) { // Security check
                playerSlot.characterIndex = data.characterIndex;
                
                // Broadcast the updated state to all clients
                broadcastToClients({
                    type: 'character_change',
                    slotIndex: slotIndex,
                    characterIndex: data.characterIndex,
                    direction: data.direction
                });
                
                // Also update host's UI with animation
                const slotElement = document.querySelector(`.character-slot[data-player="${slotIndex + 1}"]`);
                if (slotElement) {
                    updateCharacterSlot(slotElement, characters[data.characterIndex], data.direction);
                }
            }
            break;
        case 'gender_change':
             if (slotIndex === data.slotIndex) { // Security check
                playerSlot.gender = data.gender;
                
                // Broadcast the updated state to all clients
                broadcastToClients({
                    type: 'gender_change',
                    slotIndex: slotIndex,
                    gender: data.gender
                });
                
                // Also update host's UI with animation
                const slotElement = document.querySelector(`.character-slot[data-player="${slotIndex + 1}"]`);
                if (slotElement) {
                     // The gender property is already updated in playerSlots array.
                     // updateCharacterSlot will read from the dataset which we update before calling.
                     slotElement.dataset.archerGender = data.gender;
                     updateCharacterSlot(slotElement, characters[playerSlot.characterIndex], 'fade');
                }
            }
            break;
        case 'slot_switch':
            hostAssignClientToSlot(conn.peer, data.targetIndex);
            break;
    }
}

export function broadcastToClients(message) {
    window.connections.forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function removePlayer(playerId) {
    const slot = window.playerSlots.find(slot => slot.playerId === playerId);
    if (slot) {
        slot.occupied = false;
        slot.playerId = null;
        
        broadcastToClients({
            type: 'player_slots_update',
            playerSlots: window.playerSlots
        });
        
        updateCharacterSlotsUI();
    }
    
    window.connections = window.connections.filter(conn => conn.peer !== playerId);
}

function hostAssignClientToSlot(peerIdToMove, targetIndex) {
    const target = window.playerSlots[targetIndex];
    if (!target || target.occupied) return;
    const current = window.playerSlots.find(s => s.playerId === peerIdToMove);
    if (!current) return;
    target.occupied = true; target.playerId = peerIdToMove; target.characterIndex = current.characterIndex; target.gender = current.gender;
    current.occupied = false; current.playerId = null;
    broadcastToClients({ type: 'player_slots_update', playerSlots: window.playerSlots });
    const conn = window.connections.find(c => c.peer === peerIdToMove);
    if (conn && conn.open) {
        conn.send({ type: 'slot_assignment', slot: targetIndex, playerSlots: window.playerSlots });
    }
    updateCharacterSlotsUI();
}

export function hostSwitchToSlot(targetIndex) {
    if (!window.isHost) return;
    const target = window.playerSlots[targetIndex];
    if (!target || target.occupied) return;
    const prevIndex = window.mySlotIndex;
    const current = window.playerSlots[window.mySlotIndex];
    target.occupied = true; target.playerId = 'host'; target.characterIndex = current.characterIndex; target.gender = current.gender;
    current.occupied = false; current.playerId = null;
    window.mySlotIndex = targetIndex;
    window.suppressUIAnimationOnce = true;
    broadcastToClients({ type: 'player_slots_update', playerSlots: window.playerSlots });
    updateCharacterSlotsUI();
    const prevEl = document.querySelector(`.character-slot[data-player="${prevIndex + 1}"]`);
    if (prevEl) {
        prevEl.classList.add('empty');
        const wrap = prevEl.querySelector('.character-image-wrapper');
        wrap && wrap.querySelectorAll('.character-image').forEach(img => { if (img.dataset.blobUrl) URL.revokeObjectURL(img.dataset.blobUrl); img.remove(); });
        // add skull overlay to the slot we vacated
        if (wrap && !prevEl.querySelector('.skull-overlay')) {
            const skull = document.createElement('div');
            skull.className = 'skull-overlay';
            skull.innerHTML = '<img src="/skull.png" alt="Empty Slot">';
            wrap.appendChild(skull);
        }
    }
    const targetEl = document.querySelector(`.character-slot[data-player="${targetIndex + 1}"]`);
    if (targetEl) {
        const twrap = targetEl.querySelector('.character-image-wrapper');
        if (twrap) twrap.querySelectorAll('.character-image').forEach(img => { if (img.dataset.blobUrl) URL.revokeObjectURL(img.dataset.blobUrl); img.remove(); });
        const skull = targetEl.querySelector('.skull-overlay');
        if (skull) {
            skull.classList.add('slide-out-to-left');
            setTimeout(() => { skull.remove(); targetEl.classList.remove('empty'); updateCharacterSlot(targetEl, characters[target.characterIndex], 'right'); }, 500);
        } else {
            targetEl.classList.remove('empty');
            updateCharacterSlot(targetEl, characters[target.characterIndex], 'right');
        }
    }
    applyMobileSingleSlotMode();
}