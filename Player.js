import * as THREE from 'three';
import { WEAPON_CONFIG } from './WeaponManager.js'; // Import WEAPON_CONFIG
import { PLAYER_CLASSES, WEAPON_TYPES, TEAM_IDS, PLAYER_EFFECT_TYPES } from './Constants.js'; // Added PLAYER_EFFECT_TYPES

export class Player {
    constructor() {
        this.position = new THREE.Vector3(0, 1.8, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0); // Player's body/model rotation
        this.cameraPitch = 0; // For up/down look, separate from body yaw
        this.cameraYaw = 0;
        this.health = 100;
        this.isDead = false;
        this.team = TEAM_IDS.ALPHA;
        this.gameCore = null;
        this.playerClass = PLAYER_CLASSES.ASSAULT;
        this.lastDamageInfo = null;

        // State properties
        // this.isCrouching = false; // Already present from previous version of plan
        // this.isSprinting = false; // Already present
        this.isReloading = false;
        this.reloadTimer = 0; // ms
        this.baseCameraOffsetY = 1.6;
        this.crouchCameraOffsetY = 1.0;
        this.cameraOffsetY = this.baseCameraOffsetY; // Current camera Y offset

        // Speed Multipliers
        this.baseSpeed = 6; // Replaces baseWalkSpeed for clarity
        this.crouchSpeedMultiplier = 0.5;
        this.sprintSpeedMultiplier = 1.5;

        // Fragment related properties
        this.hasFragment = false;
        this.carryingFragmentId = null;
        this.canCollectFragment = false;
        this.currentTouchingFragmentId = null;

        this.weapon = 'jellyfish_blaster'; // Default, can be changed
        this.ammo = 30;
        this.maxAmmo = 120;
        this.environment = null;
        
        // Weapon type selection - will be set by setClass based on playerClass
        // this.weaponType = 'assault';
        
        // Movement states (isSprinting, isCrouching already exist)
        this.normalHeight = 1.8; // Player's collision/model height
        this.crouchHeight = 1.0; // Collision/model height when crouching
        this.currentHeight = this.normalHeight;
        
        // Base movement speeds (baseSpeed will be primary, others are multipliers or context-specific)
        // this.baseWalkSpeed = 6; // Superseded by this.baseSpeed
        // this.baseSprintSpeed = 9; // Superseded by this.baseSpeed * this.sprintSpeedMultiplier
        // this.baseCrouchSpeed = 3; // Superseded by this.baseSpeed * this.crouchSpeedMultiplier
        
        // Fragment holding effects
        /* @tweakable corruption buildup rate when holding fragment */
        this.fragmentCorruptionRate = 2; // per second
        this.fragmentHoldTime = 0;
        
        // Weapon model
        this.weaponModel = null;

        // Gravity properties
        this.normalGravityY = -20; // Default standard Y gravity (adjust as per game feel)
        this.currentGravityY = this.normalGravityY;
        this.gravityGlitchTimer = 0; // in milliseconds
        this.isGravityGlitched = false;

        this.currentBoothId = null; // For Confessional Booths
        this.isSpeaking = false; // For Voice Chat Indicator

        // Match Stats related properties
        this.totalTimeHoldingFragment = 0;
        this.currentFragmentSessionStartTime = 0; // Using game time (seconds)

        this.setClass(this.playerClass); // Initialize health and weapon based on default class
    }

    toggleSpeaking() {
        this.isSpeaking = !this.isSpeaking;
        if (this.gameCore && this.gameCore.networkManager) {
            this.gameCore.networkManager.updatePresence(this.getPresenceData());
        }
        // Optional: Local feedback for speaking state can be handled here or in GameCore/EffectsManager
        // if (this.gameCore && this.gameCore.effectsManager && typeof this.gameCore.effectsManager.setPlayerSpeakingIndicator === 'function') {
        //     // This would need playerMesh reference, which Player.js doesn't typically hold directly.
        //     // GameCore.updatePlayerModel is a better place for remote players.
        //     // For local player, GameCore could call this if needed.
        // }
    }

    getWeaponForClass(playerClass) {
        switch (playerClass) {
            case PLAYER_CLASSES.ASSAULT: return WEAPON_TYPES.ASSAULT;
            case PLAYER_CLASSES.SCOUT: return WEAPON_TYPES.SCOUT;
            case PLAYER_CLASSES.HEAVY: return WEAPON_TYPES.HEAVY;
            default: return WEAPON_TYPES.ASSAULT;
        }
    }

    getWeaponConfig() {
        return WEAPON_CONFIG[this.weaponType] || WEAPON_CONFIG[WEAPON_TYPES.ASSAULT]; // Fallback to assault
    }

    resetAmmo() {
        const config = this.getWeaponConfig();
        if (config) {
            this.maxAmmo = config.ammoCapacity;
            this.ammo = config.ammoCapacity;
        } else { // Fallback if somehow config is not found
            this.maxAmmo = 30;
            this.ammo = 30;
        }
        if (this.gameCore?.uiManager) this.gameCore.uiManager.updateAmmoDisplay();
    }

    setClass(playerClass) {
        this.playerClass = playerClass;
        this.weaponType = this.getWeaponForClass(playerClass); // This now returns WEAPON_TYPES

        switch (playerClass) {
            case PLAYER_CLASSES.ASSAULT:
                this.maxHealth = 100;
                break;
            case PLAYER_CLASSES.SCOUT:
                this.maxHealth = 80;
                break;
            case PLAYER_CLASSES.HEAVY:
                this.maxHealth = 150;
                break;
            default:
                this.maxHealth = 100;
                break;
        }
        this.health = this.maxHealth;
        this.resetAmmo();

        if (this.gameCore?.uiManager) {
            this.gameCore.uiManager.updateHealthDisplay();
            this.gameCore.uiManager.updateWeaponDisplay(this.weaponType);
        }
        console.log(`Player class set to: ${this.playerClass}, Max Health: ${this.maxHealth}, Weapon: ${this.weaponType}`);
    }
    
    setEnvironment(environment) {
        this.environment = environment;
    }
    
    // Renamed from updateMovement to reflect new responsibilities
    updateStateAndMovement(deltaTime, inputControls, camera, justPressedActions = {}) {
        // deltaTime is expected in seconds from GameCore.gameLoop

        // -- STATE UPDATES --
        let presenceNeedsUpdate = false;

        // Crouch (Toggle on press)
        if (justPressedActions.crouchToggleJustPressed) {
            this.isCrouching = !this.isCrouching;
            this.cameraOffsetY = this.isCrouching ? this.crouchCameraOffsetY : this.baseCameraOffsetY;
            this.currentHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
            presenceNeedsUpdate = true;
        }
        // Note: this.prevCrouchPressed logic is now fully in InputManager for the flag.
        // The 'held' state inputControls.crouch might still be useful if crouch can be held OR toggled.
        // For a pure toggle, the justPressedAction is sufficient. If holding is also an option,
        // then inputControls.crouch (set by InputManager based on keydown/keyup) would also be used.
        // Current InputManager sets controls.crouch = true on keydown, so this is for "held" crouch.
        // The justPressedActions.crouchToggleJustPressed is specifically for the toggle action.
        // This might lead to a situation where toggle happens, and if key is held, crouch remains.
        // For a strict toggle, inputControls.crouch might not be needed here for the crouch state itself.
        // For now, let's assume the toggle is the primary way to enter/exit crouch.


        // Sprint (Hold)
        const canSprint = !this.isCrouching && !this.isReloading; // isCrouching state is now toggled above
        const newSprintState = inputControls.sprint && canSprint;
        if (this.isSprinting !== newSprintState) {
            this.isSprinting = newSprintState;
            presenceNeedsUpdate = true;
        }

        // Reload (Triggered by "just pressed" action)
        if (justPressedActions.reloadJustPressed) {
            const weaponConfig = this.getWeaponConfig();
            if (weaponConfig && !this.isReloading && this.ammo < weaponConfig.ammoCapacity) {
                this.startReload(); // Call the existing startReload method
                presenceNeedsUpdate = true; // startReload itself might also set this if it syncs presence
            }
        }

        // Reload progress timer (if currently reloading)
        if (this.isReloading) {
            this.reloadTimer += deltaTime; // deltaTime is already in seconds
            const weaponConfig = this.getWeaponConfig();
            if (weaponConfig && this.reloadTimer >= (weaponConfig.reloadTime / 1000.0)) { // Convert reloadTime from ms
                this.resetAmmo();
                this.isReloading = false;
                this.reloadTimer = 0;
                if (this.gameCore && this.gameCore.uiManager) {
                    this.gameCore.uiManager.updateAmmoDisplay();
                }
                // Presence update for reload completion will be part of the regular presence update cycle
                presenceNeedsUpdate = true;
            }
        }

        // Interaction (Triggered by "just pressed" action)
        if (justPressedActions.interactJustPressed) {
            // Option 1: Player directly handles some interactions
            if (this.currentBoothId && this.gameCore && this.gameCore.uiManager && !this.gameCore.uiManager.isConfessionalInputVisible()) {
                this.gameCore.uiManager.showConfessionalInput();
            } else if (this.canCollectFragment) {
                this.collectFragment(); // This already calls network updates
            } else {
                // Option 2: Or, signal GameCore to handle general interaction contextually
                // This requires GameCore.handleInteraction to exist and do further checks.
                if(this.gameCore && typeof this.gameCore.handleInteraction === 'function') {
                    this.gameCore.handleInteraction();
                }
            }
        }


        // -- MOVEMENT LOGIC (adapted from old updateMovement) --
        const moveVector = new THREE.Vector3();
        const cameraDirection = new THREE.Vector3();
        
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const right = new THREE.Vector3().crossVectors(cameraDirection, camera.up).normalize();
        
        if (inputControls.moveForward) moveVector.add(cameraDirection);
        if (inputControls.moveBackward) moveVector.sub(cameraDirection);
        if (inputControls.moveLeft) moveVector.sub(right);
        if (inputControls.moveRight) moveVector.add(right);

        // Calculate current speed based on states
        let currentSpeed = this.baseSpeed;
        if (this.isCrouching) currentSpeed *= this.crouchSpeedMultiplier;
        else if (this.isSprinting) currentSpeed *= this.sprintSpeedMultiplier; // else if, sprint overrides walk

        // Apply weapon-specific speed modifier
        const weaponConfig = this.getWeaponConfig();
        if (weaponConfig && weaponConfig.moveSpeedMod) { // Assuming moveSpeedMod is in WEAPON_CONFIG
             currentSpeed *= weaponConfig.moveSpeedMod;
        } else { // Fallback to old getWeaponSpeedModifier if moveSpeedMod not in WEAPON_CONFIG
            currentSpeed *= this.getWeaponSpeedModifier();
        }

        // Height adjustment for model/collision (already done for cameraOffsetY)
        // this.currentHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
        // Lerping currentHeight can be done here if smooth transition is needed for collision model too
        const targetCollisionHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
        this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetCollisionHeight, deltaTime * 10);


        moveVector.normalize(); // Normalize before applying speed and deltaTime
        moveVector.multiplyScalar(currentSpeed * deltaTime);
        
        // Store original position for collision checking
        const originalPosition = this.position.clone();
        const newPosition = this.position.clone().add(moveVector);
        
        // Check collision before applying movement
        if (this.environment) {
            const collision = this.environment.checkCollision(newPosition, 0.5);
            if (!collision.collision) {
                this.position.copy(newPosition);
            }
        } else {
            this.position.add(moveVector);
        }
        
        // Handle jumping
        if (controls.jump && this.velocity.y === 0 && !this.isCrouching) {
            this.velocity.y = 8;
        }
        
        // Apply gravity
        if (this.isGravityGlitched) {
            this.gravityGlitchTimer -= deltaTime * 1000; // deltaTime is in seconds
            if (this.gravityGlitchTimer <= 0) {
                this.currentGravityY = this.normalGravityY;
                this.isGravityGlitched = false;
                this.gravityGlitchTimer = 0;
                if (this.gameCore && this.gameCore.uiManager) {
                    this.gameCore.uiManager.addConsoleLogMessage("Gravity returns to normal.", "info");
                }
            }
        }
        this.velocity.y += this.currentGravityY * deltaTime; // Use currentGravityY

        this.position.y += this.velocity.y * deltaTime;
        
        // Ground collision using environment
        if (this.environment) {
            const groundHeight = this.environment.getGroundHeight(this.position);
            if (this.position.y <= groundHeight + this.currentHeight) {
                this.position.y = groundHeight + this.currentHeight;
                this.velocity.y = 0;
            }
        } else {
            if (this.position.y <= this.currentHeight) {
                this.position.y = this.currentHeight;
                this.velocity.y = 0;
            }
        }
        
        // Update fragment holding effects
        if (this.hasFragment) {
            this.fragmentHoldTime += deltaTime;
        } else {
            this.fragmentHoldTime = 0;
        }
        
        // Update camera position to current eye level (using cameraOffsetY)
        camera.position.set(this.position.x, this.position.y + this.cameraOffsetY, this.position.z);
        
        // Update weapon position if available
        if (this.weaponModel) {
            this.updateWeaponPosition(camera);
        }

        // Check for fragment interaction
        if (this.gameCore && this.gameCore.fragmentManager) {
            const touchingId = this.gameCore.fragmentManager.getTouchingFragmentId(this.position);
            if (touchingId) {
                this.canCollectFragment = true;
                this.currentTouchingFragmentId = touchingId;
                // UIManager would check this.canCollectFragment to show prompt
            } else {
                this.canCollectFragment = false;
                this.currentTouchingFragmentId = null;
            }
        }

        // Check for Confessional Booth interaction
        if (this.gameCore && this.gameCore.confessionalBoothZones && this.gameCore.uiManager) {
            let inBooth = false;
            for (const booth of this.gameCore.confessionalBoothZones) {
                if (this.position.distanceTo(booth.center) <= booth.radius) {
                    if (this.currentBoothId !== booth.id) {
                        this.currentBoothId = booth.id;
                        this.gameCore.uiManager.showConfessionalPrompt(this.currentBoothId);
                    }
                    inBooth = true;
                    break;
                }
            }
            if (!inBooth && this.currentBoothId !== null) {
                this.currentBoothId = null;
                this.gameCore.uiManager.hideConfessionalPrompt();
            }
        }
    }

    setGameCore(gameCoreInstance) {
        this.gameCore = gameCoreInstance;
    }
    
    getWeaponSpeedModifier() {
        const weaponMods = {
            [WEAPON_TYPES.ASSAULT]: 1.0,
            [WEAPON_TYPES.SCOUT]: 1.2,
            [WEAPON_TYPES.HEAVY]: 0.8
        };
        return weaponMods[this.weaponType] || 1.0;
    }
    
    getMovementSpeed() {
        if (this.isSprinting) {
            return this.baseSprintSpeed;
        } else if (this.isCrouching) {
            return this.baseCrouchSpeed;
        }
        return this.baseWalkSpeed;
    }
    
    setWeaponType(weaponType) { // weaponType here should be one of WEAPON_TYPES
        // Ensure weaponType is a valid one from WEAPON_TYPES
        if (Object.values(WEAPON_TYPES).includes(weaponType)) {
            this.weaponType = weaponType;
            
            const config = WEAPON_CONFIG[weaponType];
            if (config) {
                this.maxAmmo = config.ammoCapacity;
                this.ammo = config.ammoCapacity;
            } else { // Fallback if somehow config is not found for a valid WEAPON_TYPE
                this.maxAmmo = 30; // Default
                this.ammo = 30;
                console.warn(`No WEAPON_CONFIG found for WEAPON_TYPE: ${weaponType}. Using default ammo.`);
            }
        } else {
            console.warn(`Attempted to set invalid weaponType: ${weaponType}`);
            // Optionally set to a default weaponType
            // this.weaponType = WEAPON_TYPES.ASSAULT;
            // this.resetAmmo();
        }
    }
    
    getFragmentCorruption() {
        /* @tweakable fragment corruption calculation based on hold time */
        const maxCorruptionTime = 60; // seconds
        return Math.min(100, (this.fragmentHoldTime / maxCorruptionTime) * 100);
    }
    
    updateWeaponPosition(camera) {
        if (!this.weaponModel) return;
        
        // Universal H20pew positioning for all weapon types
        /* @tweakable universal H20pew weapon offset positioning for all classes */
        const weaponOffset = new THREE.Vector3(0.5, -0.25, -0.65);
        
        // Apply camera rotation to offset
        weaponOffset.applyQuaternion(camera.quaternion);
        
        this.weaponModel.position.copy(camera.position).add(weaponOffset);
        this.weaponModel.rotation.copy(camera.rotation);
        
        // Universal H20pew sway for all weapon types
        const time = Date.now() * 0.002;
        /* @tweakable universal H20pew weapon sway for all weapon classes */
        const swayAmplitude = 0.04;
        this.weaponModel.position.y += Math.sin(time * 2) * swayAmplitude;
        this.weaponModel.rotation.z = Math.sin(time) * 0.02;
        this.weaponModel.rotation.x += Math.sin(time * 1.5) * 0.008;
    }
    
    setWeaponModel(weaponModel) {
        this.weaponModel = weaponModel;
    }
    
    shoot() {
        if (this.ammo <= 0) {
            return false;
        }
        
        this.ammo--;
        /* @tweakable last shot time tracking for multiplayer weapon sync */
        this.lastShotTime = Date.now();
        return true;
    }
    
    collectFragment() {
        if (!this.canCollectFragment || !this.currentTouchingFragmentId || this.hasFragment || !this.gameCore) {
            return false;
        }

        const fragmentIdToCollect = this.currentTouchingFragmentId;

        // Attempt to collect via FragmentManager
        if (this.gameCore.fragmentManager.collectFragment(fragmentIdToCollect, this.gameCore.networkManager.room.clientId /* or a more general player ID */)) {
            this.hasFragment = true;
            this.carryingFragmentId = fragmentIdToCollect;
            this.canCollectFragment = false; // No longer able to pick up another one
            this.currentTouchingFragmentId = null;
            if (this.gameCore && this.gameCore.gameState) { // Check if gameCore and gameState are available
                this.currentFragmentSessionStartTime = this.gameCore.gameState.gameTime; // Start timer
            }

            // FragmentManager's collectFragment method should call updateFragmentOnNetwork.
            // UI update for fragment indicator can be triggered from GameCore or UIManager observing player.hasFragment
            if (this.gameCore.uiManager) this.gameCore.uiManager.showFragmentIndicator();
            return true;
        }
        return false;
    }
    
    dropFragment() {
        if (!this.hasFragment || !this.carryingFragmentId || !this.gameCore) {
            // console.log("Cannot drop fragment: Not carrying one or gameCore not set.");
            return null; // Return null or some indicator of failure
        }

        const dropPosition = this.position.clone(); // Drop at current player position
        // Potentially add a small offset in front of the player
        const forwardOffset = new THREE.Vector3(0, 0, -2); // Example offset
        const cameraDirection = new THREE.Vector3();
        if (this.gameCore.camera) { // Check if camera is available (it should be)
            this.gameCore.camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0; // Don't drop up/down based on camera pitch
            cameraDirection.normalize();
            forwardOffset.applyQuaternion(this.gameCore.camera.quaternion); // Simpler way if camera is already oriented
        }
        dropPosition.add(forwardOffset.setLength(1.5)); // Drop 1.5 units in front


        // Tell FragmentManager to re-spawn/unhide the fragment at this position
        if (this.gameCore.fragmentManager.dropFragment(this.carryingFragmentId, dropPosition)) {
            const oldFragmentId = this.carryingFragmentId;
            if (this.currentFragmentSessionStartTime > 0 && this.gameCore && this.gameCore.gameState) {
                const holdDuration = this.gameCore.gameState.gameTime - this.currentFragmentSessionStartTime;
                this.totalTimeHoldingFragment += holdDuration;
                this.currentFragmentSessionStartTime = 0;
            }
            this.hasFragment = false;
            this.carryingFragmentId = null;
            this.fragmentHoldTime = 0; // Reset hold time

            // FragmentManager's dropFragment method should call updateFragmentOnNetwork.
            // UI update
            if (this.gameCore.uiManager) this.gameCore.uiManager.hideFragmentIndicator();
            return dropPosition; // Return the position where it was dropped
        }
        return null;
    }
    
    getPlayerId() { // Helper, assumes gameCore and networkManager are set
        return this.gameCore?.networkManager?.room?.clientId || 'localPlayer';
    }

    getPresenceData() {
        return {
            position: this.position.toArray(),
            rotation: this.rotation.toArray(), // Player's body/model yaw
            // cameraPitch: this.cameraPitch,
            health: this.health,
            maxHealth: this.maxHealth,
            team: this.team,
            isDead: this.isDead,
            playerClass: this.playerClass,
            hasFragment: this.hasFragment,
            carryingFragmentId: this.carryingFragmentId,
            isCrouching: this.isCrouching,
            isSprinting: this.isSprinting,
            isReloading: this.isReloading,
            isSpeaking: this.isSpeaking // Added for voice chat
        };
    }

    // Called by this.updateStateAndMovement when reloadJustPressed is true
    startReload() {
        // The checks for !this.isReloading and ammo < capacity are now done in updateStateAndMovement before calling this.
        const weaponConfig = this.getWeaponConfig();
        if (!weaponConfig) return false; // Should not happen if checks are done prior

        this.isReloading = true;
        this.reloadTimer = 0; // Reset timer
        this.isSprinting = false; // Stop sprinting if starting reload

        if (this.gameCore && this.gameCore.audioManager) {
            this.gameCore.audioManager.playSound(weaponConfig.reloadSound || SOUND_KEYS.RELOAD_DEFAULT, this.position); // Use SOUND_KEYS
        }
        if (this.gameCore && this.gameCore.uiManager) {
            // Pass current ammo, capacity, and reloading state for more detailed UI update
            this.gameCore.uiManager.updateAmmoDisplay(); // UIManager can fetch from player or pass explicitly
        }
        if (this.gameCore && this.gameCore.networkManager && this.isLocalPlayer()) { // Assuming isLocalPlayer method or similar check
            this.gameCore.networkManager.updatePresence(this.getPresenceData());
        }
        return true; // Indicates reload process has started
    }
    
    isLocalPlayer() { // Helper method, can be more robust
        return this.gameCore && this.gameCore.networkManager && this.getPlayerId() === this.gameCore.networkManager.getPlayerId();
    }

    // Old reload method is now fully replaced by startReload and the timer logic in updateStateAndMovement
    // reload() {
    //     if (this.ammo >= this.maxAmmo) return false;
    //
    //     // Start reload animation
        if (this.weaponModel) {
            const originalPosition = this.weaponModel.position.clone();
            const reloadOffset = new THREE.Vector3(0, -0.5, 0);
            
            // Animation: weapon moves down and back up
            const animateReload = (progress) => {
                if (progress <= 0.5) {
                    // Move down
                    const offset = reloadOffset.clone().multiplyScalar(progress * 2);
                    this.weaponModel.position.copy(originalPosition).add(offset);
                } else {
                    // Move back up
                    const offset = reloadOffset.clone().multiplyScalar((1 - progress) * 2);
                    this.weaponModel.position.copy(originalPosition).add(offset);
                }
            };
            
            const startTime = Date.now();
            const animationDuration = 2000; // 2 seconds
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);
                
                animateReload(progress);
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            
            animate();
        }
        
        // Reload after animation
        setTimeout(() => {
            this.ammo = this.maxAmmo;
        }, 2000);
        
        return true;
    }
    
    respawn() {
        this.health = this.maxHealth;
        this.hasFragment = false;
        
        // Set spawn position based on team with proper ground height
        let spawnPos;
        if (this.team === 'alpha') {
            /* @tweakable team spawn positions for enhanced multiplayer balance */
            spawnPos = new THREE.Vector3(-45, 0, -8); // Adjusted closer to base
        } else {
            spawnPos = new THREE.Vector3(45, 0, 8); // Adjusted closer to base
        }
        
        // Adjust spawn height based on ground with safer fallback
        if (this.environment) {
            /* @tweakable spawn height calculation for guaranteed accessibility */
            const groundHeight = Math.max(8, this.environment.getGroundHeight(spawnPos)); // Increased minimum
            /* @tweakable player spawn height offset for enhanced accessibility */
            const spawnHeightOffset = 3.0; // Reduced since we have higher minimum
            spawnPos.y = groundHeight + spawnHeightOffset;
        } else {
            spawnPos.y = 12; // Increased safe fallback height
        }
        
        this.position.copy(spawnPos);
        console.log(`Player respawned at: ${spawnPos.x}, ${spawnPos.y}, ${spawnPos.z} for team ${this.team}`);
    }
    
    takeDamage(amount, weaponType = 'unknown', attackerId = null) { // Added weaponType and attackerId
        if (this.isDead) return false;

        this.lastDamageInfo = { attackerId: attackerId, weapon: weaponType }; // Ensured this is early

        this.health = Math.max(0, this.health - amount);

        if (this.gameCore && this.gameCore.effectsManager) { // Damage screen flash
            this.gameCore.effectsManager.addScreenFlash('rgba(255,0,0,0.3)', 150);
        }
        if (this.gameCore && this.gameCore.audioManager) { // Player hit sound
            this.gameCore.audioManager.playSound('player_hit', this.position); // Play at player's position
        }

        if (this.health <= 0 && !this.isDead) { // Ensure death processing only happens once
            this.isDead = true;
            if (this.gameCore) {
                // Pass weaponType to handlePlayerDeath as well
                this.gameCore.handlePlayerDeath(attackerId, weaponType);
            }
        }

        // Presence update should be called by GameCore after this, or after death is fully processed.
        // For example, GameCore.handlePlayerDeath might call it.
        // Or if takeDamage is called directly by network event, then GameCore's presence update is needed.
        if (this.gameCore && this.gameCore.networkManager) {
             this.gameCore.networkManager.updatePresence(this.getPresenceData());
        }
        return this.isDead;
    }
    
    spawnAt(x, y, z, facingYaw) {
        this.position.set(x, y, z);
        this.velocity.set(0, 0, 0); // Reset velocity

        // Set player's body rotation (yaw)
        // Assuming the Player class uses this.rotation for the body/model
        this.rotation.y = facingYaw;

        // If a separate camera holder/pivot is used for pitch, reset it too.
        // For now, let's assume camera directly uses player's orientation or is handled in GameCore/InputManager.
        // If GameCore's camera is directly manipulated by InputManager based on mouse:
        // We might need to inform InputManager or GameCore to reset camera's internal yaw/pitch if applicable,
        // or ensure the player's new `facingYaw` is used to initialize the camera's view direction.
        // For simplicity, we'll assume GameCore's `respawnPlayer` or `updateMovement` handles camera sync.
        // If `this.player.updateMovement` uses `camera.rotation.y` for movement calcs, it needs to be aligned.
        // This implies that the camera object itself (passed to updateMovement) should also have its yaw reset/set.
        // GameCore.respawnPlayer can set camera.rotation.y = facingYaw after calling player.spawnAt.

        this.health = this.maxHealth;
        this.isDead = false;

        // Reset ammo based on current weapon type by calling resetAmmo
        this.setClass(this.playerClass); // Re-call setClass to ensure health and ammo are correctly set for the current class
        // this.resetAmmo(); // setClass calls resetAmmo already.

        this.hasFragment = false;
        this.fragmentHoldTime = 0;
        this.carryingFragmentId = null; // Ensure no fragment carried on spawn

        // Reset any other status effects if applicable
        // e.g., this.isSlowed = false; this.isOnFire = false;

        console.log(`Player spawned at (${x}, ${y}, ${z}), facing ${facingYaw}, health: ${this.health}, ammo: ${this.ammo}`);
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    applyGravityGlitch(newGravityObj, durationSeconds) {
        if (typeof newGravityObj.y === 'number') {
            this.currentGravityY = newGravityObj.y;
            this.gravityGlitchTimer = durationSeconds * 1000; // Convert to ms
            this.isGravityGlitched = true;
            if (this.gameCore && this.gameCore.uiManager) {
                this.gameCore.uiManager.addConsoleLogMessage(`Gravity changed to Y=${this.currentGravityY} for ${durationSeconds}s!`, "warning");
            }
        } else {
            console.error("applyGravityGlitch: newGravityObj.y is not a number.", newGravityObj);
            if (this.gameCore && this.gameCore.uiManager) {
                this.gameCore.uiManager.addConsoleLogMessage("Failed to apply gravity glitch: invalid gravity value.", "error");
            }
        }
    }

    getMatchStats() {
        // Ensure ongoing session is accounted for if player is still holding at match end
        let currentSessionDuration = 0;
        if (this.hasFragment && this.currentFragmentSessionStartTime > 0 && this.gameCore && this.gameCore.gameState) {
            currentSessionDuration = this.gameCore.gameState.gameTime - this.currentFragmentSessionStartTime;
        }

        return {
            playerId: this.getPlayerId(),
            username: (this.gameCore?.networkManager?.getUsername(this.getPlayerId())) || this.getPlayerId().substring(0,6), // Get current username
            totalTimeHoldingFragment: this.totalTimeHoldingFragment + currentSessionDuration
        };
    }
}