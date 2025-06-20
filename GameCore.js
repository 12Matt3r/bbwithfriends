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

export class GameCore {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        this.player = new Player();
        this.gameState = new GameState();
        
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
        
        this.init();
    }
    
    async init() {
        this.uiManager = new UIManager(this);
        this.audioManager = new AudioManager();
        this.networkManager = new NetworkManager(this);
        
        this.uiManager.showLoadingScreen();
        
        await this.initializeGraphics();
        await this.audioManager.initialize();
        await this.networkManager.initialize();
        
        this.inputManager = new InputManager(this);
        this.consoleManager = new ConsoleManager(this);
        
        setTimeout(() => {
            this.uiManager.hideLoadingScreen();
            this.uiManager.showMainMenu();
        }, 3000);
    }
    
    startGame() {
        /* @tweakable game start sequence timing and flow */
        this.gameState.isGameStarted = true;
        this.uiManager.hideMainMenu();
        this.uiManager.showGameUI();
        
        // Set initial team assignment
        /* @tweakable team assignment logic for game balance */
        const teamCount = Object.values(this.networkManager.room?.presence || {}).length;
        this.player.team = teamCount % 2 === 0 ? 'alpha' : 'beta';
        
        // Update UI with team info
        this.uiManager.updateScoreDisplay();
        this.uiManager.updateHealthDisplay();
        this.uiManager.updateAmmoDisplay();
        this.uiManager.updateCorruptionDisplay();
        
        // Start respawn player at team base
        this.respawnPlayer();
        
        // Request pointer lock for FPS controls
        this.requestPointerLock();
        
        // Start the game loop
        this.gameLoop();
        
        // Initialize team-based UI
        this.uiManager.updatePlayerList();
        
        // Sync initial presence
        this.networkManager.updatePresence(this.player.getPresenceData());
    }
    
    restartGame() {
        /* @tweakable game restart behavior */
        this.gameState.reset();
        this.player.respawn();
        this.fragmentManager.createFragment('center_fragment', { x: 0, y: 5, z: 0 });
        this.uiManager.hideGameOver();
        this.startGame();
    }
    
    endGame(winningTeam) {
        /* @tweakable end game sequence and victory conditions */
        this.gameState.isGameStarted = false;
        
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
        
        this.uiManager.showGameOver(winningTeam, this.player.team, this.gameState.corruptionLevel);
        
        // Reset game state for potential restart
        this.gameState.reset();
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
        for (const [playerId, playerData] of this.otherPlayers.entries()) {
            if (!currentPlayers.has(playerId)) {
                console.log(`Removing disconnected player ${playerId}`);
                this.scene.remove(playerData.mesh);
                this.otherPlayers.delete(playerId);
            }
        }
        
        /* @tweakable multiplayer synchronization debugging */
        if (this.otherPlayers.size > 0 && Math.random() < 0.01) { // 1% chance per frame
            console.log(`Currently tracking ${this.otherPlayers.size} other players`);
        }
    }
    
    updatePlayerModel(playerId, presence) {
        const playerData = this.otherPlayers.get(playerId);
        if (!playerData) return;
        
        const { mesh, healthBar, weaponIndicator, teamRing } = playerData;
        
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
            const healthPercent = Math.max(0.05, presence.health / 100); // Minimum visibility
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
        
        playerData.lastUpdate = Date.now();
    }
    
    handleShoot() {
        const shotResults = this.weaponManager.shoot();
        if (!shotResults) return;
        
        this.uiManager.updateAmmoDisplay();
        
        // Process each shot result (for shotguns)
        shotResults.forEach(shotResult => {
            if (shotResult.intersects.length > 0) {
                const hit = shotResult.intersects[0];
                this.handleHit(hit, shotResult.damage);
                
                // Create hit effect at impact point
                this.effectsManager.createHitEffect(hit.point);
                
                // Check if we hit another player
                const hitObject = hit.object;
                if (hitObject.userData.playerId && hitObject.userData.playerId !== this.networkManager.room.clientId) {
                    let damage = shotResult.damage;
                    
                    // Apply damage boost if active
                    if (this.playerBuffs.damageBoost.active) {
                        /* @tweakable damage boost multiplier for corruption pool buff */
                        damage *= 1.5;
                    }
                    
                    this.networkManager.room.requestPresenceUpdate(hitObject.userData.playerId, {
                        type: 'damage',
                        amount: damage
                    });
                    
                    this.uiManager.addKillFeedEntry(`Hit ${this.networkManager.room.peers[hitObject.userData.playerId]?.username || 'Unknown'}`);
                }
            }
        });
        
        this.addCorruption(0.5);
        
        this.networkManager.send({
            type: 'player_shot',
            playerId: this.networkManager.room.clientId,
            position: this.player.position.toArray(),
            direction: this.camera.getWorldDirection(new THREE.Vector3()).toArray(),
            weaponType: this.player.weaponType
        });
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
    
    handlePlayerDeath(killerId) {
        this.uiManager.addKillFeedEntry(`You were eliminated by ${this.networkManager.room.peers[killerId]?.username || 'Unknown'}`);
        
        if (this.player.hasFragment) {
            // Drop fragment at current position when killed
            const dropPos = this.player.dropFragment();
            this.fragmentManager.createFragment('center_fragment', dropPos);
            
            // Network sync fragment drop
            this.networkManager.send({
                type: 'fragment_dropped',
                playerId: this.networkManager.room.clientId,
                position: dropPos.toArray()
            });
        }
        
        setTimeout(() => {
            this.respawnPlayer();
        }, 3000);
    }
    
    respawnPlayer() {
        this.player.respawn();
        this.uiManager.updateHealthDisplay();
        this.uiManager.hideFragmentIndicator();
        
        this.networkManager.updatePresence(this.player.getPresenceData());
    }
    
    gameLoop() {
        if (!this.gameState.isGameStarted) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - (this.lastTime || currentTime)) / 1000;
        this.lastTime = currentTime;
        
        this.player.updateMovement(this.inputManager.controls, this.camera, deltaTime);
        this.fragmentManager.animateFragment(currentTime / 1000);
        
        // Update multiplayer player rendering
        this.updateOtherPlayers();
        
        // Update weapon recoil
        if (this.weaponManager) {
            this.weaponManager.updateRecoil(deltaTime);
        }
        
        // Update environment cooldowns
        if (this.environment) {
            this.environment.updateCooldowns(deltaTime);
        }
        
        this.checkFragmentPickup();
        this.checkTreasureMapInteractions();
        this.checkMidMatchObjectives();
        this.updateScoring(deltaTime);
        this.checkFragmentRespawn();
        this.updateChaosEvents(deltaTime, Date.now());
        
        this.gameState.updateTime(deltaTime);
        this.networkManager.updatePresence(this.player.getPresenceData());
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    checkFragmentPickup() {
        if (!this.player.hasFragment && this.fragmentManager.checkFragmentPickup(this.player.position)) {
            this.collectFragment();
        }
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
        
        const interaction = this.treasureMapManager.checkInteractions(
            this.player.position,
            this.networkManager.room.clientId,
            this.player.team
        );
        
        if (interaction && interaction.available) {
            this.uiManager.showTreasureMapInteraction(interaction.type);
        } else {
            this.uiManager.hideTreasureMapInteraction();
        }
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
    
    checkWinCondition() {
        return this.gameState.checkWinCondition();
    }
}