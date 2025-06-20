import * as THREE from 'three';

export class FragmentManager {
    constructor(scene, room) {
        this.scene = scene;
        this.room = room;
        this.fragment = null;
        this.fragments = []; // Initialize fragments array
        this.centerPosition = { x: 0, y: 5, z: 0 }; // Center of map for CTF
        
        // Volatile fragment mechanics
        /* @tweakable fragment auto-return timer in seconds */
        this.autoReturnTimer = 60;
        this.fragmentPickupTime = 0;
        this.isFragmentVolatile = false;
    }
    
    generateFragments() {
        const fragmentPositions = [
            { x: 0, y: 5, z: 0 },
            { x: 25, y: 5, z: -25 },
            { x: -25, y: 5, z: 25 },
            { x: 15, y: 5, z: 15 },
            { x: -15, y: 5, z: -15 },
            { x: 35, y: 8, z: 0 },
            { x: -35, y: 8, z: 0 },
            { x: 0, y: 8, z: 35 },
            { x: 0, y: 8, z: -35 }
        ];
        
        fragmentPositions.forEach((pos, index) => {
            this.createFragment(`fragment_${index}`, pos);
        });
    }
    
    generateFragment() {
        this.createFragment('center_fragment', this.centerPosition);
    }
    
    createFragment(id, position) {
        // Remove existing fragment with same ID first
        this.fragments = this.fragments.filter(fragment => {
            if (fragment.userData && fragment.userData.id === id) {
                this.scene.remove(fragment);
                return false;
            }
            return true;
        });
        
        // Create new fragment with enhanced volatile appearance
        const geometry = new THREE.OctahedronGeometry(1.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffdd00,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.9,
            emissive: 0xffdd00,
            emissiveIntensity: 0.5
        });
        
        const fragment = new THREE.Mesh(geometry, material);
        fragment.position.set(position.x, position.y, position.z);
        fragment.userData = { id, isFragment: true, volatile: false };
        
        // Add enhanced floating animation with corruption effects
        const originalY = position.y;
        fragment.userData.animate = (time, isVolatile = false) => {
            fragment.position.y = originalY + Math.sin(time * 2) * 0.5;
            fragment.rotation.y = time * 0.5;
            fragment.rotation.x = Math.sin(time) * 0.2;
            
            // Volatile fragment effects
            if (isVolatile) {
                /* @tweakable volatile fragment visual intensity */
                const volatileIntensity = 2.0;
                fragment.material.emissiveIntensity = 0.5 + Math.sin(time * 5) * 0.3 * volatileIntensity;
                fragment.scale.setScalar(1 + Math.sin(time * 3) * 0.1 * volatileIntensity);
                
                // Add pulsing corruption color
                const corruptionColor = new THREE.Color().lerpColors(
                    new THREE.Color(0xffdd00),
                    new THREE.Color(0xff0000),
                    (Math.sin(time * 4) + 1) * 0.5
                );
                fragment.material.emissive.copy(corruptionColor);
            }
        };
        
        this.scene.add(fragment);
        
        // Set as the main fragment if it's the center fragment
        if (id === 'center_fragment') {
            this.fragment = fragment;
            this.fragmentPickupTime = 0;
            this.isFragmentVolatile = false;
        }
        
        // Add to fragments array
        this.fragments.push(fragment);
        
        // Update room state
        if (this.room) {
            this.room.updateRoomState({
                fragment: {
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    active: true,
                    id: id,
                    volatile: false
                }
            });
        }
    }
    
    removeFragment(id = 'center_fragment') {
        let removedFragment = null;
        
        this.fragments = this.fragments.filter(fragment => {
            if (fragment.userData && fragment.userData.id === id) {
                this.scene.remove(fragment);
                removedFragment = fragment;
                return false;
            }
            return true;
        });
        
        // Clear main fragment reference if it was the center fragment
        if (id === 'center_fragment') {
            this.fragment = null;
        }
        
        if (removedFragment) {
            // Update room state
            if (this.room) {
                this.room.updateRoomState({
                    fragment: {
                        active: false,
                        id: id
                    }
                });
            }
            return true;
        }
        return false;
    }
    
    updateFragments(roomFragments = {}) {
        if (!roomFragments || typeof roomFragments !== 'object') {
            return;
        }
        
        this.fragments = this.fragments.filter(fragment => {
            // Check if fragment has proper userData and id
            if (!fragment.userData || !fragment.userData.id) {
                return true; // Keep fragments without proper ID for now
            }
            
            const id = fragment.userData.id;
            const fragmentData = roomFragments[id];
            
            if (!fragmentData || !fragmentData.active) {
                this.scene.remove(fragment);
                // Clear main fragment reference if needed
                if (id === 'center_fragment') {
                    this.fragment = null;
                }
                return false;
            }
            return true;
        });
    }
    
    makeFragmentVolatile() {
        if (this.fragment) {
            this.isFragmentVolatile = true;
            this.fragment.userData.volatile = true;
            
            // Enhanced volatile effects
            /* @tweakable volatile fragment warning threshold in seconds */
            const volatileWarningTime = 45;
            /* @tweakable volatile fragment explosion time in seconds */
            const explosionTime = 75;
            
            // Start pulsing corruption effects
            this.startVolatileEffects();
            
            // Update room state
            if (this.room) {
                this.room.updateRoomState({
                    fragment: {
                        volatile: true,
                        autoReturnTime: Date.now() + (this.autoReturnTimer * 1000),
                        explosionTime: Date.now() + (explosionTime * 1000)
                    }
                });
            }
        }
    }
    
    startVolatileEffects() {
        if (!this.fragment) return;
        
        /* @tweakable volatile fragment pulse frequency */
        const pulseFrequency = 0.1; // seconds between pulses
        let lastPulseTime = 0;
        
        const volatileEffect = () => {
            if (!this.isFragmentVolatile || !this.fragment) return;
            
            const now = Date.now();
            if (now - lastPulseTime > pulseFrequency * 1000) {
                // Create expanding corruption ring
                this.createCorruptionPulse(this.fragment.position);
                lastPulseTime = now;
            }
            
            requestAnimationFrame(volatileEffect);
        };
        volatileEffect();
    }
    
    createCorruptionPulse(position) {
        /* @tweakable corruption pulse visual properties */
        const pulseRadius = 3;
        const pulseLifetime = 1000; // milliseconds
        
        const ringGeometry = new THREE.RingGeometry(0, pulseRadius, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        const pulse = new THREE.Mesh(ringGeometry, ringMaterial);
        pulse.position.copy(position);
        pulse.rotation.x = Math.PI / 2;
        
        if (this.scene) {
            this.scene.add(pulse);
            
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / pulseLifetime;
                
                if (progress >= 1) {
                    this.scene.remove(pulse);
                    return;
                }
                
                pulse.scale.setScalar(1 + progress * 2);
                pulse.material.opacity = 0.5 * (1 - progress);
                
                requestAnimationFrame(animate);
            };
            animate();
        }
    }
    
    checkAutoReturn(currentTime) {
        if (this.fragmentPickupTime > 0) {
            const holdTime = (currentTime - this.fragmentPickupTime) / 1000;
            
            // Make fragment volatile after timer
            if (holdTime > this.autoReturnTimer && !this.isFragmentVolatile) {
                this.makeFragmentVolatile();
                return 'volatile';
            }
            
            // Auto-return if corruption reaches 100%
            /* @tweakable corruption threshold for fragment auto-return */
            const corruptionThreshold = 100;
            if (holdTime > this.autoReturnTimer * 1.5) {
                return 'auto_return';
            }
        }
        
        return null;
    }
    
    forceFragmentReturn() {
        // Force fragment to return to center
        this.createFragment('center_fragment', this.centerPosition);
        this.fragmentPickupTime = 0;
        this.isFragmentVolatile = false;
        
        if (this.room) {
            this.room.updateRoomState({
                fragment: {
                    x: this.centerPosition.x,
                    y: this.centerPosition.y,
                    z: this.centerPosition.z,
                    active: true,
                    id: 'center_fragment',
                    volatile: false,
                    autoReturned: true
                }
            });
        }
    }
    
    setFragmentPickupTime(time) {
        this.fragmentPickupTime = time;
    }
    
    animateFragments(time) {
        this.fragments.forEach(fragment => {
            if (fragment.userData.animate) {
                fragment.userData.animate(time, fragment.userData.volatile);
            }
        });
    }
    
    respawnFragment() {
        if (!this.fragment) {
            this.createFragment('center_fragment', this.centerPosition);
        }
    }
    
    updateFragment(roomFragment = null) {
        if (roomFragment && !roomFragment.active && this.fragment) {
            this.removeFragment('center_fragment');
        }
    }
    
    animateFragment(time) {
        if (this.fragment && this.fragment.userData.animate) {
            this.fragment.userData.animate(time, this.fragment.userData.volatile);
        }
        
        // Also animate all fragments for consistency
        this.fragments.forEach(fragment => {
            if (fragment.userData.animate) {
                fragment.userData.animate(time, fragment.userData.volatile);
            }
        });
    }
    
    checkFragmentPickup(playerPosition, pickupRadius = 2) {
        if (!this.fragment) return false;
        
        const distance = playerPosition.distanceTo(this.fragment.position);
        return distance < 2;
    }
}