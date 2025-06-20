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
}