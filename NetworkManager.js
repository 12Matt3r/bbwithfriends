export class NetworkManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.room = null;
    }
    
    async initialize() {
        this.room = new WebsimSocket();
        await this.room.initialize();
        
        this.room.subscribePresence(() => {
            this.gameCore.uiManager.updatePlayerList();
            this.updateGameState();
        });
        
        this.room.subscribeRoomState(() => {
            const roomState = this.room.roomState || {};
            this.gameCore.fragmentManager.updateFragments(roomState.fragments || {});
            this.updateGameState();
        });
        
        this.room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        this.room.onmessage = (event) => {
            this.handleRoomMessage(event.data);
        };
    }
    
    send(data) {
        if (this.room) {
            this.room.send(data);
        }
    }
    
    updatePresence(data) {
        if (this.room) {
            // Add weapon state to presence data for multiplayer visibility
            const enhancedData = {
                ...data,
                /* @tweakable weapon state sync for multiplayer visibility */
                weaponState: {
                    ammo: this.gameCore.player.ammo,
                    isReloading: this.gameCore.gameState.isReloading,
                    lastShotTime: this.gameCore.player.lastShotTime || 0
                }
            };
            this.room.updatePresence(enhancedData);
        }
    }
    
    updateRoomState(data) {
        if (this.room) {
            this.room.updateRoomState(data);
        }
    }
    
    handleRoomMessage(data) {
        switch (data.type) {
            case 'connected':
                this.gameCore.uiManager.addKillFeedEntry(`${data.username} joined the simulation`);
                break;
            case 'disconnected':
                this.gameCore.uiManager.addKillFeedEntry(`${data.username} disconnected`);
                break;
            case 'player_shot':
                this.handleRemoteShot(data);
                break;
            case 'fragment_collected':
                this.handleRemoteFragmentCollection(data);
                break;
            case 'fragment_dropped':
                this.handleRemoteFragmentDrop(data);
                break;
            case 'fragment_delivered':
                this.handleRemoteFragmentDelivery(data);
                break;
            case 'distort_effect':
                this.handleDistortEffect(data);
                break;
            case 'signal_jam':
                this.handleSignalJam(data);
                break;
            case 'treasure_map_picked_up':
                this.handleTreasureMapPickup(data);
                break;
            case 'remembrance_triggered':
                this.handleRemembranceTriggered(data);
                break;
            default:
                console.log('Unhandled room message:', data);
        }
    }
    
    handleRemoteShot(data) {
        if (data.playerId !== this.room.clientId) {
            this.gameCore.audioManager.playSound('distant_shot');
            
            // Create visual effect for remote player shots
            if (data.position && data.direction) {
                /* @tweakable remote shot effect visibility duration */
                const effectDuration = 200;
                this.gameCore.effectsManager.createRemoteShotEffect(
                    new THREE.Vector3(...data.position),
                    new THREE.Vector3(...data.direction),
                    effectDuration
                );
            }
        }
    }
    
    handleRemoteFragmentCollection(data) {
        if (data.playerId !== this.room.clientId) {
            this.gameCore.uiManager.addKillFeedEntry(`${this.room.peers[data.playerId]?.username || 'Unknown'} collected the memory fragment`);
            
            // Remove fragment from scene for other players
            this.gameCore.fragmentManager.removeFragment('center_fragment');
        }
    }
    
    handleRemoteFragmentDrop(data) {
        if (data.playerId !== this.room.clientId) {
            this.gameCore.uiManager.addKillFeedEntry(`${this.room.peers[data.playerId]?.username || 'Unknown'} dropped the memory fragment`);
            
            // Spawn fragment at drop location
            const dropPosition = {
                x: data.position[0],
                y: data.position[1], 
                z: data.position[2]
            };
            this.gameCore.fragmentManager.createFragment('center_fragment', dropPosition);
        }
    }
    
    handleRemoteFragmentDelivery(data) {
        if (data.playerId !== this.room.clientId) {
            const username = this.room.peers[data.playerId]?.username || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} delivered a fragment for Team ${data.team.toUpperCase()}`);
            
            if (data.team === 'alpha') {
                this.gameCore.gameState.fragmentsAlpha++;
            } else {
                this.gameCore.gameState.fragmentsBeta++;
            }
            this.gameCore.uiManager.updateScoreDisplay();
        }
    }
    
    handleDistortEffect(data) {
        if (data.target === 'enemies' && this.isEnemyPlayer(data.source)) {
            document.getElementById('game-ui').classList.add('inverted');
            setTimeout(() => {
                document.getElementById('game-ui').classList.remove('inverted');
            }, data.duration || 5000);
        }
    }
    
    handleSignalJam(data) {
        if (data.source !== this.room.clientId) {
            document.getElementById('hud').style.opacity = '0.3';
            setTimeout(() => {
                document.getElementById('hud').style.opacity = '1';
            }, data.duration || 3000);
        }
    }
    
    handleTreasureMapPickup(data) {
        if (data.playerId !== this.room.clientId) {
            const username = this.room.peers[data.playerId]?.username || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} acquired the treasure map`);
            
            if (this.gameCore.treasureMapManager) {
                this.gameCore.treasureMapManager.handleNetworkEvent(data);
            }
        }
    }
    
    handleRemembranceTriggered(data) {
        if (data.triggerPlayer !== this.room.clientId) {
            const username = this.room.peers[data.triggerPlayer]?.username || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username}'s team triggered the Remembrance Event!`);
            
            if (this.gameCore.treasureMapManager) {
                this.gameCore.treasureMapManager.handleNetworkEvent(data);
            }
            
            // Activate remembrance UI effect
            this.gameCore.uiManager.activateRemembranceEffect(data.triggerTeam);
        }
    }
    
    handlePresenceUpdateRequest(updateRequest, fromClientId) {
        if (updateRequest.type === 'damage') {
            const isDead = this.gameCore.player.takeDamage(updateRequest.amount);
            this.gameCore.uiManager.updateHealthDisplay();
            
            // Add hit feedback effect
            /* @tweakable damage effect intensity for multiplayer feedback */
            const damageEffectIntensity = updateRequest.amount / 100;
            this.gameCore.effectsManager.addScreenFlash('#ff0000', 300 * damageEffectIntensity);
            
            if (isDead) {
                this.gameCore.handlePlayerDeath(fromClientId);
            }
            
            this.updatePresence(this.gameCore.player.getPresenceData());
        }
    }
    
    updateGameState() {
        const roomState = this.room.roomState;
        
        if (roomState) {
            if (roomState.globalCorruption !== undefined) {
                this.gameCore.gameState.corruptionLevel = roomState.globalCorruption;
                this.gameCore.uiManager.updateCorruptionDisplay();
            }
            
            if (roomState.scoreAlpha !== undefined) {
                this.gameCore.gameState.scoreAlpha = roomState.scoreAlpha;
                this.gameCore.uiManager.updateScoreDisplay();
            }
            
            if (roomState.scoreBeta !== undefined) {
                this.gameCore.gameState.scoreBeta = roomState.scoreBeta;
                this.gameCore.uiManager.updateScoreDisplay();
            }
        }
    }
    
    isEnemyPlayer(playerId) {
        const playerPresence = this.room.presence[playerId];
        return playerPresence && playerPresence.team !== this.gameCore.player.team;
    }
}