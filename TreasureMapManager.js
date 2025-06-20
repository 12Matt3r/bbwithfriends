import * as THREE from 'three';

export class TreasureMapManager {
    constructor(scene, networkManager) {
        this.scene = scene;
        this.networkManager = networkManager;
        this.bulletinBoards = [];
        this.treasureMap = null;
        this.hiddenDoorway = null;
        this.remembranceTriggered = false;
        this.mapHolder = null;
        this.mapHolderTeam = null;
    }
    
    initialize() {
        this.createBulletinBoards();
        this.createHiddenDoorway();
        this.spawnTreasureMap();
    }
    
    createBulletinBoards() {
        // SpongeBob team bulletin board
        const spongeBobBoardGeometry = new THREE.BoxGeometry(3, 4, 0.2);
        const spongeBobBoardMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.1,
            roughness: 0.8,
            /* @tweakable SpongeBob bulletin board color */
            map: this.createBulletinTexture(0x00aaff)
        });
        
        const spongeBobBoard = new THREE.Mesh(spongeBobBoardGeometry, spongeBobBoardMaterial);
        spongeBobBoard.position.set(-25, 2, -25);
        spongeBobBoard.userData = { type: 'bulletin_board', team: 'alpha' };
        this.scene.add(spongeBobBoard);
        this.bulletinBoards.push(spongeBobBoard);
        
        // Squidward team bulletin board
        const squidwardBoardGeometry = new THREE.BoxGeometry(3, 4, 0.2);
        const squidwardBoardMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.1,
            roughness: 0.8,
            /* @tweakable Squidward bulletin board color */
            map: this.createBulletinTexture(0xff6600)
        });
        
        const squidwardBoard = new THREE.Mesh(squidwardBoardGeometry, squidwardBoardMaterial);
        squidwardBoard.position.set(25, 2, 25);
        squidwardBoard.userData = { type: 'bulletin_board', team: 'beta' };
        this.scene.add(squidwardBoard);
        this.bulletinBoards.push(squidwardBoard);
    }
    
    createBulletinTexture(teamColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#2a1810';
        ctx.fillRect(0, 0, 512, 512);
        
        // Border
        ctx.strokeStyle = `#${teamColor.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 10;
        ctx.strokeRect(20, 20, 472, 472);
        
        // Text
        ctx.fillStyle = `#${teamColor.toString(16).padStart(6, '0')}`;
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PLANKTON\'S', 256, 100);
        ctx.fillText('MAP', 256, 160);
        
        // Map placeholder
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(100, 200, 312, 200);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px monospace';
        ctx.fillText('SECRET LOCATION', 256, 320);
        ctx.fillText('MAP', 256, 350);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    createHiddenDoorway() {
        // Create doorway at a neutral location
        const doorwayGeometry = new THREE.BoxGeometry(2, 3, 0.5);
        const doorwayMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8,
            roughness: 0.2,
            transparent: true,
            opacity: 0.3,
            emissive: 0x222222,
            emissiveIntensity: 0.1
        });
        
        this.hiddenDoorway = new THREE.Mesh(doorwayGeometry, doorwayMaterial);
        this.hiddenDoorway.position.set(0, 1.5, 40); // Hidden location
        this.hiddenDoorway.userData = { 
            type: 'hidden_doorway',
            active: false,
            used: false
        };
        this.scene.add(this.hiddenDoorway);
        
        // Add mystical effect around doorway
        const effectGeometry = new THREE.RingGeometry(2, 3, 8);
        const effectMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
        });
        
        const effect = new THREE.Mesh(effectGeometry, effectMaterial);
        effect.position.copy(this.hiddenDoorway.position);
        effect.rotationX = Math.PI / 2;
        this.scene.add(effect);
        
        // Animate the effect
        const animate = () => {
            if (this.hiddenDoorway.userData.active) {
                effect.rotation.z += 0.02;
                effect.material.opacity = 0.2 + Math.sin(Date.now() * 0.005) * 0.1;
            }
            requestAnimationFrame(animate);
        };
        animate();
    }
    
    spawnTreasureMap() {
        // Random bulletin board gets the treasure map
        const randomBoard = this.bulletinBoards[Math.floor(Math.random() * this.bulletinBoards.length)];
        
        const mapGeometry = new THREE.PlaneGeometry(1, 0.7);
        const mapMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffaa,
            metalness: 0.1,
            roughness: 0.9,
            transparent: true,
            opacity: 0.9,
            map: this.createTreasureMapTexture()
        });
        
        this.treasureMap = new THREE.Mesh(mapGeometry, mapMaterial);
        this.treasureMap.position.copy(randomBoard.position);
        this.treasureMap.position.z += 0.2; // Slightly in front of board
        this.treasureMap.userData = { 
            type: 'treasure_map',
            available: true,
            boardTeam: randomBoard.userData.team
        };
        this.scene.add(this.treasureMap);
        
        // Sync with network
        this.networkManager.updateRoomState({
            treasureMap: {
                position: this.treasureMap.position.toArray(),
                available: true,
                boardTeam: randomBoard.userData.team
            }
        });
    }
    
    createTreasureMapTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Aged paper background
        ctx.fillStyle = '#f4e4bc';
        ctx.fillRect(0, 0, 256, 256);
        
        // Add aging stains
        ctx.fillStyle = 'rgba(139, 69, 19, 0.1)';
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.arc(Math.random() * 256, Math.random() * 256, Math.random() * 20, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Draw simple map
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(50, 50);
        ctx.lineTo(200, 100);
        ctx.lineTo(150, 200);
        ctx.stroke();
        
        // X marks the spot
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(120, 120);
        ctx.lineTo(140, 140);
        ctx.moveTo(140, 120);
        ctx.lineTo(120, 140);
        ctx.stroke();
        
        // Text
        ctx.fillStyle = '#8B4513';
        ctx.font = 'bold 16px serif';
        ctx.textAlign = 'center';
        ctx.fillText('HIDDEN', 130, 180);
        ctx.fillText('DOORWAY', 130, 200);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    checkInteractions(playerPosition, playerId, playerTeam) {
        // Check treasure map pickup
        if (this.treasureMap && this.treasureMap.userData.available) {
            const distance = playerPosition.distanceTo(this.treasureMap.position);
            if (distance < 3) {
                return {
                    type: 'treasure_map_pickup',
                    available: true
                };
            }
        }
        
        // Check hidden doorway interaction
        if (this.hiddenDoorway && this.mapHolder === playerId && this.mapHolderTeam === playerTeam) {
            const distance = playerPosition.distanceTo(this.hiddenDoorway.position);
            if (distance < 2 && this.hiddenDoorway.userData.active && !this.hiddenDoorway.userData.used) {
                return {
                    type: 'hidden_doorway',
                    available: true
                };
            }
        }
        
        return null;
    }
    
    pickupTreasureMap(playerId, playerTeam) {
        if (!this.treasureMap || !this.treasureMap.userData.available) {
            return false;
        }
        
        this.treasureMap.userData.available = false;
        this.scene.remove(this.treasureMap);
        
        this.mapHolder = playerId;
        this.mapHolderTeam = playerTeam;
        this.hiddenDoorway.userData.active = true;
        
        // Network sync
        this.networkManager.send({
            type: 'treasure_map_picked_up',
            playerId: playerId,
            playerTeam: playerTeam
        });
        
        this.networkManager.updateRoomState({
            treasureMap: {
                available: false,
                holder: playerId,
                holderTeam: playerTeam
            },
            hiddenDoorway: {
                active: true
            }
        });
        
        return true;
    }
    
    activateRemembranceEvent(playerId, playerTeam) {
        if (this.remembranceTriggered || !this.hiddenDoorway.userData.active || this.hiddenDoorway.userData.used) {
            return false;
        }
        
        if (this.mapHolder !== playerId || this.mapHolderTeam !== playerTeam) {
            return false; // Wrong team or player
        }
        
        this.remembranceTriggered = true;
        this.hiddenDoorway.userData.used = true;
        this.hiddenDoorway.userData.active = false;
        
        // Network sync
        this.networkManager.send({
            type: 'remembrance_triggered',
            triggerTeam: playerTeam,
            triggerPlayer: playerId
        });
        
        this.networkManager.updateRoomState({
            remembranceTriggered: true,
            triggerTeam: playerTeam
        });
        
        return true;
    }
    
    handleNetworkEvent(data) {
        switch (data.type) {
            case 'treasure_map_picked_up':
                if (data.playerId !== this.networkManager.room.clientId) {
                    this.treasureMap.userData.available = false;
                    this.scene.remove(this.treasureMap);
                    this.mapHolder = data.playerId;
                    this.mapHolderTeam = data.playerTeam;
                    this.hiddenDoorway.userData.active = true;
                }
                break;
                
            case 'remembrance_triggered':
                if (data.triggerPlayer !== this.networkManager.room.clientId) {
                    this.remembranceTriggered = true;
                    this.hiddenDoorway.userData.used = true;
                    this.hiddenDoorway.userData.active = false;
                }
                break;
        }
    }
    
    isRemembranceActive() {
        return this.remembranceTriggered;
    }
    
    getMapHolderTeam() {
        return this.mapHolderTeam;
    }
}