// Main initialization and coordination
// removed character data - now in characters.js
// removed WebAudio setup and sound functions - now in audio.js  
// removed color shader functions - now in color-shader.js
// removed updateCharacterSlot() function - now in characters.js
// removed initializeCharacterSelection() function - now in ui.js
// removed forceLandscape() function - now in mobile.js
// removed initializeStartOverlay() function - now in ui.js
// removed initializeRelicCursor() function - now in cursor.js
// removed preprocessCharacters() function - now in characters.js

let preprocessPromise = null;
let peer = null;
let peerId = null;
let connections = [];
let isHost = false;
let gameMode = null; // 'scan' or 'realtime'
let mySlotIndex = 0; // This will now dynamically update for clients
let playerSlots = [
    { occupied: true, color: 'blue', characterIndex: 0, playerId: 'host', gender: 'male' }, // Player 1 (host)
    { occupied: false, color: 'green', characterIndex: 1, playerId: null, gender: 'male' }, // Player 2
    { occupied: false, color: 'yellow', characterIndex: 2, playerId: null, gender: 'male' }, // Player 3
    { occupied: false, color: 'red', characterIndex: 3, playerId: null, gender: 'male' }  // Player 4
];

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    initializeMobile(); // Changed from forceLandscape()
    initializeRelicCursor();
    
    // Preload all character images before doing anything else
    await preloadAllCharacterImages();

    // Hide preloader
    const preloader = document.getElementById('preloader');
    preloader.classList.add('hidden');

    // Initialize networking
    initializePeerJS();
    
    // Now initialize the rest of the app
    initializeCharacterSelection();
    initializeStartOverlay();

    // Initialize UI for slot switching states
    updateCharacterSlotsUI();
});

function initializePeerJS() {
    peer = new Peer();
    
    peer.on('open', (id) => {
        peerId = id;
        console.log('PeerJS initialized with ID:', id);
        generateHostQRCodes(id);
    });

    peer.on('connection', (conn) => {
        console.log('Incoming connection:', conn.peer);
        handleIncomingConnection(conn);
    });

    peer.on('error', (error) => {
        console.error('PeerJS error:', error);
    });
}

function generateHostQRCodes(id) {
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

function handleIncomingConnection(conn) {
    connections.push(conn);
    
    conn.on('open', () => {
        console.log('Connection established with:', conn.peer);
        
        // Assign player to available slot
        const availableSlot = playerSlots.find(slot => !slot.occupied);
        if (availableSlot) {
            availableSlot.occupied = true;
            availableSlot.playerId = conn.peer;
            
            // Send slot assignment to new player
            conn.send({
                type: 'slot_assignment',
                slot: playerSlots.indexOf(availableSlot),
                playerSlots: playerSlots
            });
            
            // Broadcast updated player slots to all clients
            broadcastToClients({
                type: 'player_slots_update',
                playerSlots: playerSlots
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

function requestSlotChange(fromIndex, toIndex) {
    if (isHost) {
        handleSlotChange(peerId, fromIndex, toIndex);
    } else {
        sendToHost({ type: 'request_slot_change', from: fromIndex, to: toIndex });
    }
}

function handleSlotChange(requestingPlayerId, fromIndex, toIndex) {
    // This function must only run on the host
    if (!isHost) return;

    const fromSlot = playerSlots[fromIndex];
    const toSlot = playerSlots[toIndex];
    const actualPlayerId = requestingPlayerId === peerId ? 'host' : requestingPlayerId;

    // --- Validation ---
    // 1. Is the target slot available?
    if (toSlot.occupied) {
        console.warn(`Slot change denied: Target slot ${toIndex} is already occupied.`);
        return;
    }
    // 2. Does the 'from' slot actually belong to the player requesting the change?
    if (fromSlot.playerId !== actualPlayerId) {
        console.warn(`Slot change denied: Player ${actualPlayerId} does not own slot ${fromIndex}.`);
        // This could be a sign of a desync or malicious client. A full sync could be sent back.
        return;
    }

    // --- Execution ---
    console.log(`Player ${actualPlayerId} switching from slot ${fromIndex} to ${toIndex}`);
    
    // Copy data to new slot
    toSlot.occupied = true;
    toSlot.playerId = fromSlot.playerId;
    toSlot.characterIndex = fromSlot.characterIndex;
    toSlot.gender = fromSlot.gender;

    // Clear old slot
    fromSlot.occupied = false;
    fromSlot.playerId = null;
    // We can leave characterIndex/gender as is, it will be overwritten if someone takes the slot.

    // Notify all players of the new state
    broadcastToClients({
        type: 'player_slots_update',
        playerSlots: playerSlots
    });
    
    // Update host's own UI
    if (actualPlayerId === 'host') {
        mySlotIndex = toIndex;
        if (document.body.classList.contains('mobile-single-slot')) {
            applyMobileSingleSlotMode();
        }
    }
    updateCharacterSlotsUI();
    updateMobileColorSwitcher();
}

function sendToHost(message) {
    // Client function to send data to the host
    if (!isHost && connections.length > 0 && connections[0].open) {
        connections[0].send(message);
    }
}

function handleClientMessage(conn, data) {
    const playerSlot = playerSlots.find(slot => slot.playerId === conn.peer);
    if (!playerSlot) {
        console.warn('Received message from unassigned player:', conn.peer);
        return;
    }
    const slotIndex = playerSlots.indexOf(playerSlot);
    const oldCharacterIndex = playerSlot.characterIndex;

    switch (data.type) {
        case 'request_slot_change':
            handleSlotChange(conn.peer, data.from, data.to);
            break;
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
    }
}

function broadcastToClients(message) {
    connections.forEach(conn => {
        if (conn.open) {
            conn.send(message);
        }
    });
}

function removePlayer(playerId) {
    const slot = playerSlots.find(slot => slot.playerId === playerId);
    if (slot) {
        slot.occupied = false;
        slot.playerId = null;
        
        broadcastToClients({
            type: 'player_slots_update',
            playerSlots: playerSlots
        });
        
        updateCharacterSlotsUI();
        updateMobileColorSwitcher();
    }
    
    connections = connections.filter(conn => conn.peer !== playerId);
}

function updateCharacterSlotsUI() {
    const slots = document.querySelectorAll('.character-slot');
    slots.forEach((slot, index) => {
        const playerSlot = playerSlots[index];
        const currentCharacterIndex = parseInt(slot.dataset.characterIndex, 10);
        const currentGender = slot.dataset.archerGender;
        const myId = isHost ? 'host' : peerId;
        const isMySlot = playerSlot.playerId === myId;
        const overlay = slot.querySelector('.slot-overlay');
        
        // Clear previous state classes
        slot.classList.remove('empty', 'occupied-by-other', 'my-slot');
        if (overlay) overlay.textContent = '';
        overlay.style.display = 'none';

        if (playerSlot.occupied) {
            if (isMySlot) {
                slot.classList.add('my-slot');
            } else {
                slot.classList.add('occupied-by-other');
                if (overlay) {
                    overlay.textContent = 'X';
                    overlay.style.display = 'flex';
                }
            }
            
            let characterChanged = playerSlot.characterIndex !== currentCharacterIndex;
            let genderChanged = false;
            if (characters[playerSlot.characterIndex].genders) {
                genderChanged = playerSlot.gender !== currentGender;
            }

            // Only update if there's a change
            if (characterChanged || genderChanged) {
                 // The 'fade' direction is a sensible default for general state updates.
                 // More specific animation directions are handled by 'character_change' and 'gender_change' events.
                updateCharacterSlot(slot, characters[playerSlot.characterIndex], 'fade');
            }
            
            // Always ensure data attributes are in sync, even if no visual update is needed right now.
            slot.dataset.characterIndex = playerSlot.characterIndex;
            if (characters[playerSlot.characterIndex].genders) {
                slot.dataset.archerGender = playerSlot.gender;
                const genderContainer = slot.querySelector('.gender-toggle-container');
                genderContainer.style.visibility = 'visible';
                genderContainer.querySelectorAll('.gender-toggle').forEach(t => {
                    t.classList.toggle('active', t.dataset.gender === playerSlot.gender);
                });
            } else {
                 slot.querySelector('.gender-toggle-container').style.visibility = 'hidden';
            }

        } else {
            slot.classList.add('empty');
            if (overlay && !document.body.classList.contains('mobile')) {
                overlay.textContent = 'SWITCH';
                overlay.style.display = 'flex';
            }
        }
    });
    if (typeof renderPlayersStrip === 'function') renderPlayersStrip();
}