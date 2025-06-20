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
            if (this.gameCore.fragmentManager && roomState.fragments) { // Ensure fragmentManager exists
                this.gameCore.fragmentManager.updateFragmentsFromNetwork(roomState.fragments);
            }

            // Handle Overheat Mode state change from network
            if (roomState.isOverheatModeActive !== undefined &&
                this.gameCore.gameState.isOverheatModeActive !== roomState.isOverheatModeActive) {
                this.gameCore.gameState.isOverheatModeActive = roomState.isOverheatModeActive;
                if (this.gameCore.effectsManager) { // Ensure effectsManager exists
                    if (this.gameCore.gameState.isOverheatModeActive) {
                        this.gameCore.effectsManager.startOverheatVisualGlitches();
                    } else {
                        this.gameCore.effectsManager.stopOverheatVisualGlitches();
                    }
                }
            }
            this.updateGameState(); // General game state like scores, corruption
        });
        
        this.room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        this.room.onmessage = (event) => {
            this.handleRoomMessage(event.data);
        };
    }
    
    send(data) {
        if (this.room && this.room.readyState === WebSocket.OPEN) { // Ensure socket is open
            this.room.send(data);
        } else {
            console.warn("Attempted to send data, but WebSocket is not open.", data);
        }
    }

    // Send generic message to the room
    sendMessage(type, payload) {
        this.send({ type, ...payload });
    }

    // Specifically for lobby player status updates
    sendLobbyPlayerUpdate(playerData) {
        this.sendMessage('lobby_player_update', { playerData });
    }

    // Specifically for lobby chat messages
    sendLobbyChatMessage(message) {
        // The sender's name/ID should be available in this.room.clientId or a username property
        // For WebsimSocket, clientId is usually available.
        // If a display name is set, prefer that.
        const playerName = (this.room && this.room.presence[this.room.clientId]?.username) || this.room.clientId || 'UnknownPlayer';
        this.sendMessage('lobby_chat_message', { message, playerName });
    }

    sendChaosVote(votedPlayerId) {
        if (this.room && this.room.clientId) { // Ensure clientId is available
            this.send({
                type: 'chaos_vote_cast',
                voterPlayerId: this.room.clientId,
                votedPlayerId: votedPlayerId
            });
        } else {
            console.warn("Cannot send chaos vote, room or clientId not available.");
        }
    }

    sendChaosInfluencerDetermined(influencerId) {
        if (this.room) {
            this.send({
                type: 'chaos_influencer_determined',
                influencerId: influencerId
            });
        }  else {
            console.warn("Cannot send chaos influencer determined, room not available.");
        }
    }

    sendFragmentPingAlert(carrierId, position) {
        if (this.room) {
            this.send({
                type: 'fragment_ping_alert',
                carrierId: carrierId,
                position: position // Ensure position is in a serializable format e.g. [x,y,z]
            });
        }
    }

    sendOverheatEffect(effectData) {
        if (this.room) {
            // The type of effect (e.g., 'explosion', 'hallucination') is part of effectData.effectType
            this.send({ type: 'overheat_effect', ...effectData });
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

    updateRoomStateFragment(fragmentId, fragmentData) {
        if (!this.room) return;

        if (!this.room.roomState.fragments) {
            this.room.roomState.fragments = {};
        }
        // Ensure we send the whole fragmentData object as received from FragmentManager
        this.room.roomState.fragments[fragmentId] = fragmentData;

        this.updateRoomState({ fragments: this.room.roomState.fragments });
    }
    
    handleRoomMessage(data) {
        switch (data.type) {
            case 'connected':
                this.gameCore.uiManager.addKillFeedEntry(`${data.username} joined the simulation`);
                break;
            case 'disconnected':
                this.gameCore.uiManager.addKillFeedEntry(`${data.username} disconnected`);
                // If a disconnected player was the fragment carrier, GameCore/FragmentManager should handle fragment reset.
                if (this.gameCore.fragmentManager && this.gameCore.fragmentManager.getFragmentState('center_fragment')?.carrierId === data.clientId) {
                    // This logic might be better handled by the authoritative client noticing the presence drop.
                    // For now, each client can react to make the fragment available sooner.
                    console.log(`Fragment carrier ${data.username} disconnected. Authority should reset fragment.`);
                    // Potentially, the authoritative client would detect this via presence and update roomState.
                }
                if (this.gameCore.lobbyManager) { // Also inform lobby manager if in lobby state
                    this.gameCore.lobbyManager.handlePlayerDisconnect(data.clientId);
                }
                break;
            case 'player_shot':
                // This is a remote player's shot. We need to draw the trail.
                if (data.playerId !== this.room.clientId && this.gameCore.effectsManager && this.gameCore.audioManager) {
                    const startPos = new THREE.Vector3().fromArray(data.startPos);
                    const endPos = new THREE.Vector3().fromArray(data.endPos);
                    this.gameCore.effectsManager.createProjectileTrail(startPos, endPos);
                    // Play sound based on weapon type if available in data, else generic distant shot
                    const soundToPlay = data.weapon === 'scout' ? 'silenced_shot_distant' : 'distant_shot';
                    this.gameCore.audioManager.playSound(soundToPlay, startPos);
                }
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
            // Lobby related messages
            case 'lobby_player_update':
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.handlePlayerUpdate(data.playerData);
                }
                break;
            case 'lobby_chat_message':
                if (this.gameCore.uiManager) {
                    // Ensure UIManager's addChatMessage can handle this structure
                    // data might be { type: "lobby_chat_message", message: "Hello", playerName: "SpongeBob" }
                    this.gameCore.uiManager.addChatMessage(data.playerName, data.message);
                }
                break;
            case 'chaos_vote_cast':
                if (this.gameCore.lobbyManager && data.voterPlayerId && data.votedPlayerId) {
                    this.gameCore.lobbyManager.handleChaosVote(data.voterPlayerId, data.votedPlayerId);
                }
                break;
            case 'chaos_influencer_determined':
                if (this.gameCore.lobbyManager && data.influencerId) {
                    this.gameCore.lobbyManager.setChaosInfluencer(data.influencerId);
                }
                break;
            case 'fragment_ping_alert':
                if (this.gameCore.effectsManager && this.gameCore.audioManager && this.room) {
                    this.gameCore.effectsManager.triggerFragmentPingEffect(data.position, data.carrierId === this.room.clientId);
                    this.gameCore.audioManager.playSound('fragment_ping');
                }
                break;
            case 'overheat_effect':
                if (this.gameCore.effectsManager && this.gameCore.audioManager) {
                    // data.effectType was specified in GameCore when sending
                    if (data.effectType === 'explosion' && data.position) {
                        this.gameCore.effectsManager.triggerRandomExplosion(data.position);
                        this.gameCore.audioManager.playSound('random_explosion', data.position);
                    } else if (data.effectType === 'hallucination' && data.position && data.enemyType) {
                        this.gameCore.effectsManager.spawnHallucinatedEnemy(data.position, data.enemyType);
                        this.gameCore.audioManager.playSound('hallucination_spawn', data.position);
                    }
                }
                break;
            default:
                console.log('Unhandled room message:', data);
        }
    }
    
    // handleRemoteShot is effectively replaced by the 'player_shot' case above for trails.
    // Muzzle flash for remote players could be added here if 'player_shot' included a weapon muzzle point.
    // For now, only local player sees their own muzzle flash.
    
    handleRemoteFragmentCollection(data) { // This message type might be deprecated if relying purely on roomState.
                                        // For now, it can provide immediate UI feedback.
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
            // updateRequest might contain: { type: 'damage', amount: damageAmount, weapon: this.player.weaponType, attackerId: this.player.getPlayerId() }
            const isDead = this.gameCore.player.takeDamage(
                updateRequest.amount,
                updateRequest.weapon,
                updateRequest.attackerId || fromClientId // Use attackerId if provided, else fallback to sender
            );
            // Player.takeDamage now handles screen flash and audio via gameCore.
            // It also calls gameCore.handlePlayerDeath if health <= 0.
            // UI and presence updates are also handled within Player.takeDamage or GameCore.handlePlayerDeath.

            // No, Player.takeDamage should update its own health and call GameCore.handlePlayerDeath.
            // GameCore.handlePlayerDeath should then call NetworkManager.updatePresence().
            // The call to updateHealthDisplay is good here for immediate feedback.
            this.gameCore.uiManager.updateHealthDisplay();
            
            // Hit feedback effect is now part of Player.takeDamage via addScreenFlash
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