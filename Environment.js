import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export class Environment {
    constructor(scene) {
        this.scene = scene;
        this.fragments = [];
        this.collisionMeshes = [];
        this.loader = new GLTFLoader();
        this.rgbeLoader = new RGBELoader();
        this.lights = {};
        this.originalLightSettings = {};
        this.teamBases = {
            alpha: { position: new THREE.Vector3(-50, 0, 0), zone: null },
            beta: { position: new THREE.Vector3(50, 0, 0), zone: null }
        };
        
        // Mid-match objectives
        this.glitchVents = [];
        this.corruptionPools = [];
        this.activeEvents = [];
    }
    
    async create() {
        await this.loadHDREnvironment();
        await this.loadUrbanMap();
        this.createLighting();
        this.createTeamBases();
        this.createGlitchVents();
        this.createCorruptionPools();
        
        // Initialize treasure map system after environment is ready
        if (!this.treasureMapManager) {
            // Will be set from game.js
        }
    }
    
    setTreasureMapManager(treasureMapManager) {
        this.treasureMapManager = treasureMapManager;
        this.treasureMapManager.initialize();
    }
    
    async loadHDREnvironment() {
        // Create a simple HDR-like environment map using gradients
        const pmremGenerator = new THREE.PMREMGenerator(this.scene.children[0]?.renderer || new THREE.WebGLRenderer());
        
        // Create a simple gradient environment
        const renderTarget = pmremGenerator.fromScene(this.createEnvironmentScene());
        this.scene.environment = renderTarget.texture;
        
        pmremGenerator.dispose();
    }
    
    createEnvironmentScene() {
        const envScene = new THREE.Scene();
        
        // Create gradient background
        const geometry = new THREE.SphereGeometry(100, 32, 32);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x001122) },
                bottomColor: { value: new THREE.Color(0x000000) },
                offset: { value: 33 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        envScene.add(mesh);
        
        return envScene;
    }
    
    async loadUrbanMap() {
        return new Promise((resolve, reject) => {
            this.loader.load(
                'bottom.glb',
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Scale 1 unit = 1 meter
                    model.scale.setScalar(1);
                    
                    // Position the model
                    model.position.set(0, 0, 0);
                    
                    // Enable shadows and update materials
                    model.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            // Store collision meshes
                            this.collisionMeshes.push(child);
                            
                            // Upgrade to PBR materials
                            if (child.material) {
                                const oldMaterial = child.material;
                                child.material = new THREE.MeshStandardMaterial({
                                    color: oldMaterial.color || 0x666666,
                                    metalness: 0.3,
                                    roughness: 0.7,
                                    transparent: true,
                                    opacity: 0.9
                                });
                                
                                // Add emission for building surfaces
                                if (child.name.includes('building') || child.name.includes('structure')) {
                                    child.material.emissive = new THREE.Color(0x001100);
                                    child.material.emissiveIntensity = 0.1;
                                }
                            }
                        }
                    });
                    
                    this.scene.add(model);
                    console.log('Urban map loaded successfully');
                    resolve();
                },
                (progress) => {
                    console.log('Loading progress:', progress.loaded / progress.total * 100 + '%');
                },
                (error) => {
                    console.error('Error loading urban map:', error);
                    // Fallback to simple ground if model fails to load
                    this.createSimpleGround();
                    resolve();
                }
            );
        });
    }
    
    createSimpleGround() {
        // Fallback ground if GLB fails to load
        const geometry = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.MeshStandardMaterial({
            color: 0x003300,
            metalness: 0.1,
            roughness: 0.8,
            transparent: true,
            opacity: 0.8
        });
        
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        this.collisionMeshes.push(ground);
    }
    
    checkCollision(position, radius = 0.5) {
        const raycaster = new THREE.Raycaster();
        const directions = [
            new THREE.Vector3(1, 0, 0),   // right
            new THREE.Vector3(-1, 0, 0),  // left
            new THREE.Vector3(0, 0, 1),   // forward
            new THREE.Vector3(0, 0, -1),  // backward
            new THREE.Vector3(0, -1, 0)   // down
        ];
        
        for (let direction of directions) {
            raycaster.set(position, direction);
            const intersects = raycaster.intersectObjects(this.collisionMeshes, true);
            
            if (intersects.length > 0 && intersects[0].distance < radius) {
                return {
                    collision: true,
                    normal: intersects[0].face.normal,
                    distance: intersects[0].distance,
                    point: intersects[0].point
                };
            }
        }
        
        return { collision: false };
    }
    
    getGroundHeight(position) {
        const raycaster = new THREE.Raycaster();
        raycaster.set(
            new THREE.Vector3(position.x, position.y + 10, position.z),
            new THREE.Vector3(0, -1, 0)
        );
        
        const intersects = raycaster.intersectObjects(this.collisionMeshes, true);
        
        if (intersects.length > 0) {
            return intersects[0].point.y;
        }
        
        return 0; // Default ground level
    }
    
    createLighting() {
        // Ambient light
        this.lights.ambient = new THREE.AmbientLight(0x404040, 0.2);
        this.scene.add(this.lights.ambient);
        
        // Hemisphere light for natural sky lighting
        this.lights.hemisphere = new THREE.HemisphereLight(0x0077ff, 0x00ff00, 0.3);
        this.lights.hemisphere.position.set(0, 50, 0);
        this.scene.add(this.lights.hemisphere);
        
        // Main directional light (sun/moon) with shadows
        this.lights.directional = new THREE.DirectionalLight(0xffffff, 1.0);
        this.lights.directional.position.set(50, 100, 50);
        this.lights.directional.castShadow = true;
        this.lights.directional.shadow.camera.near = 0.1;
        this.lights.directional.shadow.camera.far = 300;
        this.lights.directional.shadow.camera.left = -100;
        this.lights.directional.shadow.camera.right = 100;
        this.lights.directional.shadow.camera.top = 100;
        this.lights.directional.shadow.camera.bottom = -100;
        this.lights.directional.shadow.mapSize.width = 2048;
        this.lights.directional.shadow.mapSize.height = 2048;
        this.lights.directional.shadow.bias = -0.0001;
        this.scene.add(this.lights.directional);
        
        // Point lights for atmospheric lighting
        this.lights.points = [];
        for (let i = 0; i < 8; i++) {
            const light = new THREE.PointLight(
                Math.random() > 0.5 ? 0xff0000 : 0x00ffff,
                2.0,
                30,
                2 // decay
            );
            light.position.set(
                (Math.random() - 0.5) * 80,
                Math.random() * 20 + 5,
                (Math.random() - 0.5) * 80
            );
            light.castShadow = true;
            light.shadow.mapSize.width = 512;
            light.shadow.mapSize.height = 512;
            this.scene.add(light);
            this.lights.points.push(light);
        }
        
        // Store original settings for corruption effects
        this.originalLightSettings = {
            ambient: { color: this.lights.ambient.color.clone(), intensity: this.lights.ambient.intensity },
            hemisphere: { 
                skyColor: this.lights.hemisphere.color.clone(), 
                groundColor: this.lights.hemisphere.groundColor.clone(),
                intensity: this.lights.hemisphere.intensity 
            },
            directional: { color: this.lights.directional.color.clone(), intensity: this.lights.directional.intensity },
            points: this.lights.points.map(light => ({
                color: light.color.clone(),
                intensity: light.intensity
            }))
        };
    }
    
    applyCorruptionLighting(corruptionLevel) {
        const corruption = corruptionLevel / 100;
        
        // Corruption color shift
        const corruptionColor = new THREE.Color().lerpColors(
            new THREE.Color(0x00ff00),
            new THREE.Color(0xff0000),
            corruption
        );
        
        // Flicker effect
        const flickerIntensity = 1 + Math.sin(Date.now() * 0.01) * corruption * 0.3;
        
        // Apply to ambient light
        this.lights.ambient.color.lerpColors(
            this.originalLightSettings.ambient.color,
            corruptionColor,
            corruption * 0.5
        );
        this.lights.ambient.intensity = this.originalLightSettings.ambient.intensity * flickerIntensity;
        
        // Apply to hemisphere light
        this.lights.hemisphere.color.lerpColors(
            this.originalLightSettings.hemisphere.skyColor,
            corruptionColor,
            corruption * 0.3
        );
        this.lights.hemisphere.intensity = this.originalLightSettings.hemisphere.intensity * flickerIntensity;
        
        // Apply to directional light
        this.lights.directional.color.lerpColors(
            this.originalLightSettings.directional.color,
            corruptionColor,
            corruption * 0.2
        );
        this.lights.directional.intensity = this.originalLightSettings.directional.intensity * flickerIntensity;
        
        // Apply to point lights with random flicker
        this.lights.points.forEach((light, index) => {
            const originalSettings = this.originalLightSettings.points[index];
            const randomFlicker = 1 + Math.sin(Date.now() * 0.01 + index) * corruption * 0.5;
            
            light.color.lerpColors(
                originalSettings.color,
                corruptionColor,
                corruption * 0.7
            );
            light.intensity = originalSettings.intensity * randomFlicker;
        });
    }
    
    createTeamBases() {
        // SpongeBob team base (blue/yellow) - positioned at one end of map
        const spongeBobPosition = new THREE.Vector3(-50, 0, 0);
        this.teamBases.alpha.position = spongeBobPosition;
        
        /* @tweakable team base ground height detection with safe fallback */
        let spongeBobGroundHeight = this.getGroundHeight(spongeBobPosition);
        /* @tweakable minimum base height to ensure accessibility */
        const minimumBaseHeight = 8.0; // Increased from 1 to ensure bases are always accessible
        if (spongeBobGroundHeight < minimumBaseHeight) {
            spongeBobGroundHeight = minimumBaseHeight;
        }
        
        /* @tweakable team base elevation offset for guaranteed visibility */
        const baseHeightOffset = 2.0; // Reduced since we're ensuring minimum height
        
        // Base platform
        /* @tweakable team base platform size for easier access */
        const basePlatformRadius = 12; // Increased for better accessibility
        const basePlatformHeight = 1.5; // Increased for better visibility
        const spongeBobBaseGeometry = new THREE.CylinderGeometry(basePlatformRadius, basePlatformRadius, basePlatformHeight, 16);
        const spongeBobBaseMaterial = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x004466,
            /* @tweakable team base glow intensity for better visibility */
            emissiveIntensity: 1.2, // Increased for better visibility
            transparent: true,
            opacity: 0.9
        });
        
        const spongeBobBase = new THREE.Mesh(spongeBobBaseGeometry, spongeBobBaseMaterial);
        spongeBobBase.position.set(spongeBobPosition.x, spongeBobGroundHeight + baseHeightOffset, spongeBobPosition.z);
        spongeBobBase.userData = { type: 'team_base', team: 'alpha' };
        this.scene.add(spongeBobBase);
        this.teamBases.alpha.zone = spongeBobBase;
        
        // Update team base position to match the actual base position
        this.teamBases.alpha.position.copy(spongeBobBase.position);
        
        // SpongeBob base light
        /* @tweakable team base lighting for enhanced visibility */
        const baseLightIntensity = 8.0; // Increased from 5.0
        const baseLightDistance = 35; // Increased from 25
        const spongeBobLight = new THREE.SpotLight(0x00aaff, baseLightIntensity, baseLightDistance, Math.PI / 4, 0.3, 1.5);
        spongeBobLight.position.set(spongeBobPosition.x, spongeBobGroundHeight + baseHeightOffset + 20, spongeBobPosition.z);
        spongeBobLight.target.position.copy(spongeBobBase.position);
        spongeBobLight.castShadow = true;
        this.scene.add(spongeBobLight);
        this.scene.add(spongeBobLight.target);
        
        // Squidward team base (orange/red) - positioned at opposite end of map
        const squidwardPosition = new THREE.Vector3(50, 0, 0);
        this.teamBases.beta.position = squidwardPosition;
        
        /* @tweakable team base ground height detection with safe fallback */
        let squidwardGroundHeight = this.getGroundHeight(squidwardPosition);
        if (squidwardGroundHeight < minimumBaseHeight) {
            squidwardGroundHeight = minimumBaseHeight;
        }
        
        // Base platform
        const squidwardBaseGeometry = new THREE.CylinderGeometry(basePlatformRadius, basePlatformRadius, basePlatformHeight, 16);
        const squidwardBaseMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            metalness: 0.8,
            roughness: 0.2,
            emissive: 0x664400,
            /* @tweakable team base glow intensity for better visibility */
            emissiveIntensity: 1.2, // Increased for better visibility
            transparent: true,
            opacity: 0.9
        });
        
        const squidwardBase = new THREE.Mesh(squidwardBaseGeometry, squidwardBaseMaterial);
        squidwardBase.position.set(squidwardPosition.x, squidwardGroundHeight + baseHeightOffset, squidwardPosition.z);
        squidwardBase.userData = { type: 'team_base', team: 'beta' };
        this.scene.add(squidwardBase);
        this.teamBases.beta.zone = squidwardBase;
        
        // Update team base position to match the actual base position
        this.teamBases.beta.position.copy(squidwardBase.position);
        
        // Squidward base light
        const squidwardLight = new THREE.SpotLight(0xff6600, baseLightIntensity, baseLightDistance, Math.PI / 4, 0.3, 1.5);
        squidwardLight.position.set(squidwardPosition.x, squidwardGroundHeight + baseHeightOffset + 20, squidwardPosition.z);
        squidwardLight.target.position.copy(squidwardBase.position);
        squidwardLight.castShadow = true;
        this.scene.add(squidwardLight);
        this.scene.add(squidwardLight.target);
        
        // Add base signage
        this.createBaseSignage();
        
        /* @tweakable team base accessibility for guaranteed access */
        this.createBaseAccessibility();
        
        console.log(`Alpha base positioned at: ${this.teamBases.alpha.position.x}, ${this.teamBases.alpha.position.y}, ${this.teamBases.alpha.position.z}`);
        console.log(`Beta base positioned at: ${this.teamBases.beta.position.x}, ${this.teamBases.beta.position.y}, ${this.teamBases.beta.position.z}`);
    }
    
    createBaseAccessibility() {
        // Create larger platforms to ensure bases are accessible
        /* @tweakable accessibility platform size for guaranteed team base access */
        const platformSize = 30; // Increased from 25
        /* @tweakable accessibility platform height for easier climbing */
        const platformHeight = 3.0; // Increased from 2.0
        const rampGeometry = new THREE.BoxGeometry(platformSize, platformHeight, platformSize);
        const rampMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666, // More visible gray
            metalness: 0.3,
            roughness: 0.7,
            transparent: true,
            opacity: 0.8,
            /* @tweakable accessibility platform glow for better visibility */
            emissive: 0x222222,
            emissiveIntensity: 0.3
        });
        
        // Alpha team accessibility platform
        const alphaRamp = new THREE.Mesh(rampGeometry, rampMaterial);
        /* @tweakable alpha team platform positioning for guaranteed access */
        const alphaGroundHeight = Math.max(8, this.getGroundHeight(this.teamBases.alpha.position)); // Increased minimum
        alphaRamp.position.set(
            this.teamBases.alpha.position.x, 
            alphaGroundHeight + platformHeight / 2, 
            this.teamBases.alpha.position.z
        );
        this.scene.add(alphaRamp);
        this.collisionMeshes.push(alphaRamp);
        
        // Beta team accessibility platform
        const betaRamp = new THREE.Mesh(rampGeometry, rampMaterial.clone());
        /* @tweakable beta team platform positioning for guaranteed access */
        const betaGroundHeight = Math.max(8, this.getGroundHeight(this.teamBases.beta.position)); // Increased minimum
        betaRamp.position.set(
            this.teamBases.beta.position.x, 
            betaGroundHeight + platformHeight / 2, 
            this.teamBases.beta.position.z
        );
        this.scene.add(betaRamp);
        this.collisionMeshes.push(betaRamp);
    }
    
    createBaseSignage() {
        // SpongeBob base sign
        const spongeBobSignGeometry = new THREE.PlaneGeometry(6, 3);
        const spongeBobSignMaterial = new THREE.MeshStandardMaterial({
            color: 0x00aaff,
            emissive: 0x004466,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9
        });
        
        const spongeBobSign = new THREE.Mesh(spongeBobSignGeometry, spongeBobSignMaterial);
        const spongeBobPos = this.teamBases.alpha.position;
        /* @tweakable team base signage positioning relative to ground height */
        spongeBobSign.position.set(spongeBobPos.x, spongeBobPos.y + 4, spongeBobPos.z + 8);
        this.scene.add(spongeBobSign);
        
        // Squidward base sign
        const squidwardSignGeometry = new THREE.PlaneGeometry(6, 3);
        const squidwardSignMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6600,
            emissive: 0x664400,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.9
        });
        
        const squidwardSign = new THREE.Mesh(squidwardSignGeometry, squidwardSignMaterial);
        const squidwardPos = this.teamBases.beta.position;
        /* @tweakable team base signage positioning relative to ground height */
        squidwardSign.position.set(squidwardPos.x, squidwardPos.y + 4, squidwardPos.z - 8);
        this.scene.add(squidwardSign);
    }
    
    checkBaseZone(position, team) {
        const basePosition = this.teamBases[team].position;
        const distance = position.distanceTo(basePosition);
        /* @tweakable team base capture radius for easier scoring */
        const baseRadius = 15; // Increased from 12 for easier access
        return distance < baseRadius;
    }
    
    checkEnemyBaseZone(position, team) {
        const enemyTeam = team === 'alpha' ? 'beta' : 'alpha';
        const basePosition = this.teamBases[enemyTeam].position;
        const distance = position.distanceTo(basePosition);
        /* @tweakable enemy base capture radius for easier scoring */
        const baseRadius = 15; // Increased from 12 for easier access
        return distance < baseRadius;
    }
    
    createGlitchVents() {
        /* @tweakable number of glitch vents for teleportation */
        const ventCount = 4;
        const ventPositions = [
            { x: 20, y: 2, z: 20 },
            { x: -20, y: 2, z: -20 },
            { x: 20, y: 2, z: -20 },
            { x: -20, y: 2, z: 20 }
        ];
        
        ventPositions.forEach((pos, index) => {
            const ventGeometry = new THREE.CylinderGeometry(2, 2, 0.5, 8);
            const ventMaterial = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                metalness: 0.8,
                roughness: 0.2,
                transparent: true,
                opacity: 0.7,
                emissive: 0x004444,
                emissiveIntensity: 0.3
            });
            
            const vent = new THREE.Mesh(ventGeometry, ventMaterial);
            vent.position.set(pos.x, pos.y, pos.z);
            vent.userData = { 
                type: 'glitch_vent',
                id: index,
                active: false,
                cooldown: 0
            };
            
            this.scene.add(vent);
            this.glitchVents.push(vent);
        });
    }
    
    createCorruptionPools() {
        /* @tweakable number of corruption pools for buffs */
        const poolCount = 3;
        const poolPositions = [
            { x: 0, y: 1, z: 20 },
            { x: 15, y: 1, z: 0 },
            { x: -15, y: 1, z: 0 }
        ];
        
        poolPositions.forEach((pos, index) => {
            const poolGeometry = new THREE.CylinderGeometry(3, 3, 0.2, 16);
            const poolMaterial = new THREE.MeshStandardMaterial({
                color: 0xff00ff,
                metalness: 0.1,
                roughness: 0.9,
                transparent: true,
                opacity: 0.6,
                emissive: 0x440044,
                emissiveIntensity: 0.4
            });
            
            const pool = new THREE.Mesh(poolGeometry, poolMaterial);
            pool.position.set(pos.x, pos.y, pos.z);
            pool.userData = { 
                type: 'corruption_pool',
                id: index,
                buffType: ['invisibility', 'fast_reload', 'damage_boost'][index % 3],
                cooldown: 0
            };
            
            this.scene.add(pool);
            this.corruptionPools.push(pool);
        });
    }
    
    checkGlitchVentInteraction(position, playerId) {
        for (let vent of this.glitchVents) {
            const distance = position.distanceTo(vent.position);
            if (distance < 3 && vent.userData.cooldown <= 0) {
                return {
                    type: 'glitch_vent',
                    vent: vent,
                    available: true
                };
            }
        }
        return null;
    }
    
    checkCorruptionPoolInteraction(position) {
        for (let pool of this.corruptionPools) {
            const distance = position.distanceTo(pool.position);
            if (distance < 4 && pool.userData.cooldown <= 0) {
                return {
                    type: 'corruption_pool',
                    pool: pool,
                    buffType: pool.userData.buffType,
                    available: true
                };
            }
        }
        return null;
    }
    
    activateGlitchVent(vent, playerId) {
        // Find another vent to teleport to
        const otherVents = this.glitchVents.filter(v => v !== vent && v.userData.cooldown <= 0);
        if (otherVents.length === 0) return null;
        
        const targetVent = otherVents[Math.floor(Math.random() * otherVents.length)];
        
        // Set cooldowns
        /* @tweakable glitch vent cooldown duration in seconds */
        const ventCooldown = 30;
        vent.userData.cooldown = ventCooldown;
        targetVent.userData.cooldown = ventCooldown;
        
        return {
            teleportPosition: targetVent.position.clone().add(new THREE.Vector3(0, 2, 0))
        };
    }
    
    activateCorruptionPool(pool) {
        /* @tweakable corruption pool cooldown duration in seconds */
        const poolCooldown = 45;
        pool.userData.cooldown = poolCooldown;
        
        return {
            buffType: pool.userData.buffType,
            /* @tweakable corruption pool buff duration in seconds */
            duration: 15
        };
    }
    
    updateCooldowns(deltaTime) {
        this.glitchVents.forEach(vent => {
            if (vent.userData.cooldown > 0) {
                vent.userData.cooldown -= deltaTime;
                // Visual feedback for cooldown
                vent.material.emissiveIntensity = vent.userData.cooldown > 0 ? 0.1 : 0.3;
            }
        });
        
        this.corruptionPools.forEach(pool => {
            if (pool.userData.cooldown > 0) {
                pool.userData.cooldown -= deltaTime;
                // Visual feedback for cooldown
                pool.material.emissiveIntensity = pool.userData.cooldown > 0 ? 0.1 : 0.4;
            }
        });
    }
}