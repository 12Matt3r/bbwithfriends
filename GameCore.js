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
import { LobbyManager } from './LobbyManager.js';
import { StreamerDataManager } from './StreamerDataManager.js';
import { MatchStatsManager } from './MatchStatsManager.js';
import { TEAM_IDS, PLAYER_CLASSES, MESSAGE_TYPES } from './Constants.js';

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

const PLAYER_MODEL_CONFIG = Object.freeze({
    SCALE: 1.5,
    CAPSULE_RADIUS_FACTOR: 0.5, // Original was 0.5 * playerModelScale
    CAPSULE_HEIGHT_FACTOR: 2.0,  // Original was 2.0 * playerModelScale

    USERNAME_SPRITE_SCALE_X: 4,
    USERNAME_SPRITE_SCALE_Y: 1.5,
    USERNAME_OFFSET_Y_FACTOR: 2.8, // This factor will be multiplied by PLAYER_MODEL_CONFIG.SCALE
    USERNAME_FONT_SIZE: 36,
    USERNAME_CANVAS_WIDTH: 512,
    USERNAME_CANVAS_HEIGHT: 128,
    USERNAME_BG_COLOR: 'rgba(0, 0, 0, 0.9)',
    USERNAME_BORDER_COLOR: '#ffffff',
    USERNAME_TEXT_COLOR: '#ffffff',
    USERNAME_BORDER_LINEWIDTH: 4,

    HEALTH_BAR_BASE_WIDTH: 1.0, // Base width, will be scaled by player model scale
    HEALTH_BAR_HEIGHT_FACTOR: 0.2, // Relative to HEALTH_BAR_BASE_WIDTH or absolute height? Let's make it absolute for now.
    HEALTH_BAR_OFFSET_Y_FACTOR: 2.3, // Multiplied by PLAYER_MODEL_CONFIG.SCALE
    HEALTH_BAR_BORDER_OFFSET: 0.05, // For border plane sizing
    HEALTH_BAR_BORDER_Z_OFFSET: -0.001,
    HEALTH_BAR_DEFAULT_COLOR: 0x00ff00, // Green
    HEALTH_BAR_BORDER_COLOR: 0x000000,

    WEAPON_INDICATOR_GEOMETRY_X: 0.08,
    WEAPON_INDICATOR_GEOMETRY_Y: 0.08,
    WEAPON_INDICATOR_GEOMETRY_Z: 0.4,
    WEAPON_INDICATOR_SCALE_FACTOR: 2.0, // Applied to its own geometry factors above
    WEAPON_INDICATOR_OFFSET_X_FACTOR: 0.3, // Multiplied by PLAYER_MODEL_CONFIG.SCALE
    WEAPON_INDICATOR_OFFSET_Y_FACTOR: 0.5, // Multiplied by PLAYER_MODEL_CONFIG.SCALE
    WEAPON_INDICATOR_OFFSET_Z_FACTOR: -0.4, // Multiplied by PLAYER_MODEL_CONFIG.SCALE
    WEAPON_INDICATOR_COLOR: 0x666666,
    WEAPON_INDICATOR_EMISSIVE: 0x0088ff,
    WEAPON_INDICATOR_EMISSIVE_INTENSITY: 0.8,

    TEAM_RING_INNER_RADIUS: 0.8,
    TEAM_RING_OUTER_RADIUS: 1.0,
    TEAM_RING_SEGMENTS: 16,
    TEAM_RING_OPACITY: 0.7,
    TEAM_RING_OFFSET_Y_FACTOR: -0.8, // Multiplied by PLAYER_MODEL_CONFIG.SCALE
});
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

    _initCoreManagers() {
        this.uiManager = new UIManager(this);
        this.audioManager = new AudioManager();
        this.networkManager = new NetworkManager(this);
        this.lobbyManager = new LobbyManager(this);
    }

    _initAuxiliaryManagers() {
        this.inputManager = new InputManager(this);
        this.consoleManager = new ConsoleManager(this);
        this.streamerDataManager = new StreamerDataManager(this);
        this.matchStatsManager = new MatchStatsManager(this);
    }

    async init() {
        this._initCoreManagers();
        
        this.uiManager.showLoadingScreen();
        
        // Graphics initialization must happen before AudioManager init that needs the camera
        await this.initializeGraphics();

        if (this.camera && this.audioManager && typeof this.audioManager.initialize === 'function') {
            await this.audioManager.initialize(this.camera);
        } else {
            console.error("GameCore: Failed to initialize AudioManager with camera. Camera or AudioManager not ready.");
            await this.audioManager.initialize();
        }

        await this.networkManager.initialize(); // Network must be initialized before FragmentManager that uses networkManager.room

        // FragmentManager needs networkManager.room, so initialize after networkManager.initialize()
        this.fragmentManager = new FragmentManager(this.scene, this.networkManager.room);
        if (this.fragmentManager) { // Check if instantiation was successful
             // TODO: Use a constant for 'center_fragment' if it becomes a pattern
            this.fragmentManager.createFragment('center_fragment', { x: 0, y: 5, z: 0 });
        } else {
            console.error("GameCore: FragmentManager instantiation failed or networkManager.room was not ready.");
        }

        this._initAuxiliaryManagers();

        this.lobbyManager.initialize(); // Depends on UIManager and NetworkManager
        
        setTimeout(() => {
            this.uiManager.hideLoadingScreen();
            this.uiManager.showMainMenu();
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

        let selectedClass = PLAYER_CLASSES.ASSAULT; // Default
        if (localPlayerLobbyData) {
            if (localPlayerLobbyData.teamColor) {
                // Assuming teamColor from lobby maps to TEAM_IDS.ALPHA or TEAM_IDS.BETA
                // This mapping might need to be more robust if lobby team colors are arbitrary strings
                if (localPlayerLobbyData.teamColor === 'blue') this.player.team = TEAM_IDS.ALPHA;
                else if (localPlayerLobbyData.teamColor === 'red') this.player.team = TEAM_IDS.BETA;
                else {
                    const teamKeys = Object.keys(this.networkManager.room?.peers || {});
                    const playerIndex = teamKeys.indexOf(localPlayerId);
                    this.player.team = playerIndex >= 0 && playerIndex % 2 === 0 ? TEAM_IDS.ALPHA : TEAM_IDS.BETA;
                }
            }
            selectedClass = localPlayerLobbyData.playerClass || PLAYER_CLASSES.ASSAULT;
        } else {
            const teamCount = Object.values(this.networkManager.room?.presence || {}).length;
            this.player.team = teamCount % 2 === 0 ? TEAM_IDS.ALPHA : TEAM_IDS.BETA;
        }
        this.player.setClass(selectedClass);

        // UI Updates reflect the class changes made by player.setClass
        this.uiManager.updateScoreDisplay();
        this.uiManager.updateCorruptionDisplay();
        
        this.respawnPlayer(true); // Pass true for initial spawn
        
        // Request pointer lock for FPS controls
        this.requestPointerLock();
        
        // Game loop is now driven by animate()
        
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

    _setupThreeJS() {
        const canvas = document.getElementById('game-canvas');
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000000, 20, 150); // TODO: Use constants for fog values
        
        this.camera = new THREE.PerspectiveCamera(
            75, // FOV // TODO: Use constant
            window.innerWidth / window.innerHeight, // Aspect Ratio
            0.1, // Near plane // TODO: Use constant
            1000 // Far plane // TODO: Use constant
        );
        // Player is created in GameCore constructor, so this.player.position is available
        this.camera.position.copy(this.player.position);
        this.camera.position.y += this.player.cameraOffsetY; // Adjust for player height
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000011); // TODO: Use constant for clear color
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0; // TODO: Use constant
        this.renderer.physicallyCorrectLights = true;
    }

    async _loadCoreGameAssets() {
        this.environment = new Environment(this.scene);
        await this.environment.create();
        
        this.treasureMapManager = new TreasureMapManager(this.scene, this.networkManager);
        this.environment.setTreasureMapManager(this.treasureMapManager);
        
        // FragmentManager is now initialized in init() after NetworkManager
    }

    async _setupPlayerAndWeaponSystems() {
        if (this.player && this.environment) {
            this.player.setEnvironment(this.environment);
        } else {
            console.error("GameCore: Player or Environment not ready for linking in _setupPlayerAndWeaponSystems.");
        }
        
        this.weaponManager = new WeaponManager(this.scene, this.camera, this.player, this.audioManager);
        if (this.weaponManager && typeof this.weaponManager.loadWeaponModel === 'function') {
            await this.weaponManager.loadWeaponModel();
        }

        // Pass gameCore directly to EffectsManager if it needs more than just scene, gameState, environment
        this.effectsManager = new EffectsManager(this.scene, this.gameState, this.environment /*, this.gameCore */);
    }

    async initializeGraphics() {
        this._setupThreeJS();

        await this._loadCoreGameAssets();
        
        await this._setupPlayerAndWeaponSystems();
        
        this._initializeMultiplayerRendering(); // Renamed for consistency
        
        this.animate(performance.now());
    }
    
    _initializeMultiplayerRendering() { // Renamed
        /* @tweakable multiplayer player model appearance */
        this.playerGeometry = new THREE.CapsuleGeometry(0.3, 1.4, 4, 8);
        this.createPlayerMaterials();
    }
    
    _createPlayerMaterials() { // Renamed
        this.playerMaterials = {
            [TEAM_IDS.ALPHA]: new THREE.MeshStandardMaterial({
                color: 0x00aaff, // Blue
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x004466,
                emissiveIntensity: 0.2
            }),
            [TEAM_IDS.BETA]: new THREE.MeshStandardMaterial({
                color: 0xff6600, // Orange
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x664400,
                emissiveIntensity: 0.2
            }),
            [TEAM_IDS.NONE]: new THREE.MeshStandardMaterial({ // Fallback/Neutral
                color: 0x888888,
                metalness: 0.3,
                roughness: 0.7,
                emissive: 0x333333,
                emissiveIntensity: 0.1
            })
        };
    }
    
    createPlayerModel(playerId, playerData) {
        const playerModelScale = PLAYER_MODEL_CONFIG.SCALE;
        const playerCapsuleRadius = PLAYER_MODEL_CONFIG.CAPSULE_RADIUS_FACTOR * playerModelScale;
        const playerCapsuleHeight = PLAYER_MODEL_CONFIG.CAPSULE_HEIGHT_FACTOR * playerModelScale;
        const playerGeometry = new THREE.CapsuleGeometry(playerCapsuleRadius, playerCapsuleHeight, 4, 8);

        const teamMaterialKey = playerData.team && Object.values(TEAM_IDS).includes(playerData.team) ? playerData.team : TEAM_IDS.NONE;
        const teamMaterial = this.playerMaterials[teamMaterialKey] || this.playerMaterials[TEAM_IDS.NONE];
        
        const enhancedMaterial = teamMaterial.clone();
        enhancedMaterial.emissiveIntensity = 0.6;
        enhancedMaterial.metalness = 0.1;
        enhancedMaterial.roughness = 0.8;
        
        const playerMesh = new THREE.Mesh(playerGeometry, enhancedMaterial);
        playerMesh.userData = { playerId, type: 'player' }; // TODO: Use constant for type: 'player' if defined
        playerMesh.castShadow = true;
        playerMesh.receiveShadow = true;
        
        const usernameSprite = this._createPlayerUsernameSprite(this.networkManager.room.peers[playerId]?.username || 'Unknown');
        playerMesh.add(usernameSprite);
        
        const healthBar = this._createPlayerHealthBar();
        playerMesh.add(healthBar);
        
        const weaponIndicator = this._createPlayerWeaponIndicator();
        playerMesh.add(weaponIndicator);
        
        const teamRing = this._createPlayerTeamRing(playerData.team);
        playerMesh.add(teamRing);
        
        this.scene.add(playerMesh);
        this.otherPlayers.set(playerId, {
            mesh: playerMesh,
            usernameSprite,
            healthBar,
            weaponIndicator,
            teamRing,
            lastUpdate: Date.now(),
            playerClass: playerData.playerClass, // Store for reference
            maxHealth: playerData.maxHealth,     // Store for reference
            isSpeaking: !!playerData.isSpeaking, // Ensure boolean
            hasFragment: !!playerData.hasFragment // Ensure boolean
        });
        
        console.log(`Created player model for ${playerId} on team ${playerData.team}`);
        return playerMesh;
    }
    
    _createPlayerTeamRing(team) { // Renamed
        const ringGeometry = new THREE.RingGeometry(
            PLAYER_MODEL_CONFIG.TEAM_RING_INNER_RADIUS,
            PLAYER_MODEL_CONFIG.TEAM_RING_OUTER_RADIUS,
            PLAYER_MODEL_CONFIG.TEAM_RING_SEGMENTS
        );
        const ringColor = team === TEAM_IDS.ALPHA ? 0x00aaff : (team === TEAM_IDS.BETA ? 0xff6600 : 0x888888);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: ringColor,
            transparent: true,
            opacity: PLAYER_MODEL_CONFIG.TEAM_RING_OPACITY,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(0, PLAYER_MODEL_CONFIG.TEAM_RING_OFFSET_Y_FACTOR * PLAYER_MODEL_CONFIG.SCALE, 0);
        return ring;
    }
    
    _createPlayerUsernameSprite(username) { // Renamed
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = PLAYER_MODEL_CONFIG.USERNAME_CANVAS_WIDTH;
        canvas.height = PLAYER_MODEL_CONFIG.USERNAME_CANVAS_HEIGHT;
        
        context.fillStyle = PLAYER_MODEL_CONFIG.USERNAME_BG_COLOR;
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.strokeStyle = PLAYER_MODEL_CONFIG.USERNAME_BORDER_COLOR;
        context.lineWidth = PLAYER_MODEL_CONFIG.USERNAME_BORDER_LINEWIDTH;
        context.strokeRect(
            PLAYER_MODEL_CONFIG.USERNAME_BORDER_LINEWIDTH / 2,
            PLAYER_MODEL_CONFIG.USERNAME_BORDER_LINEWIDTH / 2,
            canvas.width - PLAYER_MODEL_CONFIG.USERNAME_BORDER_LINEWIDTH,
            canvas.height - PLAYER_MODEL_CONFIG.USERNAME_BORDER_LINEWIDTH
        );
        
        context.fillStyle = PLAYER_MODEL_CONFIG.USERNAME_TEXT_COLOR;
        context.font = `bold ${PLAYER_MODEL_CONFIG.USERNAME_FONT_SIZE}px Arial`;
        context.textAlign = 'center';
        context.fillText(username, canvas.width / 2, canvas.height / 2 + PLAYER_MODEL_CONFIG.USERNAME_FONT_SIZE / 3);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(PLAYER_MODEL_CONFIG.USERNAME_SPRITE_SCALE_X, PLAYER_MODEL_CONFIG.USERNAME_SPRITE_SCALE_Y, 1);
        sprite.position.set(0, PLAYER_MODEL_CONFIG.USERNAME_OFFSET_Y_FACTOR * PLAYER_MODEL_CONFIG.SCALE, 0);
        return sprite;
    }
    
    _createPlayerHealthBar() { // Renamed
        const barWidth = PLAYER_MODEL_CONFIG.HEALTH_BAR_BASE_WIDTH * PLAYER_MODEL_CONFIG.SCALE;
        const barHeight = PLAYER_MODEL_CONFIG.HEALTH_BAR_HEIGHT_FACTOR; // Assuming this is an absolute height now
        
        const geometry = new THREE.PlaneGeometry(barWidth, barHeight);
        const material = new THREE.MeshBasicMaterial({
            color: PLAYER_MODEL_CONFIG.HEALTH_BAR_DEFAULT_COLOR,
            transparent: true,
            opacity: 0.95
        });
        
        const healthBar = new THREE.Mesh(geometry, material);
        healthBar.userData = { type: 'healthBar', maxWidth: barWidth }; // maxWidth is now scaled
        
        const borderGeometry = new THREE.PlaneGeometry(
            barWidth + PLAYER_MODEL_CONFIG.HEALTH_BAR_BORDER_OFFSET,
            barHeight + PLAYER_MODEL_CONFIG.HEALTH_BAR_BORDER_OFFSET
        );
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: PLAYER_MODEL_CONFIG.HEALTH_BAR_BORDER_COLOR,
            transparent: true,
            opacity: 0.8
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.position.z = PLAYER_MODEL_CONFIG.HEALTH_BAR_BORDER_Z_OFFSET;
        healthBar.add(border);
        healthBar.position.set(0, PLAYER_MODEL_CONFIG.HEALTH_BAR_OFFSET_Y_FACTOR * PLAYER_MODEL_CONFIG.SCALE, 0);
        return healthBar;
    }
    
    _createPlayerWeaponIndicator() { // Renamed
        const geomX = PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_GEOMETRY_X * PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_SCALE_FACTOR;
        const geomY = PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_GEOMETRY_Y * PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_SCALE_FACTOR;
        const geomZ = PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_GEOMETRY_Z * PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_SCALE_FACTOR;
        const geometry = new THREE.BoxGeometry(geomX, geomY, geomZ);
        const material = new THREE.MeshStandardMaterial({
            color: PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_COLOR,
            metalness: 0.8,
            roughness: 0.2,
            emissive: PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_EMISSIVE,
            emissiveIntensity: PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_EMISSIVE_INTENSITY
        });
        const indicator = new THREE.Mesh(geometry, material);
        indicator.position.set(
            PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_OFFSET_X_FACTOR * PLAYER_MODEL_CONFIG.SCALE,
            PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_OFFSET_Y_FACTOR * PLAYER_MODEL_CONFIG.SCALE,
            PLAYER_MODEL_CONFIG.WEAPON_INDICATOR_OFFSET_Z_FACTOR * PLAYER_MODEL_CONFIG.SCALE
        );
        return indicator;
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
    
    // --- Private Helper Methods for updatePlayerModel ---
    _updateRemotePlayerStateProps(playerObject, presence) {
        if (presence.playerClass) {
            playerObject.playerClass = presence.playerClass;
        }
        if (presence.maxHealth) {
            playerObject.maxHealth = presence.maxHealth;
        }
    }

    _updateRemotePlayerSpeakingEffects(playerId, playerObject, presence) {
        const oldIsSpeaking = playerObject.isSpeaking;
        playerObject.isSpeaking = !!presence.isSpeaking;

        if (playerObject.isSpeaking !== oldIsSpeaking && playerObject.mesh) {
            if (this.effectsManager && typeof this.effectsManager.setPlayerSpeakingIndicator === 'function') {
                this.effectsManager.setPlayerSpeakingIndicator(playerId, playerObject.isSpeaking, playerObject.mesh);
            }
            if (this.audioManager && typeof this.audioManager.setPlayerSpatialTalkingSound === 'function') {
                this.audioManager.setPlayerSpatialTalkingSound(playerId, playerObject.isSpeaking, playerObject.mesh);
            }
        }
    }

    _updateRemotePlayerTransform(playerObject, presence) {
        const mesh = playerObject.mesh;
        if (!mesh) return;

        if (presence.position) {
            const lerpFactor = 0.15;
            const targetPosition = Array.isArray(presence.position) ? new THREE.Vector3(...presence.position) : new THREE.Vector3(presence.position.x, presence.position.y, presence.position.z);
            mesh.position.lerp(targetPosition, lerpFactor);
        }
        if (presence.rotation) {
            const targetRotationY = Array.isArray(presence.rotation) ? presence.rotation[1] : presence.rotation.y;
            if (targetRotationY !== undefined) {
                 mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, targetRotationY, 0.2);
            }
        }
    }

    _updateRemotePlayerHealthBar(playerObject, presence) {
        if (!playerObject.healthBar) return;
        const healthBar = playerObject.healthBar;
        if (presence.health !== undefined) {
            const maxHealth = playerObject.maxHealth || 100;
            const healthPercent = Math.max(0, Math.min(1, presence.health / maxHealth));
            healthBar.scale.x = healthPercent;

            if (healthPercent > 0.7) healthBar.material.color.setHex(0x00ff00); // Green
            else if (healthPercent > 0.4) healthBar.material.color.setHex(0xffff00); // Yellow
            else if (healthPercent > 0.15) healthBar.material.color.setHex(0xff8800); // Orange
            else healthBar.material.color.setHex(0xff0000); // Red
        }
    }

    _updateRemotePlayerTeamVisuals(playerObject, presence) {
        const mesh = playerObject.mesh;
        if (!mesh || !mesh.material) return; // Ensure mesh and its material exist

        const teamId = presence.team;
        if (teamId && this.playerMaterials[teamId]) {
            // Only clone and assign if material is different to avoid unnecessary operations
            if (mesh.material.uuid !== this.playerMaterials[teamId].uuid && mesh.material.name !== this.playerMaterials[teamId].name) {
                mesh.material = this.playerMaterials[teamId].clone();
                mesh.material.name = this.playerMaterials[teamId].name; // Keep name for potential future checks
            }
            mesh.material.emissiveIntensity = (this.player && teamId === this.player.team) ? 0.8 : 0.6;
        } else if (this.playerMaterials[TEAM_IDS.NONE]) { // Fallback for undefined or invalid team
            if (mesh.material.uuid !== this.playerMaterials[TEAM_IDS.NONE].uuid && mesh.material.name !== this.playerMaterials[TEAM_IDS.NONE].name) {
                mesh.material = this.playerMaterials[TEAM_IDS.NONE].clone();
                mesh.material.name = this.playerMaterials[TEAM_IDS.NONE].name;
            }
            mesh.material.emissiveIntensity = 0.3;
        }

        if (playerObject.teamRing && playerObject.teamRing.material) {
            const ringColorHex = teamId === TEAM_IDS.ALPHA ? 0x00aaff : (teamId === TEAM_IDS.BETA ? 0xff6600 : 0x888888);
            if (playerObject.teamRing.material.color.getHex() !== ringColorHex) {
                 playerObject.teamRing.material.color.setHex(ringColorHex);
            }
        }
    }

    _updateRemotePlayerDeadVisuals(playerObject, presence) {
        const mesh = playerObject.mesh;
        if (!mesh || !mesh.material) return;

        const targetVisible = !presence.dead;
        if (mesh.visible !== targetVisible) {
            mesh.visible = targetVisible;
        }

        if (presence.dead) {
            if (!mesh.material.transparent || mesh.material.opacity !== 0.3) {
                mesh.material.transparent = true;
                mesh.material.opacity = 0.3;
            }
        } else {
            if (mesh.material.transparent || mesh.material.opacity !== 1.0) {
                mesh.material.transparent = false;
                mesh.material.opacity = 1.0;
            }
        }
    }

    _updateRemotePlayerWeaponIndicator(playerObject, presence) {
        if (!playerObject.weaponIndicator) return;
        const targetVisible = !!presence.weaponVisible && !presence.dead;
        if (playerObject.weaponIndicator.visible !== targetVisible) {
             playerObject.weaponIndicator.visible = targetVisible;
        }
        if (playerObject.weaponIndicator.material) {
             playerObject.weaponIndicator.material.emissiveIntensity = targetVisible ? 1.0 : 0.3;
        }
    }

    _updateRemotePlayerFragmentEffects(playerObject, presence) {
        const mesh = playerObject.mesh;
        if (!mesh || !mesh.material) return;

        if (presence.hasFragment) {
            const fragmentGlowIntensityBase = 1.5;
            mesh.material.emissiveIntensity = fragmentGlowIntensityBase + Math.sin(Date.now() * 0.008) * 0.8;
            
            const pulseScaleBase = 1.0;
            const pulseMagnitude = 0.1;
            const pulseScale = pulseScaleBase + Math.sin(Date.now() * 0.01) * pulseMagnitude;
            mesh.scale.setScalar(pulseScale);

            if (!mesh.userData.fragmentAura) {
                const auraGeometry = new THREE.SphereGeometry(2.5, 16, 16);
                const auraMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffdd00, transparent: true, opacity: 0.15,
                    side: THREE.DoubleSide, depthWrite: false
                });
                mesh.userData.fragmentAura = new THREE.Mesh(auraGeometry, auraMaterial);
                mesh.add(mesh.userData.fragmentAura);
            }
        } else {
            // Emissive intensity reset is typically handled by _updateRemotePlayerTeamVisuals if team hasn't changed.
            // If team also changed, that method would set it. If not, it might need to be reset here.
            // For simplicity, assuming team visuals or other default state setters will handle base emissive intensity.
            if (Math.abs(mesh.scale.x - 1.0) > 0.01) {
                mesh.scale.setScalar(1.0);
            }
            if (mesh.userData.fragmentAura) {
                mesh.remove(mesh.userData.fragmentAura);
                if (mesh.userData.fragmentAura.geometry) mesh.userData.fragmentAura.geometry.dispose();
                if (mesh.userData.fragmentAura.material) mesh.userData.fragmentAura.material.dispose();
                mesh.userData.fragmentAura = null;
            }
        }
    }
    // --- End of Private Helper Methods ---

    updatePlayerModel(playerId, presence) {
        const playerObject = this.otherPlayers.get(playerId);
        if (!playerObject || !playerObject.mesh) { // Check for mesh early as many helpers depend on it
            // console.warn(`updatePlayerModel: No playerObject or mesh found for ID ${playerId}`);
            return;
        }

        this._updateRemotePlayerStateProps(playerObject, presence);
        this._updateRemotePlayerSpeakingEffects(playerId, playerObject, presence);
        this._updateRemotePlayerTransform(playerObject, presence);
        this._updateRemotePlayerHealthBar(playerObject, presence); // Helper checks for healthBar
        this._updateRemotePlayerTeamVisuals(playerObject, presence); // Helper checks for material & teamRing
        this._updateRemotePlayerDeadVisuals(playerObject, presence); // Helper checks for material
        this._updateRemotePlayerWeaponIndicator(playerObject, presence); // Helper checks for weaponIndicator
        this._updateRemotePlayerFragmentEffects(playerObject, presence); // Helper checks for material

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
            type: MESSAGE_TYPES.FRAGMENT_COLLECTED,
            playerId: this.networkManager.room.clientId,
            team: this.player.team
        });
        
        this.audioManager.playSound('collect'); // TODO: Use SOUND_KEYS constant e.g. SOUND_KEYS.COLLECT_FRAGMENT
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
            type: MESSAGE_TYPES.CHAOS_EVENT_TRIGGERED, // Ensure CHAOS_EVENT_TRIGGERED is in MESSAGE_TYPES
            eventName: selectedEvent.name,
            duration: selectedEvent.duration,
            triggerTime: currentTime
        });
        
        console.log(`Chaos event triggered: ${selectedEvent.name} for ${selectedEvent.duration} seconds`);
    }
    
    randomizeAllWeapons() {
        const weaponTypesArray = Object.values(PLAYER_CLASSES); // Player class implies a default weapon type.
        const randomPlayerClass = weaponTypesArray[Math.floor(Math.random() * weaponTypesArray.length)];
        this.player.setClass(randomPlayerClass); // This will set player's weaponType and update UI via Player.setClass
        // If direct weapon switching without class change is needed, handleWeaponSwitch should take a WEAPON_TYPES value.
        // For now, randomizing class implies randomizing weapon.
        if (this.uiManager) { // Ensure UI is updated if setClass doesn't cover it fully.
            this.uiManager.updateAmmoDisplay();
            this.uiManager.updateWeaponDisplay(this.player.weaponType);
        }
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
        if (this.player.team === TEAM_IDS.ALPHA) {
            spawnPoint = TEAM_ALPHA_SPAWN_POINTS[alphaSpawnIndex % TEAM_ALPHA_SPAWN_POINTS.length];
            alphaSpawnIndex++;
        } else if (this.player.team === TEAM_IDS.BETA) {
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
    
    // Renamed gameLoop to updateGameLogic and adjusted deltaTime usage
    updateGameLogic(currentTime, deltaTime) { // deltaTime is now passed in seconds
        const justPressedActions = this.inputManager.exportAndResetJustPressedActions();
        
        // Pass both held states (controls) and just-pressed actions to player
        this.player.updateStateAndMovement(deltaTime, this.inputManager.controls, this.camera, justPressedActions);
        this.fragmentManager.animateFragment(currentTime / 1000);
        
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
        // No requestAnimationFrame here anymore
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
    
    animate(currentTime) { // currentTime will be provided by requestAnimationFrame
        if (!this.lastTime) { // Initialize lastTime if it's the first frame
            this.lastTime = currentTime;
        }
        const deltaTime = (currentTime - this.lastTime) / 1000; // deltaTime in seconds

        if (this.gameState.isGameStarted) {
            // Call the game logic update function, passing deltaTime
            this.updateGameLogic(currentTime, deltaTime);
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
        
        this.lastTime = currentTime;
        requestAnimationFrame((time) => this.animate(time)); // Pass time to next frame
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

    updateScoreOverTime(deltaTime) { // deltaTime is in seconds
        if (!this.gameState.isGameStarted || !this.networkManager || !this.networkManager.room || !this.fragmentManager) {
            return;
        }
        if (!this.isAuthoritativeClient()) {
            return;
        }

        const deltaTimeMs = deltaTime * 1000;
        const fragmentState = this.fragmentManager.getFragmentState('center_fragment'); // TODO: Use constant for fragment ID

        if (fragmentState && fragmentState.isCollected && fragmentState.carrierId) {
            const carrierPresence = this.networkManager.room.presence[fragmentState.carrierId];
            if (carrierPresence && !carrierPresence.isDead) {
                this._calculateScorePoints(deltaTime, fragmentState, carrierPresence); // deltaTime in seconds
                this._handleFragmentPingLogic(deltaTimeMs, fragmentState, carrierPresence);
            }
        }

        // Overheat mode logic needs to run regardless of carrier, to handle deactivation if fragment is dropped.
        this._handleOverheatModeLogic(deltaTimeMs, fragmentState);
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

    _calculateScorePoints(deltaTime, fragmentState, carrierPresence) {
        const carrierPosition = carrierPresence.position;
        const carrierTeam = carrierPresence.team;

        const isCarrierInAlphaBase = distanceSquared(carrierPosition, TEAM_ALPHA_BASE_CENTER) < BASE_RADIUS_SQUARED;
        const isCarrierInBetaBase = distanceSquared(carrierPosition, TEAM_BETA_BASE_CENTER) < BASE_RADIUS_SQUARED;

        let pointsPerSecond = 0;
        let teamToScore = null;

        if (carrierTeam === TEAM_IDS.ALPHA) {
            if (isCarrierInAlphaBase) { pointsPerSecond = 3; teamToScore = TEAM_IDS.ALPHA; }
            else if (isCarrierInBetaBase) { pointsPerSecond = 1; teamToScore = TEAM_IDS.ALPHA; }
        } else if (carrierTeam === TEAM_IDS.BETA) {
            if (isCarrierInBetaBase) { pointsPerSecond = 3; teamToScore = TEAM_IDS.BETA; }
            else if (isCarrierInAlphaBase) { pointsPerSecond = 1; teamToScore = TEAM_IDS.BETA; }
        }

        if (pointsPerSecond > 0 && teamToScore) {
            const dtSeconds = deltaTime;

            if (teamToScore === TEAM_IDS.ALPHA) {
                this.gameState.alphaScoreAccumulator += pointsPerSecond * dtSeconds;
                if (this.gameState.alphaScoreAccumulator >= SCORE_INTERVAL_SECONDS) {
                    const scoreUnits = Math.floor(this.gameState.alphaScoreAccumulator / SCORE_INTERVAL_SECONDS);
                    this.gameState.scoreAlpha += scoreUnits;
                    this.gameState.alphaScoreAccumulator -= scoreUnits * SCORE_INTERVAL_SECONDS;
                    this.networkManager.updateRoomState({ scoreAlpha: this.gameState.scoreAlpha });
                }
            } else if (teamToScore === TEAM_IDS.BETA) {
                this.gameState.betaScoreAccumulator += pointsPerSecond * dtSeconds;
                if (this.gameState.betaScoreAccumulator >= SCORE_INTERVAL_SECONDS) {
                    const scoreUnits = Math.floor(this.gameState.betaScoreAccumulator / SCORE_INTERVAL_SECONDS);
                    this.gameState.scoreBeta += scoreUnits;
                    this.gameState.betaScoreAccumulator -= scoreUnits * SCORE_INTERVAL_SECONDS;
                    this.networkManager.updateRoomState({ scoreBeta: this.gameState.scoreBeta });
                }
            }
            const winner = this.gameState.checkWinCondition();
            if (winner) {
                this.endGame(winner);
                // Optionally send a specific "game_over" message
                // this.networkManager.send({ type: MESSAGE_TYPES.GAME_OVER, winningTeam: winner });
            }
        }
    }

    _handleFragmentPingLogic(deltaTimeMs, fragmentState, carrierPresence) {
        if (!fragmentState || !fragmentState.isCollected || !fragmentState.carrierId || !carrierPresence || carrierPresence.isDead) {
            return;
        }

        fragmentState.pingAccumulator = (fragmentState.pingAccumulator || 0) + deltaTimeMs;
        if (fragmentState.pingAccumulator >= fragmentState.PING_INTERVAL) {
            fragmentState.pingAccumulator = 0; // Reset accumulator
            const positionToSend = Array.isArray(carrierPresence.position)
                ? carrierPresence.position
                : [carrierPresence.position.x, carrierPresence.position.y, carrierPresence.position.z];
            this.networkManager.sendFragmentPingAlert(fragmentState.carrierId, positionToSend);
        }
    }

    _handleOverheatModeLogic(deltaTimeMs, fragmentState) {
        if (fragmentState && fragmentState.isCollected && fragmentState.carrierId) {
            fragmentState.continuousHoldTime = (fragmentState.continuousHoldTime || 0) + deltaTimeMs;
            // Ensure fragmentManager and its method exist before calling
            if (this.fragmentManager && typeof this.fragmentManager.updateFragmentState === 'function') {
                 this.fragmentManager.updateFragmentState(fragmentState.id, { continuousHoldTime: fragmentState.continuousHoldTime });
            } else {
                console.warn("FragmentManager or updateFragmentState method not available for persisting continuousHoldTime.");
            }


            if (fragmentState.continuousHoldTime >= fragmentState.OVERHEAT_THRESHOLD && !this.gameState.isOverheatModeActive) {
                this.gameState.isOverheatModeActive = true;
                this.networkManager.updateRoomState({ isOverheatModeActive: true });
                if(this.effectsManager) this.effectsManager.startOverheatVisualGlitches();
                this.gameState.nextOverheatExplosionTime = this.gameState.gameTime * 1000 + (Math.random() * 5000 + 2000);
                this.gameState.nextHallucinationTime = this.gameState.gameTime * 1000 + (Math.random() * 10000 + 5000);
                console.log("OVERHEAT MODE ACTIVATED");
                if (this.streamerDataManager) this.streamerDataManager.addStreamerEvent("Overheat Mode Activated!");
                if (this.matchStatsManager) this.matchStatsManager.addTimelineEvent("Overheat Mode Activated!", "game-event");
            }
        } else {
            if (this.gameState.isOverheatModeActive) {
                this.gameState.isOverheatModeActive = false;
                this.networkManager.updateRoomState({ isOverheatModeActive: false });
                if(this.effectsManager) this.effectsManager.stopOverheatVisualGlitches();
                console.log("OVERHEAT MODE DEACTIVATED");
                if (fragmentState && !fragmentState.isCollected && this.fragmentManager && typeof this.fragmentManager.updateFragmentState === 'function') {
                     fragmentState.continuousHoldTime = 0;
                     this.fragmentManager.updateFragmentState(fragmentState.id, { continuousHoldTime: 0 });
                }
            }
        }

        if (this.gameState.isOverheatModeActive) {
            const currentTimeMs = this.gameState.gameTime * 1000;

            if (currentTimeMs >= this.gameState.nextOverheatExplosionTime) {
                const randomX = (Math.random() - 0.5) * 100;
                const randomZ = (Math.random() - 0.5) * 100;
                const randomPosition = [randomX, 2, randomZ];
                this.networkManager.sendOverheatEffect({ effectType: 'explosion', position: randomPosition });
                this.gameState.nextOverheatExplosionTime = currentTimeMs + (Math.random() * 8000 + 3000);
            }

            if (currentTimeMs >= this.gameState.nextHallucinationTime) {
                const randomX = (Math.random() - 0.5) * 80;
                const randomZ = (Math.random() - 0.5) * 80;
                const randomPosition = [randomX, 1, randomZ];
                const enemyTypes = ['ghost_jellyfish', 'shadow_figure', 'creepy_krab'];
                const randomEnemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
                this.networkManager.sendOverheatEffect({ effectType: 'hallucination', position: randomPosition, enemyType: randomEnemyType });
                this.gameState.nextHallucinationTime = currentTimeMs + (Math.random() * 15000 + 8000);
            }
        }
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