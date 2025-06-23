import * as THREE from 'three';
import { MATERIAL_TYPES, SOUND_KEYS } from './Constants.js';

export class EffectsManager {
    constructor(scene, gameState, environment) {
        this.scene = scene;
        this.gameState = gameState;
        this.environment = environment;
        this.activeCorruptionEffects = {};
        this.corruptionDecalMaterial = null;
        this.initializeCorruptionEffects();

        this.currentMutationLevel = 0;
        this.mutationEffectInterval = null;
        this.gameCore = environment.gameCore; // Assuming environment has a ref to gameCore, or pass gameCore directly

        this.speakingIndicators = {}; // { playerId: THREE.Sprite }
        this.speakingIndicatorMaterial = null;
        this.initSpeakingIndicator();
    }

    initSpeakingIndicator() {
        try {
            const speakerTexture = new THREE.TextureLoader().load('speaker_icon.png',
                () => {}, // Optional onLoad callback
                undefined, // Optional onProgress callback
                (err) => { console.error('EffectsManager: Error loading speaker_icon.png:', err); } // onError callback
            );
            this.speakingIndicatorMaterial = new THREE.SpriteMaterial({
                map: speakerTexture,
                color: 0xffffff,
                transparent: true,
                depthTest: false, // Render on top of other objects
                depthWrite: false // Don't write to depth buffer
            });
        } catch (error) {
            console.error("EffectsManager: Failed to initialize speaker icon material:", error);
            // Fallback material if texture loading fails hard (e.g. TextureLoader not available)
            this.speakingIndicatorMaterial = new THREE.SpriteMaterial({
                color: 0x00ff00, // Bright green as fallback
                transparent: true,
                opacity: 0.8,
                depthTest: false,
                depthWrite: false
            });
        }
    }

    initializeCorruptionEffects() {
        this.corruptionDecalMaterial = new THREE.MeshPhongMaterial({
            color: 0x2a002a, // Dark, slightly emissive purple from plan
            emissive: 0x1a001a,
            transparent: true,
            opacity: 0.65, // Plan opacity
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -0.1,
        });
    }
    
    createHitEffect(position) {
        // Enhanced hit effect with multiple particles
        const particleCount = 5;
        /* @tweakable hit effect particle properties */
        const particleSpeed = 0.5;
        const particleLifetime = 800;
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.03);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(0.15 + Math.random() * 0.1, 1, 0.5),
                transparent: true,
                opacity: 1
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            // Random velocity for each particle
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * particleSpeed,
                Math.random() * particleSpeed,
                (Math.random() - 0.5) * particleSpeed
            );
            
            this.scene.add(particle);
            
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / particleLifetime;
                
                if (progress >= 1) {
                    this.scene.remove(particle);
                    return;
                }
                
                // Update particle position and fade
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.multiplyScalar(0.98); // friction
                velocity.y -= 0.01; // gravity
                
                particle.material.opacity = 1 - progress;
                particle.scale.setScalar(1 + progress * 2);
                
                requestAnimationFrame(animate);
            };
            animate();
        }
        
        // Add impact flash
        const flashGeometry = new THREE.SphereGeometry(0.2);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);
        
        const flashDuration = 100;
        setTimeout(() => {
            this.scene.remove(flash);
        }, flashDuration);
    }
    
    createRemoteShotEffect(position, direction, duration) {
        // Create muzzle flash effect for remote players
        const geometry = new THREE.SphereGeometry(0.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1
        });
        
        const effect = new THREE.Mesh(geometry, material);
        effect.position.copy(position);
        this.scene.add(effect);
        
        // Create tracer effect
        const tracerGeometry = new THREE.CylinderGeometry(0.01, 0.01, 10);
        const tracerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        
        const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
        tracer.position.copy(position);
        tracer.lookAt(position.clone().add(direction.multiplyScalar(10)));
        tracer.rotateX(Math.PI / 2);
        this.scene.add(tracer);
        
        // Animate effects
        const startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1) {
                this.scene.remove(effect);
                this.scene.remove(tracer);
                return;
            }
            
            effect.material.opacity = 1 - progress;
            tracer.material.opacity = 0.8 * (1 - progress);
            /* @tweakable remote shot effect scale animation */
            const scaleMultiplier = 1.5;
            effect.scale.setScalar(1 + progress * scaleMultiplier);
            
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    applyCorruptionEffects() {
        const level = this.gameState.corruptionLevel;
        
        /* @tweakable corruption level threshold for UI glitches */
        const uiGlitchThreshold = 20;
        if (level > uiGlitchThreshold) {
            /* @tweakable probability of UI glitch occurring */
            const glitchProbability = 0.1;
            if (Math.random() < glitchProbability) {
                document.getElementById('game-ui').classList.add('glitched');
                /* @tweakable duration of UI glitch effect in milliseconds */
                const glitchDuration = 100;
                setTimeout(() => {
                    document.getElementById('game-ui').classList.remove('glitched');
                }, glitchDuration);
            }
        }
        
        /* @tweakable corruption level threshold for control inversion */
        const controlInversionThreshold = 50;
        if (level > controlInversionThreshold) {
            /* @tweakable probability of control inversion occurring */
            const inversionProbability = 0.05;
            if (Math.random() < inversionProbability) {
                /* @tweakable duration of control inversion in milliseconds */
                const inversionDuration = 2000;
                this.invertControls(inversionDuration);
            }
        }
        
        /* @tweakable corruption level threshold for severe visual effects */
        const severeEffectsThreshold = 80;
        if (level > severeEffectsThreshold) {
            /* @tweakable probability of severe visual effects */
            const severeEffectsProbability = 0.2;
            if (Math.random() < severeEffectsProbability) {
                document.getElementById('game-ui').classList.add('inverted');
                /* @tweakable duration of severe visual effects in milliseconds */
                const severeEffectsDuration = 1000;
                setTimeout(() => {
                    document.getElementById('game-ui').classList.remove('inverted');
                }, severeEffectsDuration);
            }
        }
        
        if (this.environment) {
            this.environment.applyCorruptionLighting(level);
        }
    }
    
    invertControls(duration) {
        // This would need to be connected to the input manager
        // For now, just a placeholder
        console.log('Controls inverted for', duration, 'ms');
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

    triggerFragmentPingEffect(positionArray, isSelfPing) {
        const position = new THREE.Vector3(...positionArray);

        if (isSelfPing) {
            // Example: Simple screen flash for self-ping
            this.addScreenFlash('rgba(0, 255, 255, 0.3)', 1500); // Cyan flash, 1.5 seconds

            // Could also add an outward ripple effect from player
            // For example, using a shader or expanding transparent circles on the ground
            console.log("Self fragment ping effect triggered at player's location.");

        } else {
            // Example: Create a temporary visual marker at the pinged location
            const pingGeometry = new THREE.SphereGeometry(0.5, 16, 8);
            const pingMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff, // Cyan
                transparent: true,
                opacity: 0.8,
                wireframe: true
            });
            const pingMesh = new THREE.Mesh(pingGeometry, pingMaterial);
            pingMesh.position.copy(position);

            // Add a light column effect
            const lightColumnGeometry = new THREE.CylinderGeometry(0.2, 0.8, 10, 12);
            const lightColumnMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const lightColumn = new THREE.Mesh(lightColumnGeometry, lightColumnMaterial);
            lightColumn.position.copy(position);
            lightColumn.position.y += 5; // Center the column

            this.scene.add(pingMesh);
            this.scene.add(lightColumn);

            const duration = 3000; // 3 seconds
            const startTime = Date.now();

            const animatePing = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / duration;

                if (progress >= 1) {
                    this.scene.remove(pingMesh);
                    this.scene.remove(lightColumn);
                    return;
                }

                pingMesh.scale.setScalar(1 + progress * 3); // Expand
                pingMesh.material.opacity = 0.8 * (1 - progress); // Fade out

                lightColumn.material.opacity = 0.3 * (1 - progress);
                lightColumn.scale.y = 1 + progress * 0.5; // Stretch and fade

                requestAnimationFrame(animatePing);
            };
            animatePing();
            console.log(`Remote fragment ping effect triggered at ${position.x}, ${position.y}, ${position.z}`);
        }
    }

    startOverheatVisualGlitches() {
        // Example: Add a persistent class to body or game container for CSS-based screen shaders/filters
        document.body.classList.add('overheat-active');
        console.log("Overheat visual glitches started.");
        // More advanced: could enable a post-processing pass if using Three.js EffectComposer
        // For instance, a film grain, scan lines, or chromatic aberration pass
        // this.composer.addPass(this.overheatPass);
        // This could also involve more frequent calls to random UI glitches from applyCorruptionEffects
        this.overheatInterval = setInterval(() => {
            if (Math.random() < 0.3) { // Higher chance during overheat
                 document.getElementById('game-ui').classList.add('glitched');
                 setTimeout(() => {
                    document.getElementById('game-ui').classList.remove('glitched');
                }, 150 + Math.random() * 200);
            }
             if (Math.random() < 0.1) {
                this.addScreenFlash('rgba(255,100,0,0.1)', 200); // Subtle orange flashes
            }
        }, 500); // Check to glitch every 500ms
    }

    stopOverheatVisualGlitches() {
        document.body.classList.remove('overheat-active');
        if (this.overheatInterval) {
            clearInterval(this.overheatInterval);
            this.overheatInterval = null;
        }
        console.log("Overheat visual glitches stopped.");
        // if (this.composer && this.overheatPass) this.composer.removePass(this.overheatPass);
    }

    triggerRandomExplosion(positionArray) {
        const position = new THREE.Vector3(...positionArray);
        console.log(`Triggering random explosion at ${position.x}, ${position.y}, ${position.z}`);
        // Use a more prominent hit effect or a dedicated explosion particle system
        // For now, reusing createHitEffect with more particles and different color
        const particleCount = 20 + Math.floor(Math.random() * 20); // More particles
        const particleSpeed = 1 + Math.random() * 1;
        const particleLifetime = 1000 + Math.random() * 1000;

        for (let i = 0; i < particleCount; i++) {
            const size = 0.1 + Math.random() * 0.2;
            const geometry = new THREE.SphereGeometry(size);
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5), // Red-Orange-Yellow
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * particleSpeed * 2,
                (Math.random() - 0.5) * particleSpeed * 2, // Allow downward movement too
                (Math.random() - 0.5) * particleSpeed * 2
            );
            this.scene.add(particle);
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / particleLifetime;
                if (progress >= 1) { this.scene.remove(particle); return; }
                particle.position.add(velocity.clone().multiplyScalar(0.016)); // deltaTime approx
                velocity.multiplyScalar(0.96);
                particle.material.opacity = 1 - progress;
                requestAnimationFrame(animate);
            };
            animate();
        }
        // Add a more significant screen flash for explosions
        this.addScreenFlash('rgba(255, 50, 0, 0.4)', 300);
    }

    spawnHallucinatedEnemy(positionArray, enemyType) {
        const position = new THREE.Vector3(...positionArray);
        console.log(`Spawning hallucination (${enemyType}) at ${position.x}, ${position.y}, ${position.z}`);

        // Example: Simple ghostly sphere
        const hallucinationGeometry = new THREE.SphereGeometry(0.8, 16, 12);
        const hallucinationMaterial = new THREE.MeshBasicMaterial({
            color: enemyType === 'creepy_krab' ? 0xff4500 : 0x880088, // OrangeRed for krab, Purple for others // TODO: Consider constants for enemy types if they are used elsewhere
            transparent: true,
            opacity: 0.3 + Math.random() * 0.2,
            wireframe: true
        });
        const hallucinationMesh = new THREE.Mesh(hallucinationGeometry, hallucinationMaterial);
        hallucinationMesh.position.copy(position);
        this.scene.add(hallucinationMesh);

        const duration = 2000 + Math.random() * 3000; // Lasts 2-5 seconds
        const startTime = Date.now();
        const animateHallucination = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;
            if (progress >= 1) {
                this.scene.remove(hallucinationMesh);
                return;
            }
            // Shimmer or move slightly
            hallucinationMesh.position.x += Math.sin(elapsed * 0.005 + Math.random()) * 0.05;
            hallucinationMesh.material.opacity = (0.3 + Math.random() * 0.1) * (1 - progress);
            requestAnimationFrame(animateHallucination);
        };
        animateHallucination();
    }

    createProjectileTrail(startPointVec3, endPointVec3) {
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff, // Cyan color for trail
            linewidth: 2, // Note: linewidth property might not work on all platforms/drivers
            transparent: true,
            opacity: 0.7
        });

        const points = [];
        points.push(startPointVec3);
        points.push(endPointVec3);

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        const trailDuration = 150; // ms
        setTimeout(() => {
            this.scene.remove(line);
            material.dispose();
            geometry.dispose();
        }, trailDuration);
    }

    createImpactEffect(positionVec3, materialType) {
        console.log(`Creating impact effect at ${positionVec3.x}, ${positionVec3.y}, ${positionVec3.z} on material: ${materialType}`);
        const particleCount = 3 + Math.floor(Math.random() * 3);
        const particleSpeed = 0.3 + Math.random() * 0.2;
        const particleLifetime = 300 + Math.random() * 200;

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.03 + Math.random() * 0.02);
            let color = 0x888888; // Default dust color
            if (materialType === MATERIAL_TYPES.METAL || materialType === MATERIAL_TYPES.GENERIC) {
                color = 0xffff00; // Sparks for metal/generic
            }
            // TODO: Add more material type checks if defined in MATERIAL_TYPES

            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(positionVec3);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * particleSpeed,
                (Math.random() - 0.5) * particleSpeed,
                (Math.random() - 0.5) * particleSpeed
            );
            this.scene.add(particle);
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / particleLifetime;
                if (progress >= 1) { this.scene.remove(particle); return; }
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 0.005;
                particle.material.opacity = 1 - progress;
                requestAnimationFrame(animate);
            };
            animate();
        }
    }

    showHitConfirmation() {
        this.addScreenFlash('rgba(255,0,0,0.2)', 80);

        // Alternative: Crosshair color change
        const crosshairDot = document.querySelector('#crosshair .crosshair-dot');
        if (crosshairDot) {
            const originalColor = crosshairDot.style.backgroundColor;
            crosshairDot.style.backgroundColor = 'red';
            setTimeout(() => {
                crosshairDot.style.backgroundColor = originalColor || 'var(--primary-color)';
            }, 100);
        }
    }

    startTerrainCorruption(effectId, positionObj, radius) {
        if (!this.corruptionDecalMaterial || !this.environment?.collidableMeshes) {
            console.warn("Corruption effects not initialized or environment not ready for raycasting.");
            return;
        }
        this.stopTerrainCorruption(effectId); // Clear existing decals for this effectId first

        const corruptionData = {
            position: new THREE.Vector3(positionObj.x, positionObj.y, positionObj.z),
            radius,
            decals: []
        };
        this.activeCorruptionEffects[effectId] = corruptionData;

        const NUM_CORRUPTION_DECALS = 20; // Plan value
        const DECAL_SIZE_MIN = 1.5;
        const DECAL_SIZE_MAX = 3.0; // Plan value
        const raycaster = new THREE.Raycaster(); // Raycaster should be initialized if not already a class member

        for (let i = 0; i < NUM_CORRUPTION_DECALS; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            const randomPointX = positionObj.x + Math.cos(angle) * dist;
            const randomPointZ = positionObj.z + Math.sin(angle) * dist;

            raycaster.set(new THREE.Vector3(randomPointX, positionObj.y + radius * 2, randomPointZ), new THREE.Vector3(0, -1, 0));

            // Use environment collidable meshes as potential ground targets
            const groundObjects = this.environment.collidableMeshes.filter(m => m.name.includes("floor") || m.name.includes("ground") || m.name.includes("terrain")); // Be more specific if possible
            if (groundObjects.length === 0) { // Fallback to all collidables if no specific ground found
                 groundObjects.push(...this.environment.collidableMeshes);
            }

            const intersects = raycaster.intersectObjects(groundObjects.length > 0 ? groundObjects : this.scene.children, true);

            if (intersects.length > 0) {
                const hitPoint = intersects[0].point;
                const decalSize = DECAL_SIZE_MIN + Math.random() * (DECAL_SIZE_MAX - DECAL_SIZE_MIN);
                const decalGeo = new THREE.PlaneGeometry(decalSize, decalSize);
                const decal = new THREE.Mesh(decalGeo, this.corruptionDecalMaterial);

                decal.position.set(hitPoint.x, hitPoint.y + 0.05, hitPoint.z);
                decal.rotation.x = -Math.PI / 2;
                decal.rotation.z = Math.random() * Math.PI; // Plan uses Math.PI, current uses Math.PI * 2. Sticking to plan.

                this.scene.add(decal);
                corruptionData.decals.push(decal);
            }
        }
        console.log(`Started terrain corruption for ${effectId} with ${corruptionData.decals.length} decals.`);
    }

    stopTerrainCorruption(effectId) {
        const corruptionData = this.activeCorruptionEffects[effectId];
        if (corruptionData) {
            corruptionData.decals.forEach(decal => {
                this.scene.remove(decal);
                decal.geometry.dispose();
                // Material is shared, so don't dispose it here unless it's unique per decal set
            });
            delete this.activeCorruptionEffects[effectId];
            console.log(`Stopped terrain corruption for ${effectId}.`);
        }
    }

    stopAllTerrainCorruption() {
        for (const id in this.activeCorruptionEffects) {
            this.stopTerrainCorruption(id);
        }
        console.log("Stopped all terrain corruption effects.");
    }

    setPlayerMutationEffectLevel(level) {
        if (this.currentMutationLevel === level && this.mutationEffectInterval && level !== 0) return;

        this.currentMutationLevel = level;
        const gameUiElement = document.getElementById('game-ui');

        if (this.mutationEffectInterval) {
            clearInterval(this.mutationEffectInterval);
            this.mutationEffectInterval = null;
        }

        if(gameUiElement) {
            gameUiElement.classList.remove('mutation-level-1', 'mutation-level-2');
        } else {
            document.body.classList.remove('mutation-level-1', 'mutation-level-2');
        }

        switch (level) {
            case 1:
                if(gameUiElement) gameUiElement.classList.add('mutation-level-1'); else document.body.classList.add('mutation-level-1');
                if (this.gameCore?.audioManager) this.gameCore.audioManager.playSound(SOUND_KEYS.MUTATION_LEVEL_1_START);
                console.log("Player Mutation Level 1 activated.");
                break;
            case 2:
                if(gameUiElement) gameUiElement.classList.add('mutation-level-2'); else document.body.classList.add('mutation-level-2');
                if (this.gameCore?.audioManager) this.gameCore.audioManager.playSound(SOUND_KEYS.MUTATION_LEVEL_2_START);
                console.log("Player Mutation Level 2 activated. Hallucinations may occur.");

                this.mutationEffectInterval = setInterval(() => {
                    if (this.currentMutationLevel === 2 && this.gameCore) {
                        if(this.gameCore.audioManager) this.gameCore.audioManager.playSound(SOUND_KEYS.LOCAL_HALLUCINATION_WHISPER);
                        this.addScreenFlash(Math.random() > 0.5 ? '#300330' : '#033003', 100, 0.2 + Math.random() * 0.1);
                    } else if (this.currentMutationLevel < 2 && this.mutationEffectInterval) {
                        clearInterval(this.mutationEffectInterval);
                        this.mutationEffectInterval = null;
                    }
                }, 8000 + Math.random() * 5000);
                break;
            case 0:
            default:
                if (this.gameCore?.audioManager) this.gameCore.audioManager.playSound(SOUND_KEYS.MUTATION_END);
                console.log("Player Mutation effects ended.");
                break;
        }
    }

    triggerSummonEchoEffect() {
        console.log("Summon Echo effect triggered!");
        // Using existing addScreenFlash, opacity is fixed at 0.3 by the method.
        // If variable opacity is needed, addScreenFlash would need modification.
        this.addScreenFlash('#a0a0ff', 300); // Light blue/purple flash for 300ms.

        if (this.gameCore && this.gameCore.audioManager && typeof this.gameCore.audioManager.playSound === 'function') {
            this.gameCore.audioManager.playSound(SOUND_KEYS.SUMMON_ECHO || 'summon_echo_sound');
        } else {
            console.warn("AudioManager or playSound method not available for summon_echo_sound.");
        }
    }

    triggerSwapEffect(position) {
        console.log("Swap effect triggered at", position);

        // Visual effect: Brief, expanding light sphere
        const sphereRadius = 0.5;
        const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 8);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xffa500, // Orange color for swap
            transparent: true,
            opacity: 0.7
        });
        const lightSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        lightSphere.position.copy(position);
        this.scene.add(lightSphere);

        const effectDuration = 500; // ms
        const startTime = Date.now();

        const animateEffect = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / effectDuration;

            if (progress >= 1) {
                this.scene.remove(lightSphere);
                sphereGeometry.dispose();
                sphereMaterial.dispose();
                return;
            }

            lightSphere.scale.setScalar(1 + progress * 3); // Expand
            lightSphere.material.opacity = 0.7 * (1 - progress); // Fade out

            requestAnimationFrame(animateEffect);
        };
        animateEffect();

        if (this.gameCore && this.gameCore.audioManager && typeof this.gameCore.audioManager.playSound === 'function') {
            this.gameCore.audioManager.playSound(SOUND_KEYS.SWAP_EFFECT || 'swap_effect_sound', position);
        } else {
            console.warn("AudioManager or playSound method not available for swap_effect_sound.");
        }
    }

    triggerGravityGlitchEffect(duration) {
        console.log("Gravity glitch effect triggered for duration:", duration);

        // Visual cue: Purple flash
        this.addScreenFlash('#551A8B', 500);

        if (this.gameCore && this.gameCore.audioManager && typeof this.gameCore.audioManager.playSound === 'function') {
            this.gameCore.audioManager.playSound(SOUND_KEYS.GRAVITY_GLITCH_START || 'gravity_glitch_start_sound');
        } else {
            console.warn("AudioManager or playSound method not available for gravity_glitch_start_sound.");
        }

        // Optional: Could start a persistent, mild screen effect here and stop it when gravity reverts.
        // For example, a very subtle screen shake or a slight desaturation filter applied via a CSS class on the body/game-container.
        // This would require a corresponding `stopGravityGlitchVisualEffect()` method or similar.
        // For now, just an initial visual/audio cue.
    }

    setPlayerSpeakingIndicator(playerId, isSpeaking, playerMesh) {
        if (!this.speakingIndicatorMaterial) {
            console.warn("setPlayerSpeakingIndicator: Speaking indicator material not initialized.");
            return;
        }

        if (isSpeaking) {
            if (!playerMesh) { // Cannot create indicator without a mesh to attach to
                // console.warn(`setPlayerSpeakingIndicator: Cannot show for ${playerId}, playerMesh not provided.`);
                return;
            }
            let indicator = this.speakingIndicators[playerId];
            if (!indicator) {
                indicator = new THREE.Sprite(this.speakingIndicatorMaterial.clone()); // Clone material for safety if props change
                indicator.scale.set(0.3, 0.3, 0.3);

                // Attempt to position above player's head
                // This assumes playerMesh is the root of the player model and has a boundingBox
                let yOffset = 1.0; // Default offset above origin
                if (playerMesh.geometry && playerMesh.geometry.boundingBox) {
                    yOffset = playerMesh.geometry.boundingBox.max.y + 0.3;
                } else if (playerMesh.userData && typeof playerMesh.userData.height === 'number') { // Custom height property
                    yOffset = playerMesh.userData.height + 0.3;
                }
                indicator.position.set(0, yOffset, 0);

                playerMesh.add(indicator);
                this.speakingIndicators[playerId] = indicator;
                // console.log(`Added speaking indicator for ${playerId}`);
            }
            indicator.visible = true;
        } else {
            if (this.speakingIndicators[playerId]) {
                this.speakingIndicators[playerId].visible = false;
                // console.log(`Hid speaking indicator for ${playerId}`);
                // Optionally, fully remove and dispose if players frequently connect/disconnect
                // if (this.speakingIndicators[playerId].parent) {
                //     this.speakingIndicators[playerId].parent.remove(this.speakingIndicators[playerId]);
                // }
                // this.speakingIndicators[playerId].material.map?.dispose(); // If map was cloned
                // this.speakingIndicators[playerId].material.dispose();
                // delete this.speakingIndicators[playerId];
            }
        }
    }
}