import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const WEAPON_CONFIG = {
    'assault': { // Was 'rifle' in instructions, but Player.js setClass uses 'assault' etc.
        fireRate: 100,
        damagePerPellet: 20,
        pelletCount: 1,
        spreadAngle: 0.01,
        ammoCapacity: 30,
        reloadTime: 2500,
        auto: true
    },
    'scout': { // Was 'pistol'
        fireRate: 150,
        damagePerPellet: 15,
        pelletCount: 2,
        spreadAngle: 0.05,
        ammoCapacity: 24,
        reloadTime: 2000,
        auto: false,
        silenced: true // Added from old config
    },
    'heavy': { // Was 'shotgun'
        fireRate: 700,
        damagePerPellet: 10,
        pelletCount: 8,
        spreadAngle: 0.2,
        ammoCapacity: 8,
        reloadTime: 3000,
        auto: false
    }
};

export class WeaponManager {
    constructor(scene, camera, player, audioManager) {
        this.scene = scene;
        this.camera = camera; // Local player's camera
        this.player = player; // Local player instance
        this.audioManager = audioManager;
        this.gameCore = player.gameCore;
        this.loader = new GLTFLoader();
        
        this.weaponModel = null;
        this.muzzleFlash = null;
        this.isReloading = false;
        
        this.lastShotTime = 0;
        this.recoilOffset = new THREE.Vector2(0, 0);
        this.raycaster = new THREE.Raycaster();
    }

    // getCurrentWeaponDamage is removed, damage is per pellet in WEAPON_CONFIG

    getWeaponMuzzlePosition() {
        if (!this.weaponModel) {
            // Fallback if model not loaded, return camera position
            const fallbackPosition = new THREE.Vector3();
            this.camera.getWorldPosition(fallbackPosition);
            return fallbackPosition;
        }
        // Attempt to get a specific "muzzle" child object if defined in GLB
        const muzzleObject = this.weaponModel.getObjectByName('muzzle'); // Or any predefined name
        if (muzzleObject) {
            const worldPosition = new THREE.Vector3();
            muzzleObject.getWorldPosition(worldPosition);
            return worldPosition;
        }
        // Fallback: Use weapon model's world position with a forward offset
        // This assumes the weapon model's origin is where it's held
        const position = new THREE.Vector3();
        this.weaponModel.getWorldPosition(position);
        const direction = new THREE.Vector3();
        this.weaponModel.getWorldDirection(direction); // Weapon model's forward
        position.add(direction.multiplyScalar(0.5)); // Move 0.5 units forward from model origin
        return position;
    }
    
    async loadWeaponModel() {
        return new Promise((resolve, reject) => {
            /* @tweakable universal weapon model file for all loadout classes */
            const universalWeaponModel = 'H20pew.glb';
            
            this.loader.load(
                universalWeaponModel,
                (gltf) => {
                    this.weaponModel = gltf.scene;
                    /* @tweakable universal H20pew weapon scale for all classes */
                    this.weaponModel.scale.setScalar(0.4); // Increased for better visibility
                    
                    // Enhance weapon materials for all loadout types
                    this.weaponModel.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            if (child.material) {
                                const oldMaterial = child.material;
                                child.material = new THREE.MeshStandardMaterial({
                                    color: oldMaterial.color || 0x888888,
                                    metalness: 0.9,
                                    roughness: 0.1,
                                    /* @tweakable universal H20pew glow color for all weapon classes */
                                    emissive: new THREE.Color(0x0088ff),
                                    /* @tweakable universal H20pew glow intensity for all weapon classes */
                                    emissiveIntensity: 0.6
                                });
                            }
                        }
                    });
                    
                    this.scene.add(this.weaponModel);
                    this.player.setWeaponModel(this.weaponModel);
                    this.createMuzzleFlash();
                    
                    /* @tweakable weapon load success message for universal H20pew */
                    console.log('Universal H20pew weapon model loaded for all classes');
                    resolve();
                },
                (progress) => {
                    console.log('Loading universal H20pew weapon:', progress.loaded / progress.total * 100 + '%');
                },
                (error) => {
                    console.error('Error loading universal H20pew weapon model:', error);
                    // Create fallback weapon if H20pew.glb fails to load
                    this.createFallbackWeapon();
                    resolve();
                }
            );
        });
    }
    
    createFallbackWeapon() {
        /* @tweakable fallback weapon geometry if H20pew.glb fails to load */
        const fallbackGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.8);
        /* @tweakable fallback weapon material if H20pew.glb fails to load */
        const fallbackMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x0088ff,
            emissiveIntensity: 0.4
        });
        
        this.weaponModel = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        this.weaponModel.scale.setScalar(1);
        this.scene.add(this.weaponModel);
        this.player.setWeaponModel(this.weaponModel);
        this.createMuzzleFlash();
        
        console.warn('Using fallback weapon model - H20pew.glb failed to load');
    }
    
    createMuzzleFlash() {
        if (!this.weaponModel) return;
        
        /* @tweakable muzzle flash size for H20pew weapon */
        const muzzleFlashSize = 0.08;
        const geometry = new THREE.SphereGeometry(muzzleFlashSize);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0
        });
        
        this.muzzleFlash = new THREE.Mesh(geometry, material);
        
        /* @tweakable muzzle flash position offset for H20pew weapon */
        const muzzleOffset = new THREE.Vector3(0, 0, -0.4);
        this.muzzleFlash.position.copy(muzzleOffset);
        this.weaponModel.add(this.muzzleFlash);
    }
    
    shoot(cameraWorldDirection, cameraWorldPosition) {
        const weaponConfig = this.player.getWeaponConfig(); // Player now has this method
        if (!weaponConfig) {
            console.error("No weapon config found for player's weapon type:", this.player.weaponType);
            return null;
        }

        // Fire rate and ammo checks are now expected to be done in GameCore.handleShoot()
        // Player.shoot() only decrements ammo and returns true if >0. It's called by GameCore.handleShoot()
        // This method is now primarily about the raycasting and hit application for one "shot" action.

        this.lastShotTime = Date.now(); // Still useful for local effects like muzzle flash timing
        // Player's lastShotTime for fire rate control is set in GameCore.handleShoot
        
        const weaponMuzzlePosition = this.getWeaponMuzzlePosition();

        // Muzzle Flash
        if (this.muzzleFlash) {
            this.muzzleFlash.material.opacity = 1;
            this.muzzleFlash.scale.setScalar(1.5 + Math.random() * 0.5);
            setTimeout(() => {
                if(this.muzzleFlash) {
                    this.muzzleFlash.material.opacity = 0;
                    this.muzzleFlash.scale.setScalar(1);
                }
            }, 80);
        }
        
        // Recoil (visual effect on camera)
        const recoilConfig = WEAPON_CONFIG[this.player.weaponType]?.recoil || 0.01; // Fallback recoil
        this.recoilOffset.x += (Math.random() - 0.5) * recoilConfig * 2; // More horizontal kick
        this.recoilOffset.y += recoilConfig; // Vertical kick

        const results = [];
        const pelletCount = weaponConfig.pelletCount || 1;

        for (let i = 0; i < pelletCount; i++) {
            const shotDirection = cameraWorldDirection.clone();
            const spread = weaponConfig.spreadAngle || 0;

            if (pelletCount > 1) { // Apply spread for shotguns or multi-shot pistols
                 // Simple cone spread:
                const s = Math.random() * spread;
                const angle = Math.random() * Math.PI * 2;
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(angle) * s, Math.sin(angle) * s, 1).normalize(), s);
                shotDirection.applyQuaternion(q);
            } else if (spread > 0) { // Single pellet with some inaccuracy
                 const s = Math.random() * spread;
                const angle = Math.random() * Math.PI * 2;
                const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(angle) * s, Math.sin(angle) * s, 1).normalize(), s);
                shotDirection.applyQuaternion(q);
            }
            // For dual pistols (pelletCount: 2), a fixed offset might be better than random spread for each.
            // Example: if (weaponConfig.pelletCount === 2) {
            //    const offsetAngle = 0.02; // Small angle to separate shots
            //    const sideVector = new THREE.Vector3().crossVectors(cameraWorldDirection, this.camera.up).normalize();
            //    if (i === 0) shotDirection.add(sideVector.multiplyScalar(-offsetAngle));
            //    else shotDirection.add(sideVector.multiplyScalar(offsetAngle));
            //    shotDirection.normalize();
            // }


            this.raycaster.set(cameraWorldPosition, shotDirection);
            const collidables = this.gameCore.getCollidableEntities();
            const intersects = this.raycaster.intersectObjects(collidables, true);

            let hitPointOrFarPoint = cameraWorldPosition.clone().add(shotDirection.multiplyScalar(100)); // Default far point
            let hitTarget = null;

            if (intersects.length > 0) {
                for (const hit of intersects) {
                    if (hit.object.userData?.playerId === this.player.getPlayerId() || hit.object === this.weaponModel || (this.weaponModel && this.weaponModel.contains(hit.object))) {
                        continue; // Skip self-hits or hits on own weapon
                    }
                    hitPointOrFarPoint = hit.point.clone();
                    hitTarget = hit.object;
                    break;
                }
            }
            
            if (this.gameCore.effectsManager) {
                this.gameCore.effectsManager.createProjectileTrail(weaponMuzzlePosition.clone(), hitPointOrFarPoint.clone());
            }

            if (hitTarget) {
                if (hitTarget.userData.playerId && hitTarget.userData.type === 'player') {
                    const targetPlayerId = hitTarget.userData.playerId;
                    if (this.gameCore.networkManager && this.gameCore.networkManager.room) {
                        this.gameCore.networkManager.room.requestPresenceUpdate(targetPlayerId, {
                            type: 'damage',
                            amount: weaponConfig.damagePerPellet,
                            weapon: this.player.weaponType,
                            attackerId: this.player.getPlayerId()
                        });
                        if(this.gameCore.effectsManager) this.gameCore.effectsManager.showHitConfirmation();
                    }
                } else {
                    if (this.gameCore.effectsManager) {
                        let materialType = 'generic';
                        if(hitTarget.material && hitTarget.material.name) materialType = hitTarget.material.name;
                        else if(hitTarget.name) materialType = hitTarget.name; // Use object name as fallback
                        this.gameCore.effectsManager.createImpactEffect(hitPointOrFarPoint.clone(), materialType);
                    }
                }
            }
            results.push({ hitPoint: hitPointOrFarPoint, hitTarget });
        }

        if (this.gameCore.networkManager) {
            const primaryHitPoint = results.length > 0 ? results[0].hitPoint : cameraWorldPosition.clone().add(cameraWorldDirection.multiplyScalar(100));
            this.gameCore.networkManager.send({
                type: 'player_shot',
                playerId: this.player.getPlayerId(),
                startPos: weaponMuzzlePosition.toArray(),
                endPos: primaryHitPoint.toArray(),
                weapon: this.player.weaponType
            });
        }

        const soundPosition = weaponMuzzlePosition;
        if (weaponConfig.silenced) {
            this.audioManager.playSound('silenced_shot', soundPosition);
        } else {
            this.audioManager.playSound('shoot', soundPosition);
        }
        
        return results;
    }
        
    updateRecoil(deltaTime) {
        // Gradually return camera to center from recoil
        /* @tweakable recoil recovery speed */
        const recoverySpeed = 5;
        this.recoilOffset.multiplyScalar(1 - deltaTime * recoverySpeed);
        
        // Apply recoil to camera
        if (this.camera) {
            this.camera.rotation.x += this.recoilOffset.y * deltaTime;
            this.camera.rotation.y += this.recoilOffset.x * deltaTime;
        }
    }
    
    reload() {
        if (this.isReloading || this.player.ammo >= this.player.maxAmmo) {
            return false;
        }
        
        this.isReloading = true;
        const reloadSuccess = this.player.reload();
        
        if (reloadSuccess) {
            this.audioManager.playSound('reload');
            
            setTimeout(() => {
                this.isReloading = false;
            }, 2000);
            
            return true;
        } else {
            this.isReloading = false;
            return false;
        }
    }
    
    updateWeaponPosition(camera) {
        if (!this.weaponModel) return;
        
        // Universal H20pew positioning for all weapon classes
        /* @tweakable universal H20pew positioning offset for all weapon classes */
        const weaponOffsetX = 0.5;
        const weaponOffsetY = -0.2;
        const weaponOffsetZ = -0.6;
        
        const weaponOffset = new THREE.Vector3(weaponOffsetX, weaponOffsetY, weaponOffsetZ);
        
        // Apply camera rotation to offset
        weaponOffset.applyQuaternion(camera.quaternion);
        
        this.weaponModel.position.copy(camera.position).add(weaponOffset);
        this.weaponModel.rotation.copy(camera.rotation);
        
        // Universal H20pew sway for all weapon classes
        const time = Date.now() * 0.002;
        /* @tweakable universal H20pew sway amplitude for all weapon classes */
        const swayAmplitude = 0.03;
        this.weaponModel.position.y += Math.sin(time * 2) * swayAmplitude;
        this.weaponModel.rotation.z = Math.sin(time) * 0.015;
        this.weaponModel.rotation.x += Math.sin(time * 1.5) * 0.005;
    }
}