import * as THREE from 'three';

export class EffectsManager {
    constructor(scene, gameState, environment) {
        this.scene = scene;
        this.gameState = gameState;
        this.environment = environment;
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
            color: enemyType === 'creepy_krab' ? 0xff4500 : 0x880088, // OrangeRed for krab, Purple for others
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

    createImpactEffect(positionVec3, materialType) { // materialType is currently a string name
        console.log(`Creating impact effect at ${positionVec3.x}, ${positionVec3.y}, ${positionVec3.z} on material: ${materialType}`);
        // Re-use or adapt createHitEffect for generic impacts
        // For now, let's make it slightly different: smaller, quicker, different color
        const particleCount = 3 + Math.floor(Math.random() * 3);
        const particleSpeed = 0.3 + Math.random() * 0.2;
        const particleLifetime = 300 + Math.random() * 200;

        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.03 + Math.random() * 0.02);
            // Sparks for generic/metal, dust for others?
            const color = (materialType === 'metal' || materialType === 'generic') ? 0xffff00 : 0x888888;
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 1
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(positionVec3);
            const velocity = new THREE.Vector3(
                (Math.random() - 0.5) * particleSpeed,
                (Math.random() - 0.5) * particleSpeed, // Sparks can go in any direction
                (Math.random() - 0.5) * particleSpeed
            );
            this.scene.add(particle);
            const startTime = Date.now();
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = elapsed / particleLifetime;
                if (progress >= 1) { this.scene.remove(particle); return; }
                particle.position.add(velocity.clone().multiplyScalar(0.016));
                velocity.y -= 0.005; // A little gravity for sparks
                particle.material.opacity = 1 - progress;
                requestAnimationFrame(animate);
            };
            animate();
        }
    }

    showHitConfirmation() {
        // Example: A small, quick red flash or crosshair change
        // Using addScreenFlash for simplicity, but could be a dedicated UI element
        this.addScreenFlash('rgba(255,0,0,0.2)', 80); // Brief, semi-transparent red flash

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
}