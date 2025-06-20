import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class WeaponManager {
    constructor(scene, camera, player, audioManager) {
        this.scene = scene;
        this.camera = camera;
        this.player = player;
        this.audioManager = audioManager;
        this.loader = new GLTFLoader();
        
        this.weaponModel = null;
        this.muzzleFlash = null;
        this.isReloading = false;
        
        // Weapon types with distinct properties
        /* @tweakable weapon type configurations for tactical variety */
        this.weaponTypes = {
            assault: {
                damage: 25,
                fireRate: 150, // ms between shots
                maxAmmo: 30,
                reloadTime: 2000,
                spread: 0.02,
                recoil: 0.015,
                moveSpeedMod: 1.0
            },
            scout: {
                damage: 35,
                fireRate: 300,
                maxAmmo: 15,
                reloadTime: 1500,
                spread: 0.005,
                recoil: 0.01,
                moveSpeedMod: 1.2,
                silenced: true
            },
            heavy: {
                damage: 45,
                fireRate: 800,
                maxAmmo: 8,
                reloadTime: 3000,
                spread: 0.08,
                recoil: 0.03,
                moveSpeedMod: 0.8,
                pellets: 5 // shotgun pellets
            }
        };
        
        this.lastShotTime = 0;
        this.recoilOffset = new THREE.Vector2(0, 0);
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
    
    shoot() {
        const currentWeapon = this.weaponTypes[this.player.weaponType];
        const now = Date.now();
        
        if (this.isReloading || !this.player.shoot() || 
            now - this.lastShotTime < currentWeapon.fireRate) {
            this.audioManager.playSound('empty');
            return null;
        }
        
        this.lastShotTime = now;
        
        // Enhanced muzzle flash effect
        if (this.muzzleFlash) {
            this.muzzleFlash.material.opacity = 1;
            /* @tweakable muzzle flash intensity and duration */
            this.muzzleFlash.scale.setScalar(1.5 + Math.random() * 0.5);
            setTimeout(() => {
                this.muzzleFlash.material.opacity = 0;
                this.muzzleFlash.scale.setScalar(1);
            }, 80);
        }
        
        // Enhanced camera recoil with screen shake
        /* @tweakable camera recoil and screen shake intensity */
        const recoilIntensity = currentWeapon.recoil * 1.2;
        const screenShakeIntensity = 0.005;
        
        this.recoilOffset.x += (Math.random() - 0.5) * recoilIntensity;
        this.recoilOffset.y += recoilIntensity * 0.8;
        
        // Add screen shake effect
        if (this.camera) {
            const originalPosition = this.camera.position.clone();
            this.camera.position.add(new THREE.Vector3(
                (Math.random() - 0.5) * screenShakeIntensity,
                (Math.random() - 0.5) * screenShakeIntensity,
                (Math.random() - 0.5) * screenShakeIntensity
            ));
            
            setTimeout(() => {
                this.camera.position.copy(originalPosition);
            }, 50);
        }
        
        // Create bullet trail(s) based on weapon type
        const results = [];
        const pelletCount = currentWeapon.pellets || 1;
        
        for (let i = 0; i < pelletCount; i++) {
            const raycaster = new THREE.Raycaster();
            const direction = new THREE.Vector2(0, 0);
            
            // Add weapon spread
            direction.x += (Math.random() - 0.5) * currentWeapon.spread;
            direction.y += (Math.random() - 0.5) * currentWeapon.spread;
            
            raycaster.setFromCamera(direction, this.camera);
            
            // Create visible bullet trail
            this.createBulletTrail(raycaster.ray.origin, raycaster.ray.direction);
            
            const intersects = raycaster.intersectObjects(this.scene.children, true);
            results.push({
                raycaster,
                intersects,
                damage: currentWeapon.damage
            });
        }
        
        // Play appropriate sound
        if (currentWeapon.silenced) {
            this.audioManager.playSound('silenced_shot');
        } else {
            this.audioManager.playSound('shoot');
        }
        
        return results;
    }
    
    createBulletTrail(origin, direction) {
        /* @tweakable bullet trail visual properties */
        const trailLength = 50;
        const trailSpeed = 150; // increased from 100 for better visibility
        const trailWidth = 0.03; // increased from 0.02
        
        const geometry = new THREE.CylinderGeometry(trailWidth, trailWidth * 0.3, trailLength * 0.15);
        const material = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9,
            emissive: 0x004444,
            emissiveIntensity: 0.8
        });
        
        const trail = new THREE.Mesh(geometry, material);
        trail.position.copy(origin);
        trail.lookAt(origin.clone().add(direction));
        trail.rotateX(Math.PI / 2);
        
        this.scene.add(trail);
        
        // Enhanced trail animation with glow effect
        const startTime = Date.now();
        /* @tweakable bullet trail lifetime in milliseconds */
        const trailLifetime = 300; // reduced from 500 for snappier feel
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / trailLifetime;
            
            if (progress >= 1) {
                this.scene.remove(trail);
                return;
            }
            
            // Move trail forward
            trail.position.add(direction.clone().multiplyScalar(trailSpeed * 0.016));
            
            // Enhanced fade with pulsing effect
            const pulse = Math.sin(elapsed * 0.01) * 0.2 + 0.8;
            trail.material.opacity = 0.9 * (1 - progress) * pulse;
            trail.material.emissiveIntensity = 0.8 * (1 - progress * 0.5);
            
            requestAnimationFrame(animate);
        };
        animate();
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