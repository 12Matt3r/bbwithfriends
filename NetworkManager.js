export class NetworkManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.room = null;
        this.messageSubscribers = {}; // For event-based subscriptions
    }

    // Getter for player ID
    getPlayerId() {
        return this.room ? this.room.clientId : null;
    }

    // Getter for username
    getUsername(playerId) {
        if (!this.room || !playerId) return null;
        // Prefer presence data as it might be more frequently updated with username
        if (this.room.presence && this.room.presence[playerId] && this.room.presence[playerId].username) {
            return this.room.presence[playerId].username;
        }
        // Fallback to peers data
        if (this.room.peers && this.room.peers[playerId] && this.room.peers[playerId].username) {
            return this.room.peers[playerId].username;
        }
        return 'Player ' + playerId.substring(0, 4); // Default if no username found
    }

    // Getter for connected peer IDs
    getConnectedPeersIds() {
        if (!this.room) return [];
        // Presence usually includes self, peers usually doesn't.
        // For "other players", peers is good. For "all active players in lobby", presence might be better.
        // Let's assume presence keys are the most comprehensive list of active entities.
        return this.room.presence ? Object.keys(this.room.presence) : [];
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

            // Handle Melt Phase state change from network
            if (roomState.isMeltPhaseActive !== undefined &&
                this.gameCore.gameState.isMeltPhaseActive !== roomState.isMeltPhaseActive) {

                this.gameCore.gameState.isMeltPhaseActive = roomState.isMeltPhaseActive;
                if (this.gameCore.gameState.isMeltPhaseActive) {
                    console.log("Network signalled: Entering Melt Phase.");
                    if (this.gameCore.uiManager) this.gameCore.uiManager.setMeltPhaseVisuals(true);
                    if (this.gameCore.audioManager) this.gameCore.audioManager.startMeltPhaseNarration();
                    // Optional: setTimeout(() => { this.gameCore.endGame("Corruption reached critical levels."); }, 30000);
                } else {
                    // This case might not be used if melt phase is game-ending and resets the game
                    console.log("Network signalled: Exiting Melt Phase (unlikely).");
                    if (this.gameCore.uiManager) this.gameCore.uiManager.setMeltPhaseVisuals(false);
                    if (this.gameCore.audioManager) this.gameCore.audioManager.stopMeltPhaseNarration(); // If it can be stopped
                }
            }

            this.updateGameState(); // General game state like scores, corruption
        });
        
        this.room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
            this.handlePresenceUpdateRequest(updateRequest, fromClientId);
        });
        
        this.room.onmessage = (event) => {
            //this.handleRoomMessage(event.data); // Old direct handler
            this.dispatchMessage(event.data); // New dispatch mechanism
        };
    }

    subscribe(eventName, callback) {
        if (!this.messageSubscribers[eventName]) {
            this.messageSubscribers[eventName] = [];
        }
        this.messageSubscribers[eventName].push(callback);
        console.log(`Subscribed to ${eventName}. Current subs:`, this.messageSubscribers[eventName].length);
    }

    unsubscribe(eventName, callback) {
        if (this.messageSubscribers[eventName]) {
            this.messageSubscribers[eventName] = this.messageSubscribers[eventName].filter(cb => cb !== callback);
        }
    }

    dispatchMessage(data) {
        const eventName = data.type;
        if (this.messageSubscribers[eventName]) {
            this.messageSubscribers[eventName].forEach(callback => {
                try {
                    callback(data); // Pass the whole data object
                } catch (error) {
                    console.error(`Error in callback for event ${eventName}:`, error);
                }
            });
        } else {
            // Fallback to old handler for messages not yet using subscription
            // console.log(`No direct subscribers for ${eventName}, using default handler if available.`);
            this.handleRoomMessageFallback(data);
        }
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
        this.sendMessage('lobby_player_update', { playerData }); // playerData is the payload itself
    }

    sendLobbyFullSyncRequest(playerData) {
        this.sendMessage('lobby_full_sync_request', { playerData }); // playerData is the local player's state
    }

    // Specifically for lobby chat messages
    sendLobbyChatMessage(message) {
        const playerId = this.getPlayerId();
        const playerName = this.getUsername(playerId) || 'UnknownPlayer';
        // Message structure for LobbyManager: { playerId, message }
        // Message structure for UIManager: { playerName, message }
        // Let's make NetworkManager send what LobbyManager expects,
        // and LobbyManager can prepare it for UIManager.
        this.sendMessage('lobby_chat_message', { playerId: playerId, message: message });
    }

    sendChaosVote(voterId, votedForId) { // voterId passed from LobbyManager
        this.sendMessage('chaos_vote_update', { voterId, votedForId });
    }

    sendPlayerEliminated(victimName, killerName, weaponUsed) {
        if (this.room) {
            this.sendMessage('player_eliminated', { victimName, killerName, weaponUsed });
        }
    }

    sendChaosInfluencerDetermined(influencerId) {
        this.sendMessage('chaos_influencer_determined', { influencerId });
    }

    sendFragmentPingAlert(carrierId, position) {
        this.sendMessage('fragment_ping_alert', { carrierId, position });
    }

    sendOverheatEffect(effectData) { // effectData contains its own .type (like 'explosion')
        this.sendMessage('overheat_effect', effectData);
    }

    sendConsoleCommand(commandName, args) {
        const playerId = this.getPlayerId();
        if (playerId) {
            this.sendMessage('console_command', { commandName, arguments: args, playerId });
        } else {
            console.warn("Cannot send console command, player ID not available.");
        }
    }

    sendSwapPlayersCommand(playerA_id, playerB_id) {
        this.sendMessage('execute_player_swap', { pA_id: playerA_id, pB_id: playerB_id });
    }

    sendGlitchGravityCommand(gravityVectorObj, durationSeconds) {
        this.sendMessage('execute_gravity_glitch', { gravity: gravityVectorObj, duration: durationSeconds });
    }

    sendRevealMapCommand(durationSeconds) {
        this.sendMessage('execute_reveal_map', { duration: durationSeconds });
    }

    sendAudienceCommand(commandName, args) {
        // Audience commands are sent from a client, but their 'source' is conceptual.
        // The actual instigatorPlayerId in ConsoleManager for audience commands will be "AUDIENCE".
        this.send({ type: 'audience_command', command: commandName, arguments: args, source: 'AUDIENCE' });
    }

    sendApplyPlayerEffectCommand(targetPlayerId, effectDetails) {
        this.send({ type: 'apply_player_effect', targetId: targetPlayerId, effect: effectDetails });
    }

    sendNewConfessionalLog(logEntry) {
        this.sendMessage('new_confessional_log', { log: logEntry });
    }
    
    updatePresence(data) {
        if (this.room) {
            // Add weapon state to presence data for multiplayer visibility
            const enhancedData = {
                ...data,
                /* @tweakable weapon state sync for multiplayer visibility */
                weaponState: {
                    ammo: this.gameCore.player.ammo,
                    isReloading: this.gameCore.player.isReloading, // player.isReloading instead of gameState
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

        let fragments = this.room.roomState.fragments || {};
        fragments[fragmentId] = fragmentData;

        this.updateRoomState({ fragments: fragments });
    }
    
    // This function will handle messages not caught by the new subscription system.
    // Gradually, messages should be migrated to use subscriptions.
    handleRoomMessageFallback(data) {
        switch (data.type) {
            case 'connected': // This could be a subscription too
                this.gameCore.uiManager.addKillFeedEntry(`${data.username || data.clientId} joined the simulation`);
                if (this.gameCore.lobbyManager) {
                     // Potentially notify lobby manager to send its state to the new player,
                     // or expect the new player to send a full_sync_request.
                     // this.gameCore.lobbyManager.sendFullStateToNewPlayer(data.clientId);
                }
                break;
            case 'disconnected': // This could be a subscription too
                this.gameCore.uiManager.addKillFeedEntry(`${data.username || data.clientId} disconnected`);
                if (this.gameCore.fragmentManager && this.gameCore.fragmentManager.getFragmentState('center_fragment')?.carrierId === data.clientId) {
                    console.log(`Fragment carrier ${data.username || data.clientId} disconnected. Authority should reset fragment.`);
                }
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.removePlayer(data.clientId); // Updated to call removePlayer
                }
                break;
            case 'player_shot':
                if (data.playerId !== this.getPlayerId() && this.gameCore.effectsManager && this.gameCore.audioManager) {
                    const startPos = new THREE.Vector3().fromArray(data.startPos);
                    const endPos = new THREE.Vector3().fromArray(data.endPos);
                    this.gameCore.effectsManager.createProjectileTrail(startPos, endPos);
                    const soundToPlay = data.weapon === 'scout' ? 'silenced_shot_distant' : 'distant_shot';
                    this.gameCore.audioManager.playSound(soundToPlay, startPos);
                }
                break;
            case 'fragment_collected': // These specific game events might also become subscriptions
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
            // Lobby related messages are now handled by subscriptions in LobbyManager.js
            // So they are removed from here to avoid double handling if LobbyManager is initialized.
            // If LobbyManager is NOT initialized, these messages would be 'unhandled' by this fallback.
            // This is generally fine as lobby messages only matter if the lobby system is active.

            // case 'lobby_player_update': // Handled by subscription
            // case 'lobby_chat_message':  // Handled by subscription
            // case 'chaos_vote_update': // Handled by subscription (was chaos_vote_cast)
            // case 'chaos_influencer_determined': // Handled by subscription
            // case 'lobby_full_sync_request': // Handled by subscription

            case 'console_command':
                if (this.gameCore.consoleManager && typeof this.gameCore.consoleManager.executeNetworkedCommand === 'function') {
                    this.gameCore.consoleManager.executeNetworkedCommand(data.commandName, data.arguments, data.playerId);
                } else {
                    console.error("ConsoleManager or executeNetworkedCommand not found for data:", data);
                }
                break;

            case 'execute_player_swap':
                if (this.gameCore.performPlayerSwap && typeof this.gameCore.performPlayerSwap === 'function') {
                    this.gameCore.performPlayerSwap(data.pA_id, data.pB_id);
                } else {
                    console.error("GameCore.performPlayerSwap not found for data:", data);
                }
                break;

            case 'execute_gravity_glitch':
                if (this.gameCore.player && typeof this.gameCore.player.applyGravityGlitch === 'function') {
                    this.gameCore.player.applyGravityGlitch(data.gravity, data.duration);
                } else {
                    console.error("Player.applyGravityGlitch not found for data:", data);
                }
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.triggerGravityGlitchEffect === 'function') {
                    this.gameCore.effectsManager.triggerGravityGlitchEffect(data.duration);
                } else {
                    console.error("EffectsManager.triggerGravityGlitchEffect not found for data:", data);
                }
                break;

            case 'execute_reveal_map':
                if (this.gameCore.uiManager && typeof this.gameCore.uiManager.showMapReveal === 'function') {
                    this.gameCore.uiManager.showMapReveal(data.duration);
                } else {
                    console.error("UIManager.showMapReveal not found for data:", data);
                }
                break;

            case 'audience_command':
                if (this.gameCore.consoleManager && typeof this.gameCore.consoleManager.executeNetworkedCommand === 'function') {
                    this.gameCore.consoleManager.executeNetworkedCommand(data.command, data.arguments, data.source, true); // true for isAudienceCmd
                } else {
                    console.error("ConsoleManager or executeNetworkedCommand not found for audience_command:", data);
                }
                break;

            case 'apply_player_effect':
                // All clients receive this to show visuals. Only the target player applies the core effect logic.
                if (this.gameCore.player && typeof this.gameCore.player.getPlayerId === 'function' && this.gameCore.player.getPlayerId() === data.targetId) {
                    if (typeof this.gameCore.player.applyTimedEffect === 'function') {
                        this.gameCore.player.applyTimedEffect(data.effect);
                    } else {
                        console.error("Player.applyTimedEffect not found for target player.");
                    }
                }
                // All clients show visuals for the target player
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.showPlayerEffectVisuals === 'function') {
                    this.gameCore.effectsManager.showPlayerEffectVisuals(data.targetId, data.effect);
                } else {
                     console.error("EffectsManager.showPlayerEffectVisuals not found.");
                }
                break;

            case 'new_confessional_log':
                if (data.log && data.log.playerId !== this.getPlayerId()) { // Don't re-add own log if broadcast to self
                    if (this.gameCore.gameState && typeof this.gameCore.gameState.confessionalLogs.push === 'function') {
                        this.gameCore.gameState.confessionalLogs.push(data.log);
                    }
                    if (this.gameCore.uiManager && typeof this.gameCore.uiManager.addConsoleLogMessage === 'function') {
                        // Optional: Notify other players via console, or a different UI element could display these.
                        this.gameCore.uiManager.addConsoleLogMessage(`Confessional from ${data.log.playerName || 'a player'} logged.`, "info");
                    }
                }
                break;

            case 'fragment_ping_alert': // This is a good candidate for subscription by EffectsManager/AudioManager
                if (this.gameCore.effectsManager && this.gameCore.audioManager && this.room) {
                    this.gameCore.effectsManager.triggerFragmentPingEffect(data.position, data.carrierId === this.getPlayerId());
                    this.gameCore.audioManager.playSound('fragment_ping');
                }
                break;
            case 'overheat_effect': // Also a good candidate for subscription
                if (this.gameCore.effectsManager && this.gameCore.audioManager) {
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
                console.log('Unhandled room message (fallback):', data);
        }
    }
    
    // handleRemoteShot is effectively replaced by the 'player_shot' case above for trails.
    // Muzzle flash for remote players could be added here if 'player_shot' included a weapon muzzle point.
    // For now, only local player sees their own muzzle flash.
    
    handleRemoteFragmentCollection(data) { // This message type might be deprecated if relying purely on roomState.
                                        // For now, it can provide immediate UI feedback.
        if (data.playerId !== this.getPlayerId()) {
            const username = this.getUsername(data.playerId) || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} collected the memory fragment`);
            this.gameCore.fragmentManager.removeFragment('center_fragment');
        }
    }
    
    handleRemoteFragmentDrop(data) {
        if (data.playerId !== this.getPlayerId()) {
            const username = this.getUsername(data.playerId) || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} dropped the memory fragment`);
            const dropPosition = { x: data.position[0], y: data.position[1], z: data.position[2] };
            this.gameCore.fragmentManager.createFragment('center_fragment', dropPosition);
        }
    }
    
    handleRemoteFragmentDelivery(data) {
        if (data.playerId !== this.getPlayerId()) {
            const username = this.getUsername(data.playerId) || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} delivered a fragment for Team ${data.team.toUpperCase()}`);
            if (data.team === 'alpha') this.gameCore.gameState.fragmentsAlpha++;
            else this.gameCore.gameState.fragmentsBeta++;
            this.gameCore.uiManager.updateScoreDisplay();
        }
    }
    
    handleDistortEffect(data) {
        if (data.target === 'enemies' && this.isEnemyPlayer(data.source)) {
            document.getElementById('game-ui').classList.add('inverted');
            setTimeout(() => document.getElementById('game-ui').classList.remove('inverted'), data.duration || 5000);
        }
    }
    
    handleSignalJam(data) {
        if (data.source !== this.getPlayerId()) {
            document.getElementById('hud').style.opacity = '0.3';
            setTimeout(() => document.getElementById('hud').style.opacity = '1', data.duration || 3000);
        }
    }
    
    handleTreasureMapPickup(data) {
        if (data.playerId !== this.getPlayerId()) {
            const username = this.getUsername(data.playerId) || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username} acquired the treasure map`);
            if (this.gameCore.treasureMapManager) this.gameCore.treasureMapManager.handleNetworkEvent(data);
        }
    }
    
    handleRemembranceTriggered(data) {
        if (data.triggerPlayer !== this.getPlayerId()) {
            const username = this.getUsername(data.triggerPlayer) || 'Unknown';
            this.gameCore.uiManager.addKillFeedEntry(`${username}'s team triggered the Remembrance Event!`);
            if (this.gameCore.treasureMapManager) this.gameCore.treasureMapManager.handleNetworkEvent(data);
            this.gameCore.uiManager.activateRemembranceEffect(data.triggerTeam);
        }
    }
    
    handlePresenceUpdateRequest(updateRequest, fromClientId) {
        if (updateRequest.type === 'damage') {
            const isDead = this.gameCore.player.takeDamage(
                updateRequest.amount,
                updateRequest.weapon,
                updateRequest.attackerId || fromClientId
            );
            this.gameCore.uiManager.updateHealthDisplay();
            const damageEffectIntensity = updateRequest.amount / 100;
            this.gameCore.effectsManager.addScreenFlash('#ff0000', 300 * damageEffectIntensity);
            if (isDead) {
                this.gameCore.handlePlayerDeath(updateRequest.attackerId || fromClientId); // Pass attackerId
            }
            this.updatePresence(this.gameCore.player.getPresenceData());
        }
    }
    
    updateGameState() { // This is called by room.subscribeRoomState
        const roomState = this.room.roomState;
        if (roomState) {
            if (roomState.globalCorruption !== undefined) {
                this.gameCore.gameState.corruptionLevel = roomState.globalCorruption;
                this.gameCore.uiManager.updateCorruptionDisplay();
            }
            if (roomState.scoreAlpha !== undefined) {
                this.gameCore.gameState.scoreAlpha = roomState.scoreAlpha;
            }
            if (roomState.scoreBeta !== undefined) {
                this.gameCore.gameState.scoreBeta = roomState.scoreBeta;
            }
            if(roomState.scoreAlpha !== undefined || roomState.scoreBeta !== undefined) {
                 this.gameCore.uiManager.updateScoreDisplay();
            }
            // Handle Overheat Mode state change from network (moved from initialize for clarity)
            if (roomState.isOverheatModeActive !== undefined &&
                this.gameCore.gameState.isOverheatModeActive !== roomState.isOverheatModeActive) {
                this.gameCore.gameState.isOverheatModeActive = roomState.isOverheatModeActive;
                if (this.gameCore.effectsManager) {
                    if (this.gameCore.gameState.isOverheatModeActive) {
                        this.gameCore.effectsManager.startOverheatVisualGlitches();
                    } else {
                        this.gameCore.effectsManager.stopOverheatVisualGlitches();
                    }
                }
            }
             // Update fragments from network (moved from initialize for clarity)
            if (this.gameCore.fragmentManager && roomState.fragments) {
                this.gameCore.fragmentManager.updateFragmentsFromNetwork(roomState.fragments);
            }
        }
    }
    
    isEnemyPlayer(playerId) {
        const playerPresence = this.room.presence[playerId];
        const localPlayerTeam = this.gameCore.player.team;
        return playerPresence && playerPresence.team !== localPlayerTeam;
    }
}