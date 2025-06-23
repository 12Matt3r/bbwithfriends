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

import { MESSAGE_TYPES } from './Constants.js';

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
        this.sendMessage(MESSAGE_TYPES.LOBBY_PLAYER_UPDATE, { playerData });
    }

    sendLobbyFullSyncRequest(playerData) {
        this.sendMessage(MESSAGE_TYPES.LOBBY_FULL_SYNC_REQUEST, { playerData });
    }

    // Specifically for lobby chat messages
    sendLobbyChatMessage(message) {
        const playerId = this.getPlayerId();
        this.sendMessage(MESSAGE_TYPES.LOBBY_CHAT_MESSAGE, { playerId: playerId, message: message });
    }

    sendChaosVote(voterId, votedForId) {
        this.sendMessage(MESSAGE_TYPES.CHAOS_VOTE_UPDATE, { voterId, votedForId });
    }

    sendPlayerEliminated(victimName, killerName, weaponUsed) {
        if (this.room) {
            this.sendMessage(MESSAGE_TYPES.PLAYER_ELIMINATED, { victimName, killerName, weaponUsed });
        }
    }

    sendChaosInfluencerDetermined(influencerId) {
        this.sendMessage(MESSAGE_TYPES.CHAOS_INFLUENCER_DETERMINED, { influencerId });
    }

    sendFragmentPingAlert(carrierId, position) {
        this.sendMessage(MESSAGE_TYPES.FRAGMENT_PING_ALERT, { carrierId, position });
    }

    sendOverheatEffect(effectData) {
        this.sendMessage(MESSAGE_TYPES.OVERHEAT_EFFECT, effectData);
    }

    sendConsoleCommand(commandName, args) {
        const playerId = this.getPlayerId();
        if (playerId) {
            this.sendMessage(MESSAGE_TYPES.CONSOLE_COMMAND, { commandName, arguments: args, playerId });
        } else {
            console.warn("Cannot send console command, player ID not available.");
        }
    }

    sendSwapPlayersCommand(playerA_id, playerB_id) {
        this.sendMessage(MESSAGE_TYPES.EXECUTE_PLAYER_SWAP, { pA_id: playerA_id, pB_id: playerB_id });
    }

    sendGlitchGravityCommand(gravityVectorObj, durationSeconds) {
        this.sendMessage(MESSAGE_TYPES.EXECUTE_GRAVITY_GLITCH, { gravity: gravityVectorObj, duration: durationSeconds });
    }

    sendRevealMapCommand(durationSeconds) {
        this.sendMessage(MESSAGE_TYPES.EXECUTE_REVEAL_MAP, { duration: durationSeconds });
    }

    sendAudienceCommand(commandName, args) {
        this.send({ type: MESSAGE_TYPES.AUDIENCE_COMMAND, command: commandName, arguments: args, source: 'AUDIENCE' });
    }

    sendApplyPlayerEffectCommand(targetPlayerId, effectDetails) {
        this.send({ type: MESSAGE_TYPES.APPLY_PLAYER_EFFECT, targetId: targetPlayerId, effect: effectDetails });
    }

    sendNewConfessionalLog(logEntry) {
        this.sendMessage(MESSAGE_TYPES.NEW_CONFESSIONAL_LOG, { log: logEntry });
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
            case MESSAGE_TYPES.CONNECTED:
                this.gameCore.uiManager.addKillFeedEntry(`${data.username || data.clientId} joined the simulation`);
                if (this.gameCore.lobbyManager) {
                     // LobbyManager's subscriptions should handle new player logic if active.
                }
                break;
            case MESSAGE_TYPES.DISCONNECTED:
                this.gameCore.uiManager.addKillFeedEntry(`${data.username || data.clientId} disconnected`);
                if (this.gameCore.fragmentManager && this.gameCore.fragmentManager.getFragmentState('center_fragment')?.carrierId === data.clientId) {
                    console.log(`Fragment carrier ${data.username || data.clientId} disconnected. Authority should reset fragment.`);
                }
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.removePlayer(data.clientId);
                }
                break;
            case MESSAGE_TYPES.PLAYER_SHOT:
                if (data.playerId !== this.getPlayerId() && this.gameCore.effectsManager && this.gameCore.audioManager) {
                    const startPos = new THREE.Vector3().fromArray(data.startPos);
                    const endPos = new THREE.Vector3().fromArray(data.endPos);
                    this.gameCore.effectsManager.createProjectileTrail(startPos, endPos);
                    const soundToPlay = data.weapon === 'scout' ? 'silenced_shot_distant' : 'distant_shot'; // TODO: Use WEAPON_TYPES constant
                    this.gameCore.audioManager.playSound(soundToPlay, startPos);
                }
                break;
            case MESSAGE_TYPES.FRAGMENT_COLLECTED:
                this.handleRemoteFragmentCollection(data);
                break;
            case MESSAGE_TYPES.FRAGMENT_DROPPED:
                this.handleRemoteFragmentDrop(data);
                break;
            case MESSAGE_TYPES.FRAGMENT_DELIVERED:
                this.handleRemoteFragmentDelivery(data);
                break;
            case MESSAGE_TYPES.DISTORT_EFFECT:
                this.handleDistortEffect(data);
                break;
            case MESSAGE_TYPES.SIGNAL_JAM:
                this.handleSignalJam(data);
                break;
            case MESSAGE_TYPES.TREASURE_MAP_PICKED_UP:
                this.handleTreasureMapPickup(data);
                break;
            case MESSAGE_TYPES.REMEMBRANCE_TRIGGERED:
                this.handleRemembranceTriggered(data);
                break;

            // Lobby messages are handled by subscriptions in LobbyManager.
            // This fallback won't process them if LobbyManager is active.

            case MESSAGE_TYPES.CONSOLE_COMMAND:
                if (this.gameCore.consoleManager && typeof this.gameCore.consoleManager.executeNetworkedCommand === 'function') {
                    this.gameCore.consoleManager.executeNetworkedCommand(data.commandName, data.arguments, data.playerId);
                } else {
                    console.error("ConsoleManager or executeNetworkedCommand not found for data:", data);
                }
                break;

            case MESSAGE_TYPES.EXECUTE_PLAYER_SWAP:
                if (this.gameCore.performPlayerSwap && typeof this.gameCore.performPlayerSwap === 'function') {
                    this.gameCore.performPlayerSwap(data.pA_id, data.pB_id);
                } else {
                    console.error("GameCore.performPlayerSwap not found for data:", data);
                }
                break;

            case MESSAGE_TYPES.EXECUTE_GRAVITY_GLITCH:
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

            case MESSAGE_TYPES.EXECUTE_REVEAL_MAP:
                if (this.gameCore.uiManager && typeof this.gameCore.uiManager.showMapReveal === 'function') {
                    this.gameCore.uiManager.showMapReveal(data.duration);
                } else {
                    console.error("UIManager.showMapReveal not found for data:", data);
                }
                break;

            case MESSAGE_TYPES.AUDIENCE_COMMAND:
                if (this.gameCore.consoleManager && typeof this.gameCore.consoleManager.executeNetworkedCommand === 'function') {
                    this.gameCore.consoleManager.executeNetworkedCommand(data.command, data.arguments, data.source, true); // true for isAudienceCmd
                } else {
                    console.error("ConsoleManager or executeNetworkedCommand not found for audience_command:", data);
                }
                break;

            case MESSAGE_TYPES.APPLY_PLAYER_EFFECT:
                if (this.gameCore.player && typeof this.gameCore.player.getPlayerId === 'function' && this.gameCore.player.getPlayerId() === data.targetId) {
                    if (typeof this.gameCore.player.applyTimedEffect === 'function') {
                        this.gameCore.player.applyTimedEffect(data.effect);
                    } else {
                        console.error("Player.applyTimedEffect not found for target player.");
                    }
                }
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.showPlayerEffectVisuals === 'function') {
                    this.gameCore.effectsManager.showPlayerEffectVisuals(data.targetId, data.effect);
                } else {
                     console.error("EffectsManager.showPlayerEffectVisuals not found.");
                }
                break;

            case MESSAGE_TYPES.NEW_CONFESSIONAL_LOG:
                if (data.log && data.log.playerId !== this.getPlayerId()) {
                    if (this.gameCore.gameState && typeof this.gameCore.gameState.confessionalLogs.push === 'function') {
                        this.gameCore.gameState.confessionalLogs.push(data.log);
                    }
                    if (this.gameCore.uiManager && typeof this.gameCore.uiManager.addConsoleLogMessage === 'function') {
                        this.gameCore.uiManager.addConsoleLogMessage(`Confessional from ${data.log.playerName || 'a player'} logged.`, "info");
                    }
                }
                break;

            case MESSAGE_TYPES.FRAGMENT_PING_ALERT:
                if (this.gameCore.effectsManager && this.gameCore.audioManager && this.room) {
                    this.gameCore.effectsManager.triggerFragmentPingEffect(data.position, data.carrierId === this.getPlayerId());
                    this.gameCore.audioManager.playSound('fragment_ping'); // TODO: Use SOUND_KEYS constant
                }
                break;
            case MESSAGE_TYPES.OVERHEAT_EFFECT:
                if (this.gameCore.effectsManager && this.gameCore.audioManager) {
                    if (data.effectType === 'explosion' && data.position) {
                        this.gameCore.effectsManager.triggerRandomExplosion(data.position);
                        this.gameCore.audioManager.playSound('random_explosion', data.position); // TODO: Use SOUND_KEYS constant
                    } else if (data.effectType === 'hallucination' && data.position && data.enemyType) {
                        this.gameCore.effectsManager.spawnHallucinatedEnemy(data.position, data.enemyType);
                        this.gameCore.audioManager.playSound('hallucination_spawn', data.position); // TODO: Use SOUND_KEYS constant
                    }
                }
                break;
            default:
                console.log('Unhandled room message (fallback):', data);
        }
    }
    
    // handleRemoteShot is effectively replaced by the PLAYER_SHOT case above for trails.
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
        if (updateRequest.type === MESSAGE_TYPES.PRESENCE_DAMAGE) {
            const isDead = this.gameCore.player.takeDamage(
                updateRequest.amount,
                updateRequest.weapon,
                updateRequest.attackerId || fromClientId
            );
            this.gameCore.uiManager.updateHealthDisplay();
            const damageEffectIntensity = updateRequest.amount / 100;
            this.gameCore.effectsManager.addScreenFlash('#ff0000', 300 * damageEffectIntensity);
            // Player.takeDamage now calls GameCore.handlePlayerDeath if isDead is true.
            // So no need to call it explicitly here.
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