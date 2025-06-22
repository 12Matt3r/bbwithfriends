import * as THREE from 'three';
import { Player } from './Player.js';
import { InputManager } from './InputManager.js';
import { Environment } from './Environment.js';
import { FragmentManager } from './FragmentManager.js';
import { ConsoleManager } from './ConsoleManager.js';
import { NetworkManager } from './NetworkManager.js';
import { UIManager } from './UIManager.js';
import { AudioManager } from './AudioManager.js';
import { TreasureMapManager } from './TreasureMapManager.js';
import { WeaponManager } from './WeaponManager.js';
import { GameState } from './GameState.js';
import { EffectsManager } from './EffectsManager.js';
import { LobbyManager } from './LobbyManager.js'; // Added LobbyManager import
import { StreamerDataManager } from './StreamerDataManager.js';
import { MatchStatsManager } from './MatchStatsManager.js';

// Define spawn points globally or at a scope accessible by relevant methods
const TEAM_ALPHA_SPAWN_POINTS = [
    { x: -50, y: 2, z: 0, facing: Math.PI / 2 }, // Facing towards center
    { x: -55, y: 2, z: 5, facing: Math.PI / 2 },
    { x: -55, y: 2, z: -5, facing: Math.PI / 2 }
];
const TEAM_BETA_SPAWN_POINTS = [
    { x: 50, y: 2, z: 0, facing: -Math.PI / 2 }, // Facing towards center
    { x: 55, y: 2, z: 5, facing: -Math.PI / 2 },
    { x: 55, y: 2, z: -5, facing: -Math.PI / 2 }
];
let alphaSpawnIndex = 0;
let betaSpawnIndex = 0;

const TEAM_ALPHA_BASE_CENTER = { x: -50, y: 2, z: 0 };
const TEAM_BETA_BASE_CENTER = { x: 50, y: 2, z: 0 };
const BASE_RADIUS = 10;
const BASE_RADIUS_SQUARED = BASE_RADIUS * BASE_RADIUS; // For cheaper distance checks
const SCORE_INTERVAL_SECONDS = 1.0; // How often to try and award points from accumulator

// Helper function for distance squared
function distanceSquared(pos1, pos2) {
    // Ensure pos1 is an object {x, y, z} if it's coming as an array [x,y,z] from presence
    const p1 = Array.isArray(pos1) ? {x: pos1[0], y: pos1[1], z: pos1[2]} : pos1;
    const p2 = Array.isArray(pos2) ? {x: pos2[0], y: pos2[1], z: pos2[2]} : pos2;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y; // Consider if y-distance should matter for base capture
    const dz = p1.z - p2.z;
    return dx * dx + dy * dy + dz * dz;
}

export class GameCore {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.player = new Player();
        this.player.setGameCore(this); // Give player a reference to GameCore
        this.gameState = new GameState();
        this.gameSettings = {
            SCORE_INTERVAL: 1000,
            fragmentCorruptionRadius: 7 // Added fragment corruption radius
        };
        
        // Managers
        this.inputManager = null;
        this.environment = null;
        this.fragmentManager = null;
        this.consoleManager = null;
        this.networkManager = null;
        this.uiManager = null;
        this.audioManager = null;
        this.treasureMapManager = null;
        this.weaponManager = null;
        this.effectsManager = null;
        this.lobbyManager = null; // Added LobbyManager instance
        this.streamerDataManager = null;
        this.matchStatsManager = null;
        
        /* @tweakable multiplayer player rendering system */
        this.otherPlayers = new Map(); // Store other player 3D representations
        
        this.lastTime = 0;
        this.lastScoreSync = null;
        
        // Enhanced chaos events with more variety
        this.chaosEvents = [
            { name: 'gravity_invert', duration: 15, cooldown: 60 },
            { name: 'no_reload', duration: 30, cooldown: 90 },
            { name: 'weapon_swap', duration: 20, cooldown: 120 },
            { name: 'speed_boost', duration: 10, cooldown: 45 },
            /* @tweakable additional chaos events for variety */
            { name: 'fog_vision', duration: 25, cooldown: 80 },
            { name: 'double_damage', duration: 15, cooldown: 100 },
            { name: 'infinite_ammo', duration: 20, cooldown: 70 }
        ];
        this.activeChaosEvent = null;
        this.nextChaosTime = 0;
        
        // Player buffs
        this.playerBuffs = {
            invisibility: { active: false, endTime: 0 },
            fastReload: { active: false, endTime: 0 },
            damageBoost: { active: false, endTime: 0 }
        };

        // Confessional Booth Zones (Example Data)
        this.confessionalBoothZones = [
            { id: 'booth_kelp_forest', center: new THREE.Vector3(-20, 1.5, -15), radius: 2.5 },
            { id: 'booth_jellyfish_fields', center: new THREE.Vector3(15, 1.5, 20), radius: 2.5 },
            { id: 'booth_goo_lagoon', center: new THREE.Vector3(30, 1.5, -5), radius: 2 }
        ];
        
        this.init();
    }
    
    async init() {
        this.uiManager = new UIManager(this); // UIManager needs gameCore for callbacks
        this.audioManager = new AudioManager();
        this.networkManager = new NetworkManager(this); // NetworkManager needs gameCore
        this.lobbyManager = new LobbyManager(this); // LobbyManager needs gameCore (for other managers)
        
        this.uiManager.showLoadingScreen();
        
        await this.initializeGraphics(); // Camera is created here
        // Initialize AudioManager with the camera AFTER the camera is created
        if (this.camera && this.audioManager && typeof this.audioManager.initialize === 'function') {
            await this.audioManager.initialize(this.camera);
        } else {
            console.error("GameCore: Failed to initialize AudioManager with camera. Camera or AudioManager not ready.");
            // Fallback or alternative initialization if needed, though camera is crucial for positional audio
            await this.audioManager.initialize(); // Attempt basic init if camera isn't there
        }
        await this.networkManager.initialize(); // Connect to network

        this.inputManager = new InputManager(this); // InputManager needs gameCore
        this.consoleManager = new ConsoleManager(this); // ConsoleManager needs gameCore
        this.streamerDataManager = new StreamerDataManager(this); // Instantiate StreamerDataManager
        this.matchStatsManager = new MatchStatsManager(this); // Instantiate MatchStatsManager

        // Initialization of LobbyManager AFTER other core managers it depends on (NM, UIM)
        this.lobbyManager.initialize();
        
        setTimeout(() => {
            this.uiManager.hideLoadingScreen();
            this.uiManager.showMainMenu(); // Show main menu first
            // Lobby screen will be shown when 'Join Game' is clicked (handled in UIManager)
        }, 3000);
    }

    // Called by UIManager when 'Join Game' on main menu is clicked (now transitions to lobby)
    // Or directly if we skip main menu for dev
    transitionToLobby() {
        this.uiManager.hideMainMenu();
        this.uiManager.showLobbyScreen();
        if (this.lobbyManager) {
            this.lobbyManager.requestFullLobbyStateSync(); // Ensure lobby UI is up-to-date
        }
    }

    // This method will be called by LobbyManager when all players are ready
    startGameFromLobby() {
        if (this.gameState.isGameStarted) return; // Prevent multiple starts

        this.gameState.isGameStarted = true;
        this.uiManager.hideLobbyScreen(); // Hide lobby

        // Set Chaos Influencer in GameState
        if (this.lobbyManager) {
            this.gameState.chaosInfluencerId = this.lobbyManager.chaosInfluencer;
            console.log("Starting game. Chaos Influencer is: ", this.gameState.chaosInfluencerId);
        } else {
            this.gameState.chaosInfluencerId = null;
            console.log("Starting game. LobbyManager not available, Chaos Influencer is null.");
        }

        this.uiManager.showGameUI();     // Show main game interface
        
        // Player setup based on lobby choices
        const localPlayerId = this.lobbyManager.getPlayerId();
        const localPlayerLobbyData = this.lobbyManager.lobbyPlayers[localPlayerId];

        let selectedClass = 'assault'; // Default
        if (localPlayerLobbyData) {
            if (localPlayerLobbyData.teamColor) {
                if (localPlayerLobbyData.teamColor === 'blue') this.player.team = 'alpha';
                else if (localPlayerLobbyData.teamColor === 'red') this.player.team = 'beta';
                else {
                    const teamKeys = Object.keys(this.networkManager.room?.peers || {});
                    const playerIndex = teamKeys.indexOf(localPlayerId);
                    this.player.team = playerIndex >= 0 && playerIndex % 2 === 0 ? 'alpha' : 'beta';
                }
            }
            selectedClass = localPlayerLobbyData.playerClass || 'assault';
        } else {
            const teamCount = Object.values(this.networkManager.room?.presence || {}).length;
            this.player.team = teamCount % 2 === 0 ? 'alpha' : 'beta';
        }
        this.player.setClass(selectedClass); // Set class, which also sets health, weapon type, ammo

        // UI Updates reflect the class changes made by player.setClass
        this.uiManager.updateScoreDisplay();
        this.uiManager.updateCorruptionDisplay();
        
        this.respawnPlayer(true); // Pass true for initial spawn
        
        // Request pointer lock for FPS controls
        this.requestPointerLock();
        
        // Start the game loop
        this.gameLoop();
        
        // Initialize team-based UI
        this.uiManager.updatePlayerList();
        
        // Sync initial presence
        this.networkManager.updatePresence(this.player.getPresenceData());

        // Spawn initial fragment - ideally, only one client (e.g., host) should do this.
        // For now, let first client (or any client if state is managed well) do it.
        // FragmentManager.spawnInitialFragment will call updateFragmentOnNetwork.
        if (this.fragmentManager) {
            this.fragmentManager.spawnInitialFragment();
        }
    }
    
    restartGame() {
        /* @tweakable game restart behavior */
        this.gameState.reset();
        if(this.effectsManager) this.effectsManager.stopAllTerrainCorruption(); // Stop corruption effects
        this.player.respawn(); // Resets health, ammo etc.
        if (this.fragmentManager) {
            // Ensure initial fragment is reset/spawned correctly, potentially removing old one
            this.fragmentManager.spawnInitialFragment();
        }
        this.uiManager.hideGameOver();
        this.uiManager.showMainMenu();
    }
    
    endGame(winningTeam) {
        /* @tweakable end game sequence and victory conditions */
        this.gameState.isGameStarted = false;
        if(this.effectsManager) this.effectsManager.stopAllTerrainCorruption(); // Stop corruption effects
        
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        
        this.uiManager.showGameOver(winningTeam, this.player.team, this.gameState.corruptionLevel); // This shows a simple game over message

        // Finalize local player's fragment hold time if they are holding it
        if (this.player.hasFragment && this.player.currentFragmentSessionStartTime > 0 && this.gameState) {
            const holdDuration = this.gameState.gameTime - this.player.currentFragmentSessionStartTime;
            this.player.totalTimeHoldingFragment += holdDuration;
            this.player.currentFragmentSessionStartTime = 0;
            // Note: We are not actually making the player drop the fragment here in terms of game mechanics,
            // just finalizing their stats as if the holding session ended now.
        }
        
        if (this.matchStatsManager) {
            const reasonText = winningTeam === "Corruption" ? "Corruption reached critical levels" : (winningTeam ? `Team ${winningTeam} wins` : "Unknown reason");
            this.matchStatsManager.addTimelineEvent(`Match Ended. ${reasonText}`, "game-end");
            this.matchStatsManager.compilePlayerStats();
            this.matchStatsManager.calculateSummaryStats();

            if (this.uiManager && typeof this.uiManager.showMatchSummaryScreen === 'function') {
                 // Ensure screenshot is taken before UI changes for summary screen
                try {
                    this.endGameScreenshotDataUrl = this.renderer.domElement.toDataURL('image/png');
                } catch (e) {
                    console.error("Error taking screenshot:", e);
                    this.endGameScreenshotDataUrl = null;
                }
                this.uiManager.showMatchSummaryScreen(this.gameState.matchStats, this.gameState.confessionalLogs);
            } else {
                console.warn("UIManager.showMatchSummaryScreen() not available.");
            }
        }

        // this.gameState.reset(); // Reset is called by UIManager when player clicks "Play Again" or similar from summary/gameover screen
                               // Or, if summary screen is modal ON TOP of game over, then reset happens after summary.
                               // For now, let's assume Game Over screen handles the actual game state reset trigger.
                               // The current showGameOver doesn't reset, restartGame does. endGame should ensure no new game actions.
    }
    
    getEndGameScreenshotDataUrl() {
        return this.endGameScreenshotDataUrl;
    }

    async initializeGraphics() {
        const canvas = document.getElementById('game-canvas');
        
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 20, 150);
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.copy(this.player.position);
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000011);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.physicallyCorrectLights = true;
        
        this.environment = new Environment(this.scene);
        await this.environment.create();
        
        this.treasureMapManager = new TreasureMapManager(this.scene, this.networkManager);
        this.environment.setTreasureMapManager(this.treasureMapManager);
        
        this.player.setEnvironment(this.environment);
        
        this.fragmentManager = new FragmentManager(this.scene, this.networkManager.room);
        this.fragmentManager.createFragment('center_fragment', { x: 0, y: 5, z: 0 });
        
        this.weaponManager = new WeaponManager(this.scene, this.camera, this.player, this.audioManager);
        await this.weaponManager.loadWeaponModel();
        
        this.effectsManager = new EffectsManager(this.scene, this.gameState, this.environment);
        
        // Initialize multiplayer player rendering
        this.initializeMultiplayerRendering();
        
        this.animate();
    }
    
    initializeMultiplayerRendering() {
        /* @tweakable multiplayer player model appearance */
        this.playerGeometry = new THREE.CapsuleGeometry(0.3, 1.4, 4, 8);
        this.createPlayerMaterials();
    }
    
    createPlayerMaterials() {
        /* @tweakable team colors for multiplayer player models */
        this.playerMaterials = {
            alpha: new THREE.MeshStandardMaterial({
                color: 0x00aaff,
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x004466,
                emissiveIntensity: 0.2
            }),
            beta: new THREE.MeshStandardMaterial({
                color: 0xff6600,
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x664400,
                emissiveIntensity: 0.2
            })
        };
    }
    
    createPlayerModel(playerId, playerData) {
        /* @tweakable multiplayer player model size for enhanced visibility */
        const playerModelScale = 1.5; // Increased from 1.2 for better visibility
        const playerGeometry = new THREE.CapsuleGeometry(0.5 * playerModelScale, 2.0 * playerModelScale, 4, 8); // Increased dimensions
        
        const teamMaterial = this.playerMaterials[playerData.team] || this.playerMaterials.alpha;
        /* @tweakable multiplayer player material properties for better visibility */
        const enhancedMaterial = teamMaterial.clone();
        enhancedMaterial.emissiveIntensity = 0.6; // Increased glow
        enhancedMaterial.metalness = 0.1; // Reduced metalness for better color visibility
        enhancedMaterial.roughness = 0.8; // Increased roughness for better diffuse lighting
        
        const playerMesh = new THREE.Mesh(playerGeometry, enhancedMaterial);
        playerMesh.userData = { playerId, type: 'player' };
        playerMesh.castShadow = true;
        playerMesh.receiveShadow = true;
        
        // Create username label above player
        const usernameSprite = this.createUsernameSprite(this.networkManager.room.peers[playerId]?.username || 'Unknown');
        /* @tweakable username label positioning for better multiplayer identification */
        usernameSprite.position.set(0, 2.8 * playerModelScale, 0); // Increased height
        playerMesh.add(usernameSprite);
        
        // Create health bar above username
        const healthBar = this.createHealthBar();
        /* @tweakable health bar positioning for better multiplayer visibility */
        healthBar.position.set(0, 2.3 * playerModelScale, 0); // Adjusted height
        playerMesh.add(healthBar);
        
        // Add weapon indicator if they have one
        const weaponIndicator = this.createWeaponIndicator();
        /* @tweakable weapon indicator positioning for enhanced H20pew visibility */
        weaponIndicator.position.set(0.3 * playerModelScale, 0.5 * playerModelScale, -0.4 * playerModelScale);
        playerMesh.add(weaponIndicator);
        
        // Add team indicator ring around base
        const teamRing = this.createTeamIndicatorRing(playerData.team);
        teamRing.position.set(0, -0.8 * playerModelScale, 0);
        playerMesh.add(teamRing);
        
        this.scene.add(playerMesh);
        this.otherPlayers.set(playerId, {
            mesh: playerMesh,
            usernameSprite,
            healthBar,
            weaponIndicator,
            teamRing,
            lastUpdate: Date.now()
        });
        
        console.log(`Created player model for ${playerId} on team ${playerData.team}`);
        return playerMesh;
    }
    
    createTeamIndicatorRing(team) {
        /* @tweakable team indicator ring for enhanced team identification */
        const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 16);
        const ringColor = team === 'alpha' ? 0x00aaff : 0xff6600;
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        return ring;
    }
    
    createUsernameSprite(username) {
        /* @tweakable username display properties for enhanced multiplayer visibility */
        const canvasWidth = 512;
        const canvasHeight = 128;
        const fontSize = 36; // Increased from 32
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.9)'; // More opaque background
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        context.strokeStyle = '#ffffff';
        context.lineWidth = 4;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        context.fillStyle = '#ffffff';
        context.font = `bold ${fontSize}px Arial`;
        context.textAlign = 'center';
        context.fillText(username, canvas.width / 2, canvas.height / 2 + fontSize / 3);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        /* @tweakable username sprite scale for enhanced multiplayer visibility */
        sprite.scale.set(4, 1.5, 1); // Increased width and height
        
        return sprite;
    }
    
    createHealthBar() {
        /* @tweakable health bar appearance for enhanced multiplayer visibility */
        const barWidth = 2.0; // Increased from 1.5
        const barHeight = 0.2; // Increased from 0.15
        
        const geometry = new THREE.PlaneGeometry(barWidth, barHeight);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.95 // More opaque
        });
        
        const healthBar = new THREE.Mesh(geometry, material);
        healthBar.userData = { type: 'healthBar', maxWidth: barWidth };
        
        // Add border to health bar
        const borderGeometry = new THREE.PlaneGeometry(barWidth + 0.1, barHeight + 0.05);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.8
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.position.z = -0.001;
        healthBar.add(border);
        
        return healthBar;
    }
    
    createWeaponIndicator() {
        /* @tweakable weapon indicator size for enhanced multiplayer visibility */
        const weaponScale = 2.0; // Increased from 1.5
        const geometry = new THREE.BoxGeometry(0.08 * weaponScale, 0.08 * weaponScale, 0.4 * weaponScale);
        const material = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8,
            roughness: 0.2,
            /* @tweakable weapon indicator glow for enhanced multiplayer visibility */
            emissive: 0x0088ff,
            emissiveIntensity: 0.8 // Increased glow
        });
        
        return new THREE.Mesh(geometry, material);
    }
    
    updateOtherPlayers() {
        if (!this.networkManager.room) return;
        
        const currentPlayers = new Set();
        
        // Update existing players and create new ones
        Object.entries(this.networkManager.room.presence).forEach(([playerId, presence]) => {
            if (playerId === this.networkManager.room.clientId) return; // Skip self
            
            currentPlayers.add(playerId);
            
            if (!this.otherPlayers.has(playerId)) {
                // Create new player model
                console.log(`Creating new player model for ${playerId}`, presence);
                this.createPlayerModel(playerId, presence);
            } else {
                // Update existing player
                this.updatePlayerModel(playerId, presence);
            }
        });
        
        // Remove disconnected players
        for (const [playerId, playerObject] of this.otherPlayers.entries()) {
            if (!currentPlayers.has(playerId)) {
                console.log(`Removing disconnected player ${playerId}`);
                if (playerObject.mesh) this.scene.remove(playerObject.mesh);

                // Clean up speaking indicator and sound for disconnected player
                if (this.effectsManager && typeof this.effectsManager.setPlayerSpeakingIndicator === 'function') {
                    this.effectsManager.setPlayerSpeakingIndicator(playerId, false, null);
                }
                if (this.audioManager && typeof this.audioManager.setPlayerSpatialTalkingSound === 'function') {
                    this.audioManager.setPlayerSpatialTalkingSound(playerId, false, null);
                }

                this.otherPlayers.delete(playerId);
            }
        }
        
        /* @tweakable multiplayer synchronization debugging */
        if (this.otherPlayers.size > 0 && Math.random() < 0.01) { // 1% chance per frame
            console.log(`Currently tracking ${this.otherPlayers.size} other players`);
        }
    }
    
    updatePlayerModel(playerId, presence) {
        const playerObject = this.otherPlayers.get(playerId);
        if (!playerObject) return;
        
        // Store class and maxHealth if present in presence update
        if (presence.playerClass) {
            playerObject.playerClass = presence.playerClass;
        }
        if (presence.maxHealth) {
            playerObject.maxHealth = presence.maxHealth;
        }

        // Handle speaking indicator update
        const oldIsSpeaking = playerObject.isSpeaking; // Store previous state
        playerObject.isSpeaking = !!presence.isSpeaking; // Update to new state, ensuring boolean

        if (playerObject.isSpeaking !== oldIsSpeaking && playerObject.mesh) { // If state changed and mesh exists
            if (this.effectsManager && typeof this.effectsManager.setPlayerSpeakingIndicator === 'function') {
                this.effectsManager.setPlayerSpeakingIndicator(playerId, playerObject.isSpeaking, playerObject.mesh);
            }
            if (this.audioManager && typeof this.audioManager.setPlayerSpatialTalkingSound === 'function') {
                this.audioManager.setPlayerSpatialTalkingSound(playerId, playerObject.isSpeaking, playerObject.mesh);
            }
        }


        const { mesh, healthBar, weaponIndicator, teamRing } = playerObject;
        
        // Update position with enhanced interpolation
        if (presence.position) {
            /* @tweakable multiplayer position sync smoothness for better tracking */
            const lerpFactor = 0.15; // Slightly reduced for smoother movement
            const targetPosition = new THREE.Vector3(...presence.position);
            mesh.position.lerp(targetPosition, lerpFactor);
        }
        
        // Update rotation with smoothing
        if (presence.rotation) {
            /* @tweakable multiplayer rotation sync smoothness */
            const targetRotationY = presence.rotation[1];
            mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetRotationY, 0.2);
        }
        
        // Update health bar with enhanced visibility
        if (presence.health !== undefined) {
            const maxHealth = playerObject.maxHealth || 100; // Use stored maxHealth from playerObject
            const healthPercent = Math.max(0.05, presence.health / maxHealth);
            healthBar.scale.x = healthPercent;
            
            // Enhanced color coding based on health
            if (healthPercent > 0.7) {
                healthBar.material.color.setHex(0x00ff00);
            } else if (healthPercent > 0.4) {
                healthBar.material.color.setHex(0xffff00);
            } else if (healthPercent > 0.2) {
                healthBar.material.color.setHex(0xff8800);
            } else {
                healthBar.material.color.setHex(0xff0000);
            }
        }
        
        // Update team material with enhanced visibility
        if (presence.team && this.playerMaterials[presence.team]) {
            mesh.material = this.playerMaterials[presence.team].clone();
            /* @tweakable team identification glow for enhanced multiplayer visibility */
            mesh.material.emissiveIntensity = presence.team === this.player.team ? 0.8 : 0.6;
            
            // Update team ring
            if (teamRing) {
                const ringColor = presence.team === 'alpha' ? 0x00aaff : 0xff6600;
                teamRing.material.color.setHex(ringColor);
            }
        }
        
        // Enhanced visibility for dead players
        mesh.visible = !presence.dead;
        if (presence.dead) {
            /* @tweakable dead player transparency for multiplayer feedback */
            mesh.material.opacity = 0.3;
            mesh.material.transparent = true;
        } else {
            mesh.material.opacity = 1.0;
            mesh.material.transparent = false;
        }
        
        // Update weapon visibility for H20pew
        if (weaponIndicator) {
            weaponIndicator.visible = presence.weaponVisible && !presence.dead;
            /* @tweakable H20pew weapon indicator glow for enhanced multiplayer visibility */
            weaponIndicator.material.emissiveIntensity = presence.weaponVisible ? 1.0 : 0.3;
        }
        
        // Enhanced fragment indicator with better visual feedback
        if (presence.hasFragment) {
            /* @tweakable fragment carrier visibility effect for enhanced multiplayer feedback */
            const fragmentGlowIntensity = 1.5; // Increased intensity
            mesh.material.emissiveIntensity = fragmentGlowIntensity + Math.sin(Date.now() * 0.008) * 0.8;
            
            // Add pulsing scale effect
            const pulseScale = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            mesh.scale.setScalar(pulseScale);
            
            // Add fragment aura effect
            if (!mesh.userData.fragmentAura) {
                const auraGeometry = new THREE.SphereGeometry(3);
                const auraMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffdd00,
                    transparent: true,
                    opacity: 0.2,
                    side: THREE.DoubleSide
                });
                mesh.userData.fragmentAura = new THREE.Mesh(auraGeometry, auraMaterial);
                mesh.add(mesh.userData.fragmentAura);
            }
        } else {
            mesh.material.emissiveIntensity = 0.6;
            mesh.scale.setScalar(1);
            
            // Remove fragment aura
            if (mesh.userData.fragmentAura) {
                mesh.remove(mesh.userData.fragmentAura);
                mesh.userData.fragmentAura = null;
            }
        }
        
        playerObject.lastUpdate = Date.now();
    }
    
    getCollidableEntities() {
        let collidables = [];
        // Add other player meshes
        this.otherPlayers.forEach(playerData => {
            if (playerData.mesh && playerData.mesh.visible) { // Ensure mesh exists and is visible
                collidables.push(playerData.mesh);
            }
        });
        // Add environment meshes (assuming environment object has a way to provide them)
        if (this.environment && this.environment.collidableMeshes) {
            collidables = collidables.concat(this.environment.collidableMeshes);
        }
        // Add any other specific collidable entities like interactive objects, etc.
        return collidables;
    }

    handleShoot() {
        if (!this.weaponManager || !this.camera || !this.player || this.player.isDead) return;

        const weaponConfig = this.player.getWeaponConfig();
        if (!weaponConfig) {
            console.error("Player has no weapon config for type:", this.player.weaponType);
            return;
        }

        const now = Date.now();
        if (now < this.player.lastShotTime + weaponConfig.fireRate) {
            // console.log("Fire rate too high");
            return;
        }

        if (this.player.ammo <= 0) {
            this.audioManager.playSound('empty', this.player.position);
            return;
        }
        
        // For non-automatic weapons, ensure it's a new click
        // This requires InputManager to track mouseDown state or click events.
        // Assuming InputManager.controls.shoot is true for mousedown, false for mouseup for semi-auto.
        // For simplicity here, we'll assume if it's not auto, one call to handleShoot is one shot.
        // A more robust solution would be in InputManager.
        if (!weaponConfig.auto && this.inputManager.wasShootingLastFrame && this.inputManager.controls.shoot) {
            // console.log("Semi-auto: waiting for next click");
            // this.inputManager.wasShootingLastFrame = true; // Set this in InputManager
            return;
        }


        this.player.shoot(); // Decrements ammo, UIManager.updateAmmoDisplay is called within Player.resetAmmo or setClass
        this.player.lastShotTime = now; // Update player's last shot time for fire rate

        const cameraWorldDirection = this.camera.getWorldDirection(new THREE.Vector3());
        const cameraWorldPosition = this.camera.getWorldPosition(new THREE.Vector3());
        
        this.weaponManager.shoot(cameraWorldDirection, cameraWorldPosition); // weaponManager.shoot handles raycasting, effects, and network messages
        
        this.addCorruption(0.1); // Reduced corruption per shot, can be per-weapon
        this.networkManager.updatePresence(this.player.getPresenceData()); // Sync ammo, lastShotTime
        
        // if (this.inputManager.controls.shoot && !weaponConfig.auto) {
        //    this.inputManager.wasShootingLastFrame = true; // For InputManager to manage semi-auto
        // } else {
        //    this.inputManager.wasShootingLastFrame = false;
        // }
    }
    
    handleReload() {
        if (this.playerBuffs.fastReload.active) {
            // Fast reload buff reduces reload time
            const success = this.weaponManager.reload(0.5); // 50% faster
        } else {
            const success = this.weaponManager.reload();
        }
        
        if (success) {
            setTimeout(() => {
                this.uiManager.updateAmmoDisplay();
            }, this.playerBuffs.fastReload.active ? 1000 : 2000);
        }
    }
    
    handleWeaponSwitch(weaponType) {
        this.player.setWeaponType(weaponType);
        this.uiManager.updateAmmoDisplay();
        this.uiManager.updateWeaponDisplay(weaponType);
    }
    
    handleHit(hit, damage) {
        const object = hit.object;
        
        if (object.userData.isFragment) {
            this.collectFragment();
        }
        
        this.effectsManager.createHitEffect(hit.point);
    }
    
    collectFragment() {
        if (!this.player.collectFragment()) {
            return;
        }
        
        this.fragmentManager.setFragmentPickupTime(Date.now());
        this.uiManager.showFragmentIndicator();
        this.fragmentManager.removeFragment('center_fragment');
        
        this.networkManager.updatePresence({
            hasFragment: true
        });
        
        this.networkManager.send({
            type: 'fragment_collected',
            playerId: this.networkManager.room.clientId,
            team: this.player.team
        });
        
        this.audioManager.playSound('collect');
        this.addCorruption(2);
    }
    
    checkMidMatchObjectives() {
        // Check glitch vent interactions
        const ventInteraction = this.environment.checkGlitchVentInteraction(
            this.player.position, 
            this.networkManager.room.clientId
        );
        
        if (ventInteraction && ventInteraction.available) {
            this.uiManager.showInteractionPrompt("Press [F] to use Glitch Vent");
            
            if (this.inputManager.controls.interact) {
                const result = this.environment.activateGlitchVent(
                    ventInteraction.vent, 
                    this.networkManager.room.clientId
                );
                
                if (result) {
                    this.player.position.copy(result.teleportPosition);
                    this.audioManager.playSound('teleport');
                    this.uiManager.addKillFeedEntry("Used Glitch Vent teleporter");
                }
            }
        }
        
        // Check corruption pool interactions
        const poolInteraction = this.environment.checkCorruptionPoolInteraction(this.player.position);
        
        if (poolInteraction && poolInteraction.available) {
            this.uiManager.showInteractionPrompt(`Press [F] to gain ${poolInteraction.buffType.replace('_', ' ')} buff`);
            
            if (this.inputManager.controls.interact) {
                const result = this.environment.activateCorruptionPool(poolInteraction.pool);
                
                if (result) {
                    this.applyPlayerBuff(result.buffType, result.duration);
                    this.audioManager.playSound('buff_acquired');
                    this.addCorruption(10); // Risk vs reward
                }
            }
        }
    }
    
    applyPlayerBuff(buffType, duration) {
        const currentTime = Date.now();
        this.playerBuffs[buffType] = {
            active: true,
            endTime: currentTime + duration * 1000
        };
        
        this.uiManager.showBuffIndicator(buffType, duration);
        
        // Apply immediate effects
        switch (buffType) {
            case 'invisibility':
                // Make player model transparent (would need multiplayer sync)
                break;
            case 'fastReload':
                // Handled in reload function
                break;
            case 'damageBoost':
                // Handled in shoot function
                break;
        }
    }
    
    addCorruption(amount) {
        /* @tweakable corruption increase rate multiplier */
        const corruptionMultiplier = 1.0;
        this.gameState.addCorruption(amount * corruptionMultiplier);
        this.uiManager.updateCorruptionDisplay();
        this.effectsManager.applyCorruptionEffects();
        
        this.networkManager.updateRoomState({
            globalCorruption: this.gameState.corruptionLevel
        });
    }
    
    updateScoring(deltaTime) {
        if (!this.player.hasFragment) return;
        
        const isInHomeBase = this.environment.checkBaseZone(this.player.position, this.player.team);
        const isInEnemyBase = this.environment.checkEnemyBaseZone(this.player.position, this.player.team);
        
        // Get escalating score rates based on hold time
        const holdTime = this.player.fragmentHoldTime;
        let scoreRate = 0;
        
        if (isInHomeBase) {
            if (holdTime < 30) {
                /* @tweakable base scoring rate at home base (0-30 seconds) */
                scoreRate = 3;
            } else if (holdTime < 60) {
                /* @tweakable escalated scoring rate at home base (30-60 seconds) */
                scoreRate = 5;
            } else {
                /* @tweakable lockdown scoring rate at home base (60+ seconds) */
                scoreRate = 8;
                // Trigger lockdown mode
                this.uiManager.showLockdownMode();
            }
        } else if (isInEnemyBase) {
            /* @tweakable enemy base scoring rate */
            scoreRate = 1;
        }
        
        if (scoreRate > 0) {
            this.gameState.addScore(this.player.team, scoreRate * deltaTime);
            this.uiManager.updateScoreDisplay();
            
            // Check for fragment corruption auto-return
            const autoReturnCheck = this.fragmentManager.checkAutoReturn(Date.now());
            if (autoReturnCheck === 'auto_return') {
                this.forceFragmentReturn();
            } else if (autoReturnCheck === 'volatile') {
                this.uiManager.showVolatileFragmentWarning();
            }
            
            const syncFrequency = 0.5;
            if (!this.lastScoreSync || Date.now() - this.lastScoreSync > syncFrequency * 1000) {
                this.networkManager.updateRoomState({
                    scoreAlpha: this.gameState.scoreAlpha,
                    scoreBeta: this.gameState.scoreBeta
                });
                this.lastScoreSync = Date.now();
            }
            
            const winner = this.gameState.checkWinCondition();
            if (winner) {
                this.endGame(winner);
            }
        }
    }
    
    forceFragmentReturn() {
        this.player.hasFragment = false;
        this.fragmentManager.forceFragmentReturn();
        this.uiManager.hideFragmentIndicator();
        this.uiManager.addKillFeedEntry("Fragment corrupted! Returned to center.");
        this.addCorruption(20); // Major corruption penalty
    }
    
    updateChaosEvents(deltaTime, currentTime) {
        // Check if it's time for a new chaos event
        if (currentTime > this.nextChaosTime && !this.activeChaosEvent) {
            const availableEvents = this.chaosEvents.filter(event => 
                currentTime > (event.lastTriggered || 0) + event.cooldown * 1000
            );
            
            if (availableEvents.length > 0) {
                const selectedEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
                this.triggerChaosEvent(selectedEvent, currentTime);
            }
        }
        
        // Update active chaos event effects
        if (this.activeChaosEvent) {
            this.applyChaosEffects(this.activeChaosEvent, deltaTime);
            
            if (currentTime > this.activeChaosEvent.endTime) {
                this.endChaosEvent();
            }
        }
        
        // Update player buffs
        Object.keys(this.playerBuffs).forEach(buffName => {
            const buff = this.playerBuffs[buffName];
            if (buff.active && currentTime > buff.endTime) {
                buff.active = false;
                this.uiManager.removeBuffIndicator(buffName);
            }
        });
    }
    
    applyChaosEffects(chaosEvent, deltaTime) {
        switch (chaosEvent.name) {
            case 'gravity_invert':
                /* @tweakable inverted gravity strength */
                const invertedGravity = 15;
                this.player.velocity.y += invertedGravity * deltaTime;
                break;
                
            case 'speed_boost':
                /* @tweakable chaos speed boost multiplier */
                const speedMultiplier = 2.0;
                this.player.baseWalkSpeed = 6 * speedMultiplier;
                this.player.baseSprintSpeed = 9 * speedMultiplier;
                break;
                
            case 'weapon_swap':
                // Randomly swap weapons every few seconds during event
                /* @tweakable weapon swap frequency during chaos event */
                const swapFrequency = 3000; // milliseconds
                if (Math.random() < deltaTime / (swapFrequency / 1000)) {
                    this.randomizeAllWeapons();
                }
                break;
        }
    }
    
    endChaosEvent() {
        // Reset any temporary effects
        if (this.activeChaosEvent) {
            switch (this.activeChaosEvent.name) {
                case 'speed_boost':
                    // Reset to normal speeds
                    this.player.baseWalkSpeed = 6;
                    this.player.baseSprintSpeed = 9;
                    break;
            }
        }
        
        this.activeChaosEvent = null;
        this.uiManager.hideChaosEvent();
    }
    
    triggerChaosEvent(selectedEvent, currentTime) {
        this.activeChaosEvent = {
            ...selectedEvent,
            startTime: currentTime,
            endTime: currentTime + selectedEvent.duration * 1000
        };
        
        // Mark when this event was last triggered for cooldown tracking
        selectedEvent.lastTriggered = currentTime;
        
        // Display chaos event to player
        const eventMessages = {
            gravity_invert: "GRAVITY INVERTED!",
            no_reload: "INFINITE AMMO CHAOS!",
            weapon_swap: "WEAPONS RANDOMIZING!",
            speed_boost: "SPEED BOOST ACTIVATED!",
            /* @tweakable chaos event display messages for H20pew weapon interactions */
            fog_vision: "H20PEW VISION JAMMED!",
            double_damage: "H20PEW OVERDRIVE MODE!",
            infinite_ammo: "H20PEW UNLIMITED POWER!"
        };
        
        const message = eventMessages[selectedEvent.name] || "CHAOS EVENT ACTIVE!";
        this.uiManager.showChaosEvent(message);
        
        /* @tweakable time between chaos events for H20pew gameplay balance */
        const timeBetweenEvents = 90;
        this.nextChaosTime = currentTime + timeBetweenEvents * 1000;
        
        // Add network sync for multiplayer chaos events
        this.networkManager.send({
            type: 'chaos_event_triggered',
            eventName: selectedEvent.name,
            duration: selectedEvent.duration,
            triggerTime: currentTime
        });
        
        console.log(`Chaos event triggered: ${selectedEvent.name} for ${selectedEvent.duration} seconds`);
    }
    
    randomizeAllWeapons() {
        const weapons = ['assault', 'scout', 'heavy'];
        const randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];
        this.handleWeaponSwitch(randomWeapon);
    }
    
    handleInteraction() {
        if (!this.treasureMapManager) return;
        
        const interaction = this.treasureMapManager.checkInteractions(
            this.player.position, 
            this.networkManager.room.clientId, 
            this.player.team
        );
        
        if (interaction && interaction.available) {
            if (interaction.type === 'treasure_map_pickup') {
                const success = this.treasureMapManager.pickupTreasureMap(
                    this.networkManager.room.clientId,
                    this.player.team
                );
                
                if (success) {
                    this.uiManager.showTreasureMapAcquired();
                    this.uiManager.hideTreasureMapInteraction();
                    this.audioManager.playSound('collect');
                }
            } else if (interaction.type === 'hidden_doorway') {
                const success = this.treasureMapManager.activateRemembranceEvent(
                    this.networkManager.room.clientId,
                    this.player.team
                );
                
                if (success) {
                    this.uiManager.activateRemembranceEffect(this.player.team);
                    this.uiManager.hideTreasureMapInteraction();
                    this.uiManager.hideTreasureMapStatus();
                    this.audioManager.playSound('remembrance');
                }
            }
        }
    }
    
    handlePlayerDeath(killerId, killingWeaponParam = null) {
        // This method is called when the local player dies.
        // killerId and killingWeaponParam are passed from Player.takeDamage

        const localPlayerPresence = this.networkManager?.room?.presence[this.player.getPlayerId()] || {};
        const victimName = localPlayerPresence.username || this.player.getPlayerId(); // Use local player's username

        let killerName = "The Environment";
        let weaponUsed = killingWeaponParam; // Prioritize weapon passed from takeDamage

        if (killerId) {
            if (killerId === this.player.getPlayerId()) {
                killerName = victimName; // Self-elimination
            } else if (this.networkManager.room && this.networkManager.room.presence[killerId]) {
                killerName = this.networkManager.room.presence[killerId].username || killerId;
            }
            // Fallback if weapon not passed directly from takeDamage (e.g. environmental death or if takeDamage wasn't modified yet)
            if (!weaponUsed && this.player.lastDamageInfo && this.player.lastDamageInfo.attackerId === killerId) {
                weaponUsed = this.player.lastDamageInfo.weapon;
            }
        }
        if (!weaponUsed) weaponUsed = "Unknown"; // Ensure weaponUsed has a value

        // Send the elimination message to all clients (including self)
        if (this.networkManager) {
            this.networkManager.sendPlayerEliminated(victimName, killerName, weaponUsed);
        } else {
            // If no network, show locally for single player testing
            this.uiManager.addKillFeedEntry(killerName, victimName, weaponUsed);
        }
        // Add streamer event for player elimination
        if (this.streamerDataManager && typeof this.streamerDataManager.addStreamerEvent === 'function') {
            this.streamerDataManager.addStreamerEvent(`${killerName} [${weaponUsed}] ${victimName}`);
        }
        // Add match stats timeline event
        if (this.matchStatsManager && typeof this.matchStatsManager.addTimelineEvent === 'function') {
            this.matchStatsManager.addTimelineEvent(`${killerName} [${weaponUsed}] ${victimName}`, "elimination");
        }


        if (this.player.hasFragment) {
            this.player.dropFragment();
        }
        
        this.networkManager.updatePresence(this.player.getPresenceData());

        const RESPAWN_DELAY = 3000; // 3 seconds
        setTimeout(() => {
            this.respawnPlayer();
        }, RESPAWN_DELAY);
    }
    
    respawnPlayer(initialSpawn = false) {
        let spawnPoint;
        if (this.player.team === 'alpha') {
            spawnPoint = TEAM_ALPHA_SPAWN_POINTS[alphaSpawnIndex % TEAM_ALPHA_SPAWN_POINTS.length];
            alphaSpawnIndex++;
        } else if (this.player.team === 'beta') {
            spawnPoint = TEAM_BETA_SPAWN_POINTS[betaSpawnIndex % TEAM_BETA_SPAWN_POINTS.length];
            betaSpawnIndex++;
        } else {
            // Fallback spawn point if team is not set (should not happen in normal flow)
            console.warn(`Player team not set for respawn. Defaulting to a generic spawn.`);
            spawnPoint = { x: 0, y: 10, z: 0, facing: 0 };
        }

        // The Player.spawnAt method should handle resetting health, ammo, position, rotation etc.
        this.player.spawnAt(spawnPoint.x, spawnPoint.y, spawnPoint.z, spawnPoint.facing);

        // Update camera to player's new position and orientation
        // Player.spawnAt should ideally set the this.player.position and this.player.rotation (or cameraHolder rotation)
        // The game loop's camera update logic (player.updateMovement) will then use these.
        // If direct camera manipulation is needed here:
        if (this.camera) {
            this.camera.position.set(spawnPoint.x, spawnPoint.y + this.player.cameraHeight, spawnPoint.z); // Adjust for camera height
            // For rotation, usually the player's rotation is updated, and camera follows.
            // If Player.spawnAt updates player's rotation correctly, this might not be needed.
        }


        if (!initialSpawn) { // Don't show "Respawned" message on initial game start
            this.uiManager.addKillFeedEntry("Respawned!");
        }
        this.uiManager.updateHealthDisplay(); // Reflects reset health
        this.uiManager.updateAmmoDisplay();   // Reflects reset ammo
        this.uiManager.hideFragmentIndicator(); // Should not have fragment on respawn

        // Important: Update presence so other players see the respawn (new position, alive state, health)
        this.networkManager.updatePresence(this.player.getPresenceData());
    }
    
    gameLoop() {
        if (!this.gameState.isGameStarted) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - (this.lastTime || currentTime)) / 1000;
        this.lastTime = currentTime;
        
        this.player.updateMovement(this.inputManager.controls, this.camera, deltaTime);
        this.fragmentManager.animateFragment(currentTime / 1000);
        
        // Update multiplayer player rendering (this calls updatePlayerModel)
        this.updateOtherPlayers();
        
        // Update weapon recoil
        if (this.weaponManager) {
            this.weaponManager.updateRecoil(deltaTime);
        }
        
        // Update environment cooldowns
        if (this.environment) {
            this.environment.updateCooldowns(deltaTime);
        }
        
        // this.checkFragmentPickup(); // Old direct check, replaced by interaction prompt system
        this.handleFragmentInteractionSetup(); // Check if player can pick up fragment and UIManager shows prompt
        this.checkTreasureMapInteractions();
        this.checkMidMatchObjectives(); // This also contains generic interaction logic
        // this.updateScoring(deltaTime); // Old direct fragment scoring, replaced by updateScoreOverTime
        this.updateScoreOverTime(deltaTime); // New time-based scoring logic
        this.checkFragmentRespawn();
        this.updateChaosEvents(deltaTime, Date.now());
        
        this.gameState.updateTime(deltaTime);
        this.networkManager.updatePresence(this.player.getPresenceData());
        
        if (this.streamerDataManager) {
            this.streamerDataManager.update(); // Update streamer data
        }

        requestAnimationFrame(() => this.gameLoop());
    }
    
    // checkFragmentPickup() { // Replaced by handleFragmentInteractionSetup and player.collectFragment() via input
    //     if (!this.player.hasFragment && this.fragmentManager.getTouchingFragmentId(this.player.position)) {
    //         // Now handled by player pressing 'F' when UIManager shows prompt
    //         // this.player.collectFragment(); // This was the old direct collection
    //     }
    // }

    handleFragmentInteractionSetup() {
        if (!this.player.hasFragment && this.player.canCollectFragment && this.player.currentTouchingFragmentId) {
            if (this.uiManager) this.uiManager.showInteractionPrompt(`Press [F] to collect Fragment`);
        } else if (!this.player.canCollectFragment && !this.treasureMapManager?.checkInteractions(this.player.position, this.networkManager?.room?.clientId, this.player.team)?.available) {
            // Hide prompt only if no other interaction (like treasure map) is available
            if (this.uiManager) this.uiManager.hideInteractionPrompt();
        }
        // If treasure map interaction is available, its prompt will be shown by checkTreasureMapInteractions
    }
    
    checkFragmentRespawn() {
        if (!this.fragmentManager.fragment) {
            // Check if any player has the fragment
            const hasFragmentPlayer = Object.values(this.networkManager.room.presence || {})
                .some(presence => presence.hasFragment);
            
            if (!hasFragmentPlayer && !this.player.hasFragment) {
                // Respawn fragment at center if no one has it
                this.fragmentManager.createFragment('center_fragment', this.fragmentManager.centerPosition);
            }
        }
    }
    
    checkTreasureMapInteractions() {
        if (!this.treasureMapManager) return;
        
        const treasureInteraction = this.treasureMapManager.checkInteractions(
            this.player.position,
            this.networkManager.room?.clientId,
            this.player.team
        );
        
        if (treasureInteraction && treasureInteraction.available) {
            this.uiManager.showTreasureMapInteraction(treasureInteraction.type);
        } else if (!this.player.canCollectFragment) {
            // Only hide if fragment interaction is also not available
            this.uiManager.hideTreasureMapInteraction(); // This might conflict if fragment prompt is also active
                                                       // The logic in handleFragmentInteractionSetup tries to manage this.
        }
    }

    // Centralized interaction handler called by InputManager on 'F' key press
    handleInteraction() {
        // 1. Prioritize Treasure Map Interaction if available
        if (this.treasureMapManager) {
            const treasureInteraction = this.treasureMapManager.checkInteractions(
                this.player.position,
                this.networkManager.room.clientId,
                this.player.team
            );
            if (treasureInteraction && treasureInteraction.available) {
                if (treasureInteraction.type === 'treasure_map_pickup') {
                    const success = this.treasureMapManager.pickupTreasureMap(
                        this.networkManager.room.clientId, this.player.team
                    );
                    if (success) {
                        this.uiManager.showTreasureMapAcquired();
                        this.uiManager.hideTreasureMapInteraction();
                        this.audioManager.playSound('collect'); // Or a specific map sound
                        return; // Interaction handled
                    }
                } else if (treasureInteraction.type === 'hidden_doorway') {
                    const success = this.treasureMapManager.activateRemembranceEvent(
                        this.networkManager.room.clientId, this.player.team
                    );
                    if (success) {
                        this.uiManager.activateRemembranceEffect(this.player.team);
                        this.uiManager.hideTreasureMapInteraction();
                        this.uiManager.hideTreasureMapStatus();
                        this.audioManager.playSound('remembrance');
                        return; // Interaction handled
                    }
                }
            }
        }

        // 2. Then, try Fragment Collection
        if (this.player.canCollectFragment && this.player.currentTouchingFragmentId) {
            if (this.player.collectFragment()) { // collectFragment now handles network updates via FragmentManager
                this.audioManager.playSound('collect');
                // UIManager prompt will be hidden automatically as canCollectFragment becomes false
                return; // Interaction handled
            }
        }

        // 3. Then, other interactions like Glitch Vents, Corruption Pools (from checkMidMatchObjectives)
        // These are currently checked and handled within checkMidMatchObjectives based on input state.
        // For a unified 'F' key, their logic would also need to be callable from here.
        // For now, their existing input check within their own methods might still work if InputManager sets a flag.
        // To make it truly sequential, checkMidMatchObjectives might need to return what it tried to do.
        // For simplicity, let's assume checkMidMatchObjectives handles its own input for now.

        console.log("No specific interaction found for 'F' key press at this moment.");
    }
    
    animate() {
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        
        requestAnimationFrame(() => this.animate());
    }
    
    handleResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    requestPointerLock() {
        const canvas = document.getElementById('game-canvas');
        if (canvas.requestPointerLock) {
            canvas.requestPointerLock();
        } else if (canvas.mozRequestPointerLock) {
            canvas.mozRequestPointerLock();
        } else if (canvas.webkitRequestPointerLock) {
            canvas.webkitRequestPointerLock();
        }
    }

    enablePointerLock(enable) {
        if (enable) {
            this.requestPointerLock();
        } else {
            if (document.exitPointerLock) {
                document.exitPointerLock();
            }
        }
    }
    
    checkWinCondition() {
        return this.gameState.checkWinCondition();
    }

    updateScoreOverTime(deltaTime) {
        if (!this.gameState.isGameStarted || !this.networkManager || !this.networkManager.room || !this.fragmentManager) {
            return;
        }

        // Determine who is responsible for scoring logic
        let isScoringClient = false;
        const clientId = this.networkManager.room.clientId;

        if (this.gameState.chaosInfluencerId) {
            isScoringClient = (clientId === this.gameState.chaosInfluencerId);
        } else {
            // Fallback: client with the lowest ID is responsible
            const peers = this.networkManager.room.peers || {};
            let lowestId = clientId; // Start with own ID
            for (const peerId in peers) {
                if (peerId < lowestId) {
                    lowestId = peerId;
                }
            }
            isScoringClient = (clientId === lowestId);
        }

        if (!isScoringClient) {
            return; // This client is not responsible for calculating scores
        }

        const fragmentState = this.fragmentManager.getFragmentState('center_fragment');

        if (fragmentState && fragmentState.isCollected && fragmentState.carrierId) {
            const carrierPresence = this.networkManager.room.presence[fragmentState.carrierId];

            if (carrierPresence && !carrierPresence.isDead) { // Ensure carrier is alive
                const carrierPosition = carrierPresence.position; // Expected to be {x,y,z} or [x,y,z]
                const carrierTeam = carrierPresence.team;

                const isCarrierInAlphaBase = distanceSquared(carrierPosition, TEAM_ALPHA_BASE_CENTER) < BASE_RADIUS_SQUARED;
                const isCarrierInBetaBase = distanceSquared(carrierPosition, TEAM_BETA_BASE_CENTER) < BASE_RADIUS_SQUARED;

                let pointsPerSecond = 0;
                let teamToScore = null;

                if (carrierTeam === 'alpha') {
                    if (isCarrierInAlphaBase) { pointsPerSecond = 3; teamToScore = 'alpha'; }
                    else if (isCarrierInBetaBase) { pointsPerSecond = 1; teamToScore = 'alpha'; }
                } else if (carrierTeam === 'beta') {
                    if (isCarrierInBetaBase) { pointsPerSecond = 3; teamToScore = 'beta'; }
                    else if (isCarrierInAlphaBase) { pointsPerSecond = 1; teamToScore = 'beta'; }
                }

                if (pointsPerSecond > 0 && teamToScore) {
                    const dtSeconds = deltaTime; // Assuming deltaTime from gameLoop is already in seconds. If in ms, divide by 1000.
                                               // The existing gameLoop passes (currentTime - lastTime) / 1000, so it is in seconds.

                    if (teamToScore === 'alpha') {
                        this.gameState.alphaScoreAccumulator += pointsPerSecond * dtSeconds;
                        if (this.gameState.alphaScoreAccumulator >= SCORE_INTERVAL_SECONDS) {
                            const scoreUnits = Math.floor(this.gameState.alphaScoreAccumulator / SCORE_INTERVAL_SECONDS);
                            this.gameState.scoreAlpha += scoreUnits;
                            this.gameState.alphaScoreAccumulator -= scoreUnits * SCORE_INTERVAL_SECONDS;
                            this.networkManager.updateRoomState({ scoreAlpha: this.gameState.scoreAlpha });
                            // UIManager update will happen when this client receives the roomState update via subscription
                        }
                    } else if (teamToScore === 'beta') {
                        this.gameState.betaScoreAccumulator += pointsPerSecond * dtSeconds;
                        if (this.gameState.betaScoreAccumulator >= SCORE_INTERVAL_SECONDS) {
                            const scoreUnits = Math.floor(this.gameState.betaScoreAccumulator / SCORE_INTERVAL_SECONDS);
                            this.gameState.scoreBeta += scoreUnits;
                            this.gameState.betaScoreAccumulator -= scoreUnits * SCORE_INTERVAL_SECONDS;
                            this.networkManager.updateRoomState({ scoreBeta: this.gameState.scoreBeta });
                        }
                    }
                     // Check for win condition after score update by the responsible client
                    const winner = this.gameState.checkWinCondition();
                    if (winner) {
                        this.endGame(winner);
                        // Optionally send a specific "game_over" message if not handled by score limits alone
                        // this.networkManager.send({ type: 'game_over', winningTeam: winner });
                    }
                }
            }
        }

        // Fragment Ping Logic (still inside if(isScoringClient) block)
        if (fragmentState && fragmentState.isCollected && fragmentState.carrierId) {
            const deltaTimeMs = deltaTime * 1000; // Convert deltaTime (seconds) to milliseconds

            // Ping Accumulator
            fragmentState.pingAccumulator = (fragmentState.pingAccumulator || 0) + deltaTimeMs;
            if (fragmentState.pingAccumulator >= fragmentState.PING_INTERVAL) {
                fragmentState.pingAccumulator = 0;
                const carrierPresence = this.networkManager.room.presence[fragmentState.carrierId];
                if (carrierPresence && carrierPresence.position && !carrierPresence.isDead) {
                    const positionToSend = Array.isArray(carrierPresence.position)
                        ? carrierPresence.position
                        : [carrierPresence.position.x, carrierPresence.position.y, carrierPresence.position.z];
                    this.networkManager.sendFragmentPingAlert(fragmentState.carrierId, positionToSend);
                }
            }

            // Overheat Mode Logic
            fragmentState.continuousHoldTime = (fragmentState.continuousHoldTime || 0) + deltaTimeMs;
            // Update the fragment state in FragmentManager to persist continuousHoldTime
            // This ensures that even if this client stops being the authoritative one, the next one has the correct continuousHoldTime.
            // We only need to send the specific field that changed if updateFragmentState supports partial updates.
            // Otherwise, send the whole state (which might be safer if structure of fragmentState is complex).
            // For now, let's assume a targeted update or that fragmentState is a reference that gets updated.
            // A more robust way: this.fragmentManager.incrementContinuousHoldTime(fragmentState.id, deltaTimeMs);
            // For this step, direct update and then network sync via updateFragmentState.
            this.fragmentManager.updateFragmentState(fragmentState.id, { continuousHoldTime: fragmentState.continuousHoldTime });


            if (fragmentState.continuousHoldTime >= fragmentState.OVERHEAT_THRESHOLD && !this.gameState.isOverheatModeActive) {
                this.gameState.isOverheatModeActive = true;
                this.networkManager.updateRoomState({ isOverheatModeActive: true });
                if(this.effectsManager) this.effectsManager.startOverheatVisualGlitches();
                // Initialize timers for the first effects
                this.gameState.nextOverheatExplosionTime = this.gameState.gameTime * 1000 + (Math.random() * 5000 + 2000); // gameTime is in sec
                this.gameState.nextHallucinationTime = this.gameState.gameTime * 1000 + (Math.random() * 10000 + 5000);
                console.log("OVERHEAT MODE ACTIVATED");
                if (this.streamerDataManager) this.streamerDataManager.addStreamerEvent("Overheat Mode Activated!");
                if (this.matchStatsManager) this.matchStatsManager.addTimelineEvent("Overheat Mode Activated!", "game-event");
            }
        } else { // Fragment is not collected or no carrier
            if (this.gameState.isOverheatModeActive) {
                this.gameState.isOverheatModeActive = false;
                this.networkManager.updateRoomState({ isOverheatModeActive: false });
                 if(this.effectsManager) this.effectsManager.stopOverheatVisualGlitches();
                console.log("OVERHEAT MODE DEACTIVATED");
            }
        }

        // Overheat Effects Triggering (still inside if(isScoringClient) block)
        if (this.gameState.isOverheatModeActive) {
            const currentTimeMs = this.gameState.gameTime * 1000; // gameTime is in seconds

            // Random Explosions
            if (currentTimeMs >= this.gameState.nextOverheatExplosionTime) {
                const randomX = (Math.random() - 0.5) * 100; // Example map bounds
                const randomZ = (Math.random() - 0.5) * 100;
                const randomPosition = [randomX, 2, randomZ]; // Assuming y=2 is groundish
                this.networkManager.sendOverheatEffect({ effectType: 'explosion', position: randomPosition });
                this.gameState.nextOverheatExplosionTime = currentTimeMs + (Math.random() * 8000 + 3000); // Next one in 3-11s
            }

            // Hallucinated Enemies
            if (currentTimeMs >= this.gameState.nextHallucinationTime) {
                const randomX = (Math.random() - 0.5) * 80;
                const randomZ = (Math.random() - 0.5) * 80;
                const randomPosition = [randomX, 1, randomZ]; // Hallucinations can be at player height
                const enemyTypes = ['ghost_jellyfish', 'shadow_figure', 'creepy_krab']; // Example types
                const randomEnemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                this.networkManager.sendOverheatEffect({ effectType: 'hallucination', position: randomPosition, enemyType: randomEnemyType });
                this.gameState.nextHallucinationTime = currentTimeMs + (Math.random() * 15000 + 8000); // Next one in 8-23s
            }
        }
    }

    updateGlobalCorruption(amount) {
        if (!this.gameState || !this.networkManager || !this.uiManager) {
            console.error("Cannot update global corruption - core components missing.");
            return;
        }
        this.gameState.corruptionLevel = Math.min(100, this.gameState.corruptionLevel + amount);

        if (this.networkManager.updateRoomState) {
            this.networkManager.updateRoomState({ globalCorruption: this.gameState.corruptionLevel });
        }

        if (this.uiManager.updateCorruptionDisplay) {
            this.uiManager.updateCorruptionDisplay(); // UIManager reads directly from gameState
        }

        if (this.gameState.corruptionLevel >= 100) {
            this.triggerMeltPhase();
        }
    }

    triggerMeltPhase() {
        if (this.gameState.isMeltPhaseActive) return; // Already active

        console.warn("MELT PHASE TRIGGERED! The simulation is collapsing!");
        this.gameState.isMeltPhaseActive = true;
        if (this.streamerDataManager) this.streamerDataManager.addStreamerEvent("Melt Phase Initiated!");
        if (this.matchStatsManager) this.matchStatsManager.addTimelineEvent("Melt Phase Initiated!", "game-event-critical");

        // This state change should be authoritative or at least triggered by the client
        // who pushed corruption to 100%. NetworkManager syncs it.
        if (this.networkManager && typeof this.networkManager.updateRoomState === 'function') {
            this.networkManager.updateRoomState({
                isMeltPhaseActive: true,
                globalCorruption: 100 // Ensure corruption is capped / set
            });
        } else {
            console.error("NetworkManager or updateRoomState not available to sync Melt Phase.");
        }

        // Apply effects locally immediately for the client triggering it (or any client processing this).
        // Other clients will apply effects when they receive the roomState update via NetworkManager.
        if (this.uiManager && typeof this.uiManager.setMeltPhaseVisuals === 'function') {
            this.uiManager.setMeltPhaseVisuals(true);
        } else {
            console.error("UIManager or setMeltPhaseVisuals not available.");
        }

        if (this.audioManager && typeof this.audioManager.startMeltPhaseNarration === 'function') {
            this.audioManager.startMeltPhaseNarration();
        } else {
            console.error("AudioManager or startMeltPhaseNarration not available.");
        }

        // Optional: End game after a delay
        // setTimeout(() => {
        //     if (this.gameState.isMeltPhaseActive) { // Check if still in melt phase (not reset)
        //         this.endGame("Corruption reached critical levels.");
        //     }
        // }, 30000); // End after 30s
    }

    isAuthoritativeClient() {
        if (!this.networkManager || !this.networkManager.getPlayerId()) {
            // console.warn("isAuthoritativeClient: NetworkManager not available or player ID not set.");
            return false; // Cannot determine without network info
        }
        if (this.gameState && this.gameState.chaosInfluencerId) {
            return this.networkManager.getPlayerId() === this.gameState.chaosInfluencerId;
        }
        // Fallback: lowest connected peer ID is authoritative
        const connectedPeers = this.networkManager.getConnectedPeersIds(); // Includes self from NM implementation
        if (!connectedPeers || connectedPeers.length === 0) {
            // console.warn("isAuthoritativeClient: No connected peers.");
            return true; // Or false, depending on desired behavior in an empty/local room
        }
        // Sort IDs alphabetically/numerically to ensure consistent tie-breaking
        const lowestId = connectedPeers.sort()[0];
        return this.networkManager.getPlayerId() === lowestId;
    }

    getPlayerPosition(playerId) {
        if (!playerId) return null;
        if (this.player && playerId === this.player.getPlayerId()) {
            return this.player.position.clone(); // Return a clone to prevent direct modification
        } else if (this.otherPlayers && this.otherPlayers.has(playerId)) {
            const otherPlayer = this.otherPlayers.get(playerId);
            if (otherPlayer.mesh) { // Other players' positions are on their mesh
                return otherPlayer.mesh.position.clone();
            }
        }
        // Fallback to presence data if available (might be slightly delayed)
        if (this.networkManager && this.networkManager.room && this.networkManager.room.presence[playerId]) {
            const presencePos = this.networkManager.room.presence[playerId].position;
            if (presencePos && Array.isArray(presencePos)) {
                return new THREE.Vector3(...presencePos);
            }
        }
        console.warn(`getPlayerPosition: Could not find position for player ${playerId}`);
        return null;
    }

    setPlayerPosition(playerId, newPosition) {
        if (!playerId || !newPosition) return;

        if (this.player && playerId === this.player.getPlayerId()) {
            this.player.position.copy(newPosition);
            if (typeof this.player.snapCameraToPosition === 'function') {
                this.player.snapCameraToPosition();
            } else {
                // Default camera update if snap method doesn't exist
                if(this.camera) this.camera.position.copy(this.player.position).add(this.player.cameraHeight instanceof THREE.Vector3 ? this.player.cameraHeight : new THREE.Vector3(0, this.player.cameraHeight || 1.6, 0));
            }
            // Important: Update presence so other players see the new position
            if (this.networkManager) {
                this.networkManager.updatePresence(this.player.getPresenceData());
            }
        } else if (this.otherPlayers && this.otherPlayers.has(playerId)) {
            const otherPlayer = this.otherPlayers.get(playerId);
            if (otherPlayer.mesh) {
                otherPlayer.mesh.position.copy(newPosition);
            }
             // Also update the internal position if we store it separately (though usually mesh.position is the source of truth for remotes)
            if (otherPlayer.position instanceof THREE.Vector3) {
                 otherPlayer.position.copy(newPosition);
            } else {
                 otherPlayer.position = newPosition.clone();
            }
        } else {
            console.warn(`setPlayerPosition: Could not find player ${playerId} to update position.`);
        }
    }

    getPlayerName(playerId) {
        if (!playerId) return 'Unknown Player';
        if (this.player && playerId === this.player.getPlayerId()) {
            return this.player.username || `Player ${playerId.substring(0, 4)}`;
        }
        if (this.networkManager && this.networkManager.getUsername) {
            return this.networkManager.getUsername(playerId) || `Player ${playerId.substring(0, 4)}`;
        }
        // Fallback if NM or its method isn't available
        const otherPlayerData = this.otherPlayers.get(playerId);
        if (otherPlayerData && otherPlayerData.username) { // Assuming username might be on otherPlayer object
            return otherPlayerData.username;
        }
        return `Player ${playerId.substring(0, 4)}`;
    }

    performPlayerSwap(playerA_id, playerB_id) {
        if (!playerA_id || !playerB_id || playerA_id === playerB_id) {
            if(this.uiManager) this.uiManager.addConsoleLogMessage("Swap failed: Invalid player IDs.", "error");
            console.error("Swap failed: Invalid player IDs provided.", playerA_id, playerB_id);
            return;
        }

        const posA = this.getPlayerPosition(playerA_id);
        const posB = this.getPlayerPosition(playerB_id);

        if (!posA || !posB) {
            if(this.uiManager) this.uiManager.addConsoleLogMessage("Swap failed: Could not retrieve positions for one or both players.", "error");
            console.error("Swap failed: Positions not found for players.", playerA_id, playerB_id, posA, posB);
            return;
        }

        if (this.effectsManager && typeof this.effectsManager.triggerSwapEffect === 'function') {
            this.effectsManager.triggerSwapEffect(posA);
            this.effectsManager.triggerSwapEffect(posB);
        } else {
            console.warn("EffectsManager or triggerSwapEffect not found.");
        }

        // Perform the swap
        this.setPlayerPosition(playerA_id, posB);
        this.setPlayerPosition(playerB_id, posA);

        const nameA = this.getPlayerName(playerA_id);
        const nameB = this.getPlayerName(playerB_id);

        if(this.uiManager) this.uiManager.addConsoleLogMessage(`Successfully swapped ${nameA} with ${nameB}.`, "info");
        console.log(`Successfully swapped ${nameA} (${playerA_id}) with ${nameB} (${playerB_id})`);
    }

    recordConfessional(quoteText, boothId) {
        if (!this.player || !this.gameState || !this.networkManager || !this.uiManager || !this.audioManager) {
            console.error("Cannot record confessional: Core components missing.");
            return;
        }

        const playerId = (this.player && typeof this.player.getPlayerId === 'function')
            ? this.player.getPlayerId()
            : (this.networkManager && typeof this.networkManager.getPlayerId === 'function'
                ? this.networkManager.getPlayerId()
                : 'unknownPlayer');

        let playerName = 'Anonymous';
        if (this.player && this.player.username) {
            playerName = this.player.username;
        } else if (playerId !== 'unknownPlayer' && this.networkManager && typeof this.networkManager.getUsername === 'function') {
            playerName = this.networkManager.getUsername(playerId) || `Player ${playerId.substring(0, 4)}`;
        } else if (playerId !== 'unknownPlayer' && this.networkManager && this.networkManager.room && this.networkManager.room.presence && this.networkManager.room.presence[playerId] && this.networkManager.room.presence[playerId].username) {
            playerName = this.networkManager.room.presence[playerId].username;
        } else {
             playerName = `Player ${playerId !== 'unknownPlayer' ? playerId.substring(0,4) : 'Unknown'}`;
        }

        const logEntry = {
            quote: quoteText,
            playerId: playerId,
            playerName: playerName,
            team: this.player.team,
            boothId: boothId,
            timestamp: Date.now()
        };

        this.gameState.confessionalLogs.push(logEntry); // Store locally

        if (this.networkManager && typeof this.networkManager.sendNewConfessionalLog === 'function') {
            this.networkManager.sendNewConfessionalLog(logEntry);
        } else {
            console.warn("NetworkManager.sendNewConfessionalLog is not available.");
        }

        if (this.uiManager && typeof this.uiManager.addConsoleLogMessage === 'function') {
            // Using console log for feedback, could also be a specific UI notification
            this.uiManager.addConsoleLogMessage(`Confessional recorded at ${boothId}: "${quoteText}"`, "info");
        }

        if (this.audioManager && typeof this.audioManager.playSound === 'function') {
            this.audioManager.playSound('confessional_saved'); // Ensure this sound key exists
        }
    }
}