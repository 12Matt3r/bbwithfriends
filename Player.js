import * as THREE from 'three';

export class Player {
    constructor() {
        this.position = new THREE.Vector3(0, 1.8, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0);
        this.health = 100;
        this.maxHealth = 100;
        this.team = 'alpha';
        this.hasFragment = false;
        this.weapon = 'jellyfish_blaster';
        this.ammo = 30;
        this.maxAmmo = 120;
        this.environment = null;
        
        // Weapon type selection
        /* @tweakable default weapon type for new players */
        this.weaponType = 'assault'; // assault, scout, heavy
        
        // Movement states
        this.isSprinting = false;
        this.isCrouching = false;
        this.normalHeight = 1.8;
        this.crouchHeight = 1.2;
        this.currentHeight = this.normalHeight;
        
        // Base movement speeds
        this.baseWalkSpeed = 6;
        this.baseSprintSpeed = 9;
        this.baseCrouchSpeed = 3;
        
        // Fragment holding effects
        /* @tweakable corruption buildup rate when holding fragment */
        this.fragmentCorruptionRate = 2; // per second
        this.fragmentHoldTime = 0;
        
        // Weapon model
        this.weaponModel = null;
    }
    
    setEnvironment(environment) {
        this.environment = environment;
    }
    
    updateMovement(controls, camera, deltaTime) {
        const moveVector = new THREE.Vector3();
        const cameraDirection = new THREE.Vector3();
        
        // Get movement direction from camera
        camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0;
        cameraDirection.normalize();
        
        const right = new THREE.Vector3().crossVectors(cameraDirection, camera.up).normalize();
        
        if (controls.moveForward) {
            moveVector.add(cameraDirection);
        }
        if (controls.moveBackward) {
            moveVector.sub(cameraDirection);
        }
        if (controls.moveLeft) {
            moveVector.sub(right);
        }
        if (controls.moveRight) {
            moveVector.add(right);
        }
        
        // Update movement states
        this.isSprinting = controls.sprint && !this.isCrouching;
        this.isCrouching = controls.crouch;
        
        // Get weapon-modified speeds
        const weaponMod = this.getWeaponSpeedModifier();
        const currentSpeed = this.getMovementSpeed() * weaponMod;
        
        // Handle height changes for crouching
        const targetHeight = this.isCrouching ? this.crouchHeight : this.normalHeight;
        this.currentHeight = THREE.MathUtils.lerp(this.currentHeight, targetHeight, deltaTime * 5);
        
        moveVector.normalize();
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
        this.velocity.y -= 20 * deltaTime;
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
        
        // Update camera position to current eye level
        camera.position.copy(this.position);
        
        // Update weapon position if available
        if (this.weaponModel) {
            this.updateWeaponPosition(camera);
        }
    }
    
    getWeaponSpeedModifier() {
        /* @tweakable weapon type speed modifiers */
        const weaponMods = {
            assault: 1.0,
            scout: 1.2,
            heavy: 0.8
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
    
    setWeaponType(weaponType) {
        if (['assault', 'scout', 'heavy'].includes(weaponType)) {
            this.weaponType = weaponType;
            
            // Update ammo based on weapon type
            const weaponConfig = {
                assault: { maxAmmo: 30 },
                scout: { maxAmmo: 15 },
                heavy: { maxAmmo: 8 }
            };
            
            this.maxAmmo = weaponConfig[weaponType].maxAmmo;
            this.ammo = this.maxAmmo;
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
        if (this.hasFragment) {
            return false;
        }
        
        this.hasFragment = true;
        return true;
    }
    
    dropFragment() {
        this.hasFragment = false;
        return this.position.clone();
    }
    
    getPresenceData() {
        return {
            position: this.position.toArray(),
            rotation: this.rotation.toArray(),
            health: this.health,
            team: this.team,
            hasFragment: this.hasFragment,
            dead: this.health <= 0,
            /* @tweakable weapon visibility state for other players */
            weaponVisible: true,
            lastShotTime: this.lastShotTime || 0
        };
    }
    
    reload() {
        if (this.ammo >= this.maxAmmo) return false;
        
        // Start reload animation
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
    
    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);
        return this.health <= 0;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
}