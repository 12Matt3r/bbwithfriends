import * as THREE from 'three';

const FRAGMENT_DEFAULT_SPAWN_POS = { x: 0, y: 1, z: 0 };

export class FragmentManager {
    constructor(scene, gameCore) { // gameCore passed for networkManager access
        this.scene = scene;
        this.gameCore = gameCore; // Store gameCore reference
        
        this.fragmentMeshes = {}; // Stores THREE.Mesh objects, keyed by fragmentId
        this.fragmentStates = {}; // Stores state data: { id, position, isCollected, carrierId, isVolatile, pickupTime }
                                 // This is the source of truth, synced with network.

        this.centerPosition = { ...FRAGMENT_DEFAULT_SPAWN_POS };
        this.autoReturnTimer = 60; // Default, can be per-fragment if needed
    }

    spawnInitialFragment() {
        const id = 'center_fragment';
        const pos = this.centerPosition;
        
        // Only spawn if it doesn't exist or isn't already considered "active" (not collected)
        if (!this.fragmentStates[id] || this.fragmentStates[id].isCollected) {
            this.fragmentStates[id] = {
                id: id,
                position: { ...pos },
                isCollected: false,
                carrierId: null,
                isVolatile: false,
                pickupTime: 0,
                pingAccumulator: 0, // Initialize ping accumulator
                PING_INTERVAL: 20000, // Default ping interval in ms
                continuousHoldTime: 0, // For Overheat Mode
                OVERHEAT_THRESHOLD: 100000 // 100 seconds, e.g.
            };
            this.createFragmentMesh(id, pos); // Create mesh
            // Announce its existence and state
            this.updateFragmentOnNetwork(id);
        } else if (!this.fragmentMeshes[id] && !this.fragmentStates[id].isCollected) {
            // State exists but mesh doesn't - e.g. after a client reconnects
            this.createFragmentMesh(id, this.fragmentStates[id].position);
        }
    }
    
    createFragmentMesh(id, position) {
        if (this.fragmentMeshes[id]) {
            this.scene.remove(this.fragmentMeshes[id]);
            // delete this.fragmentMeshes[id]; // No, keep it for re-use if needed, just ensure removed from scene
        }

        const geometry = new THREE.OctahedronGeometry(1.0); // Slightly smaller for easier pickup
        const material = new THREE.MeshStandardMaterial({
            color: 0xffdd00, metalness: 0.8, roughness: 0.2,
            emissive: 0xccaa00, emissiveIntensity: 0.6,
            transparent: true, opacity: 0.95
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.userData = { id, isFragment: true }; // Basic userData
        
        this.scene.add(mesh);
        this.fragmentMeshes[id] = mesh;
    }

    updateFragmentState(id, newState) {
        if (!this.fragmentStates[id]) {
            // Ensure new fragments also get ping properties
            this.fragmentStates[id] = {
                id,
                position: {...FRAGMENT_DEFAULT_SPAWN_POS},
                isCollected: false, carrierId: null,
                isVolatile: false, pickupTime: 0,
                pingAccumulator: 0, PING_INTERVAL: 20000,
                continuousHoldTime: 0, OVERHEAT_THRESHOLD: 100000
            };
        }
        
        // Preserve existing pingAccumulator and continuousHoldTime unless newState explicitly provides them
        const existingPingAccumulator = this.fragmentStates[id].pingAccumulator;
        const existingContinuousHoldTime = this.fragmentStates[id].continuousHoldTime;

        // Object.assign(this.fragmentStates[id], newState); // REMOVE THIS DUPLICATE

        if (newState.pingAccumulator === undefined) {
            this.fragmentStates[id].pingAccumulator = existingPingAccumulator;
        }
        if (newState.continuousHoldTime === undefined) {
            this.fragmentStates[id].continuousHoldTime = existingContinuousHoldTime;
        }
        
        const oldState = { ...this.fragmentStates[id] }; // Shallow copy for before/after comparison
        Object.assign(this.fragmentStates[id], newState);
        const state = this.fragmentStates[id]; // This is the new, updated state
        const mesh = this.fragmentMeshes[id];

        // Streamer event logging for collection/drop
        if (this.gameCore && this.gameCore.streamerDataManager) {
            if (!oldState.isCollected && state.isCollected && state.carrierId) {
                const playerName = this.gameCore.getPlayerName ? this.gameCore.getPlayerName(state.carrierId) : state.carrierId;
                this.gameCore.streamerDataManager.addStreamerEvent(`Fragment ${id} collected by ${playerName}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.addTimelineEvent(`Fragment ${id} collected by ${playerName}!`, "fragment_collect");
            } else if (oldState.isCollected && !state.isCollected) {
                this.gameCore.streamerDataManager.addStreamerEvent(`Fragment ${id} dropped!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.addTimelineEvent(`Fragment ${id} dropped by ${oldState.carrierId ? (this.gameCore.getPlayerName ? this.gameCore.getPlayerName(oldState.carrierId) : oldState.carrierId) : 'unknown'}!`, "fragment_drop");
            }
        }

        if (state.isCollected) {
            if (mesh) mesh.visible = false;
            state.pickupTime = state.pickupTime || Date.now(); // Set pickup time if not already set
            // continuousHoldTime will be incremented by GameCore's authoritative logic
            // pingAccumulator also handled by GameCore authoritative logic or reset in newState
        } else { // Not collected (dropped or spawned)
            state.pickupTime = 0;
            state.isVolatile = false; // Reset volatile on drop/spawn
            state.pingAccumulator = 0; // Reset ping accumulator
            state.continuousHoldTime = 0; // Reset continuous hold time
            if (state.position) {
                if (!mesh) {
                    this.createFragmentMesh(id, state.position);
                } else {
                    mesh.position.set(state.position.x, state.position.y, state.position.z);
                    mesh.visible = true;
                }
            } else if (mesh) { // No position but should be visible (e.g. initial state)
                 mesh.visible = true;
            }
            // If fragment was just dropped or spawned (isCollected is false and has a position)
            if (id === 'center_fragment' && !state.isCollected && state.position && this.gameCore.effectsManager) {
                this.gameCore.effectsManager.startTerrainCorruption(id, state.position, this.gameCore.gameSettings?.fragmentCorruptionRadius || 7);
            }
        }
        this.updateFragmentOnNetwork(id);

        // Effects for pickup
        if (id === 'center_fragment' && newState.isCollected === true && this.gameCore.effectsManager) {
            this.gameCore.effectsManager.stopTerrainCorruption(id);
        }
    }
    
    updateFragmentOnNetwork(id) {
        if (this.gameCore.networkManager && this.fragmentStates[id]) {
             this.gameCore.networkManager.updateRoomStateFragment(id, this.fragmentStates[id]);
        }
    }

    collectFragment(id, playerId) {
        const state = this.getFragmentState(id);
        if (state && !state.isCollected) {
            // Reset continuousHoldTime on fresh pickup
            this.updateFragmentState(id, {
                isCollected: true, carrierId: playerId, position: null,
                pickupTime: Date.now(), continuousHoldTime: 0
            });
            return true;
        }
        return false;
    }

    dropFragment(id, dropPosition) {
        const state = this.getFragmentState(id);
        if (state && state.isCollected) { // Can only drop if collected
            this.updateFragmentState(id, {
                isCollected: false, carrierId: null, position: dropPosition,
                isVolatile: false, pickupTime: 0, pingAccumulator: 0, continuousHoldTime: 0 // Reset relevant timers
            });
            return true;
        }
        if (!state && dropPosition) { // Fragment doesn't exist in state yet, treat as new spawn (e.g. initial forced by admin)
             this.updateFragmentState(id, {
                isCollected: false, carrierId: null, position: dropPosition,
                isVolatile: false, pickupTime: 0, pingAccumulator: 0, continuousHoldTime: 0
            });
            return true;
        }
        return false;
    }

    getFragmentState(id) {
        return this.fragmentStates[id] || null;
    }

    updateFragmentsFromNetwork(networkFragmentStates) {
        if (!networkFragmentStates || typeof networkFragmentStates !== 'object') {
            return;
        }

        for (const id in networkFragmentStates) {
            const netState = networkFragmentStates[id];
            let localState = this.fragmentStates[id];

            if (!localState) {
                this.fragmentStates[id] = { ...netState }; // Create local state if new
                localState = this.fragmentStates[id];
            } else {
                Object.assign(localState, netState); // Update existing local state
            }
            
            const mesh = this.fragmentMeshes[id];
            if (!localState.isCollected && localState.position) {
                if (!mesh) {
                    this.createFragmentMesh(id, localState.position);
                } else {
                    mesh.position.set(localState.position.x, localState.position.y, localState.position.z);
                    mesh.visible = true;
                }
            } else if (mesh) { // Is collected or no position
                mesh.visible = false;
            }
        }

        // Optional: Remove local fragments no longer in network state
        for (const localId in this.fragmentStates) {
            if (!networkFragmentStates[localId]) {
                if (this.fragmentMeshes[localId]) {
                    this.scene.remove(this.fragmentMeshes[localId]);
                    delete this.fragmentMeshes[localId];
                }
                delete this.fragmentStates[localId];
            }
        }
    }
    
    makeFragmentVolatile(id) {
        const state = this.getFragmentState(id);
        if (state && state.isCollected && !state.isVolatile) {
            this.updateFragmentState(id, { isVolatile: true });
            // Visual effects on carrier/UI are handled elsewhere based on this state.
            console.log(`Fragment ${id} is now volatile.`);
        }
    }
    
    // createCorruptionPulse remains largely the same, used for visual feedback.
    // Might be triggered by UIManager or GameCore based on fragment state.
    createCorruptionPulse(position) {
        const pulseRadius = 3;
        const pulseLifetime = 1000;
        const ringGeometry = new THREE.RingGeometry(0, pulseRadius, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000, transparent: true, opacity: 0.5, side: THREE.DoubleSide
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
                if (progress >= 1) { this.scene.remove(pulse); return; }
                pulse.scale.setScalar(1 + progress * 2);
                pulse.material.opacity = 0.5 * (1 - progress);
                requestAnimationFrame(animate);
            };
            animate();
        }
    }
    
    checkAutoReturn(id, currentTime) {
        const state = this.getFragmentState(id);
        if (state && state.isCollected && state.pickupTime > 0) {
            const holdTime = (currentTime - state.pickupTime) / 1000;

            if (holdTime > this.autoReturnTimer && !state.isVolatile) {
                this.makeFragmentVolatile(id);
                return 'volatile'; // Inform GameCore to show UI warning
            }
            if (state.isVolatile && holdTime > this.autoReturnTimer + 30) { // Example: 30s after becoming volatile
                return 'auto_return'; // Inform GameCore to force return
            }
        }
        return null;
    }
    
    forceFragmentReturn(id) {
        const state = this.getFragmentState(id);
        if (state) {
            // Drop fragment at center, this updates state and network
            this.dropFragment(id, this.centerPosition);
            if(this.gameCore && this.gameCore.uiManager) {
                 this.gameCore.uiManager.addKillFeedEntry(`Fragment ${id.replace('_', ' ')} auto-returned!`);
            }
        }
    }
        
    animateActiveFragments(time) {
        for (const id in this.fragmentStates) {
            const state = this.fragmentStates[id];
            const mesh = this.fragmentMeshes[id];
            if (mesh && !state.isCollected && mesh.visible) {
                const basePosY = state.position?.y || this.centerPosition.y;
                mesh.position.y = basePosY + Math.sin(time * 2 + mesh.uuid.substring(0,4).charCodeAt(0) * 0.1) * 0.25; // Use part of uuid for offset
                mesh.rotation.y = time * 0.3 + mesh.uuid.substring(0,4).charCodeAt(1) * 0.1;

                if (state.isVolatile) {
                    mesh.material.emissiveIntensity = 0.5 + Math.sin(time * 10) * 0.5;
                    const scaleFactor = 1 + Math.sin(time * 6) * 0.1;
                    mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
                } else {
                     mesh.material.emissiveIntensity = 0.6;
                     mesh.scale.set(1,1,1);
                }
            }
        }
    }
    
    getTouchingFragmentId(playerPosition, pickupRadius = 1.5) { // Reduced radius for more precise pickup
        for (const id in this.fragmentStates) {
            const state = this.fragmentStates[id];
            const mesh = this.fragmentMeshes[id];
            if (mesh && !state.isCollected && mesh.visible) {
                // Ensure mesh position is up-to-date if it's animated separately from state.position
                // For simplicity, we assume mesh.position is the authoritative visual position.
                const distance = playerPosition.distanceTo(mesh.position);
                if (distance < pickupRadius) {
                    return id;
                }
            }
        }
        return null;
    }
}