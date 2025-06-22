import * as THREE from 'three'; // Make sure THREE is imported

// Configuration
const ENABLE_LOCAL_VOICE_PLAYBACK = false; // Set to true to hear your own voice spatially (for testing)

export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {}; // For simple, non-spatial sounds if needed later
        this.audioListener = null;
        this.genericTalkSoundBuffer = null;
        this.spatialTalkingSounds = {}; // { playerId: THREE.PositionalAudio }

        // Defer audio context and listener creation until explicitly initialized
        // this.initialize(); // Call this from GameCore after user interaction potentially
    }
    
    async initialize(camera) { // Accept camera for listener
        if (this.audioContext && this.audioListener) return; // Already initialized

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioListener = new THREE.AudioListener();
            if (camera && typeof camera.add === 'function') {
                camera.add(this.audioListener); // Attach listener to the game camera
                console.log("AudioManager: AudioListener attached to camera.");
            } else {
                console.warn("AudioManager: Camera not provided or invalid during initialization. AudioListener not attached.");
            }
            this.loadGenericTalkSound();
        } catch (e) {
            console.warn('Audio context or listener initialization failed:', e);
        }
    }

    loadGenericTalkSound() {
        if (!this.audioContext) { // AudioContext needed for AudioLoader
            console.warn("AudioManager: AudioContext not available. Cannot load talk sound.");
            return;
        }
        const loader = new THREE.AudioLoader();
        loader.load(
            'generic_talking_loop.ogg', // Placeholder path
            (buffer) => {
                this.genericTalkSoundBuffer = buffer;
                console.log("AudioManager: Generic talking loop sound loaded.");
            },
            undefined, // onProgress callback
            (err) => {
                console.error('AudioManager: Error loading generic_talking_loop.ogg:', err);
            }
        );
    }

    setPlayerSpatialTalkingSound(playerId, isSpeaking, playerMesh, isLocalPlayer = false) {
        if (isLocalPlayer && !ENABLE_LOCAL_VOICE_PLAYBACK) {
            // If it's the local player and local playback is disabled, ensure any existing sound for them is stopped.
            if (this.spatialTalkingSounds[playerId] && this.spatialTalkingSounds[playerId].isPlaying) {
                this.spatialTalkingSounds[playerId].stop();
            }
            return;
        }

        if (!this.audioListener) {
            console.warn("AudioManager: AudioListener not initialized. Cannot play spatial sound.");
            return;
        }

        if (isSpeaking) {
            if (!this.genericTalkSoundBuffer) {
                // console.warn("AudioManager: Generic talk sound not loaded yet.");
                return;
            }
            if (!playerMesh) {
                // console.warn(`AudioManager: Cannot play spatial sound for ${playerId}, playerMesh not provided.`);
                return;
            }

            let sound = this.spatialTalkingSounds[playerId];
            if (!sound) {
                sound = new THREE.PositionalAudio(this.audioListener);
                sound.setBuffer(this.genericTalkSoundBuffer);
                sound.setLoop(true);
                sound.setRolloffFactor(2); // How quickly sound diminishes with distance
                sound.setRefDistance(1);   // Reference distance for rolloff
                sound.setDistanceModel('linear'); // Linear rolloff model, or 'inverse' or 'exponential'
                playerMesh.add(sound); // Attach PositionalAudio to the player's mesh
                this.spatialTalkingSounds[playerId] = sound;
                // console.log(`AudioManager: Created PositionalAudio for ${playerId}`);
            }

            if (!sound.isPlaying) {
                sound.play();
                // console.log(`AudioManager: Playing talking sound for ${playerId}`);
            }
        } else {
            if (this.spatialTalkingSounds[playerId] && this.spatialTalkingSounds[playerId].isPlaying) {
                this.spatialTalkingSounds[playerId].stop();
                // console.log(`AudioManager: Stopped talking sound for ${playerId}`);
            }
        }
    }
    
    // PlaySound is now for non-spatial, simple sounds. Positional audio is handled by setPlayerSpatialTalkingSound.
    playSound(soundType, position) { // Position can be THREE.Vector3 for potential future spatial one-shots
        console.log(`Playing sound: ${soundType}` + (position ? ` at ${position.x},${position.y},${position.z}` : ''));
        
        // Visual feedback for sounds with enhanced variety
        if (soundType === 'shoot') {
            this.addScreenFlash('#00ffff', 50);
        } else if (soundType === 'silenced_shot') {
            this.addScreenFlash('#004444', 30);
        } else if (soundType === 'collect') {
            this.addScreenFlash('#ffff00', 200);
        } else if (soundType === 'deliver') {
            this.addScreenFlash('#00ff00', 300);
        } else if (soundType === 'teleport') {
            this.addScreenFlash('#ff00ff', 150);
        } else if (soundType === 'buff_acquired') {
            this.addScreenFlash('#00ff88', 250);
        } else if (soundType === 'distant_shot') {
            this.addScreenFlash('#002244', 25);
        } else if (soundType === 'fragment_ping') {
            console.log("Fragment Ping sound triggered!");
            this.addScreenFlash('rgba(0,150,255,0.2)', 500);
        } else if (soundType === 'random_explosion') {
            console.log("Random explosion sound triggered!");
            this.addScreenFlash('rgba(255,120,0,0.3)', 400);
        } else if (soundType === 'hallucination_spawn') {
            console.log("Hallucination spawn sound triggered!");
            this.addScreenFlash('rgba(120,0,120,0.2)', 700);
        } else if (soundType === 'mutation_level_1_start') {
            console.log("Mutation Level 1 sound triggered!");
            this.addScreenFlash('rgba(100,0,100,0.1)', 1000);
        } else if (soundType === 'mutation_level_2_start') {
            console.log("Mutation Level 2 sound triggered!");
            this.addScreenFlash('rgba(150,0,150,0.2)', 1500);
        } else if (soundType === 'mutation_end') {
            console.log("Mutation end sound triggered!");
            this.addScreenFlash('rgba(200,200,255,0.1)', 500);
        } else if (soundType === 'local_hallucination_whisper') {
            console.log("Local hallucination whisper sound triggered!");
        } else if (soundType === 'gravity_glitch_start_sound' || soundType === 'summon_echo_sound' || soundType === 'swap_effect_sound' || soundType === 'confessional_saved' ) {
             // These are new sounds, just log for now, flashes can be added if desired.
             console.log(`${soundType} triggered.`);
        }
    }
    
    addScreenFlash(color, duration) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            opacity: 0.3;
            pointer-events: none;
            z-index: 1000;
        `;
        
        document.body.appendChild(flash);
        
        setTimeout(() => {
            if (flash.parentNode) {
                flash.parentNode.removeChild(flash);
            }
        }, duration);
    }
}