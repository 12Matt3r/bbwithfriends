export class LobbyManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.uiManager = gameCore.uiManager;
        this.networkManager = gameCore.networkManager;

        this.lobbyPlayers = {}; // Stores { playerId: { username, avatar, teamColor, playerClass, isReady, id } }
        this.localPlayerId = null;
        this.localPlayerVotedForChaos = null; // Stores ID of player voted for, or null
        this.chaosVotes = {}; // Stores { playerId: voteCount }
        this.chaosInfluencer = null; // ID of the Chaos Influencer
    }

import { MESSAGE_TYPES, PLAYER_CLASSES, TEAM_IDS } from './Constants.js';

export class LobbyManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.uiManager = gameCore.uiManager;
        this.networkManager = gameCore.networkManager;

        this.lobbyPlayers = {}; // Stores { playerId: { username, avatar, teamColor, playerClass, isReady, id } }
        this.localPlayerId = null;
        this.localPlayerVotedForChaos = null; // Stores ID of player voted for, or null
        this.chaosVotes = {}; // Stores { playerId: voteCount }
        this.chaosInfluencer = null; // ID of the Chaos Influencer
    }

    initialize() {
        // Subscribe to network events for lobby updates
        if (this.networkManager) {
            this.localPlayerId = this.networkManager.getPlayerId();

            this.networkManager.subscribe(MESSAGE_TYPES.LOBBY_PLAYER_UPDATE, this.handleLobbyPlayerUpdate.bind(this));
            this.networkManager.subscribe(MESSAGE_TYPES.LOBBY_CHAT_MESSAGE, this.handleLobbyChatMessage.bind(this));
            this.networkManager.subscribe(MESSAGE_TYPES.LOBBY_FULL_SYNC_REQUEST, this.handleFullLobbySyncRequest.bind(this));
            this.networkManager.subscribe(MESSAGE_TYPES.CHAOS_VOTE_UPDATE, this.handleChaosVoteUpdateMsg.bind(this));
            this.networkManager.subscribe(MESSAGE_TYPES.CHAOS_INFLUENCER_DETERMINED, this.handleChaosInfluencerDeterminedMsg.bind(this));

            // Initialize local player's default state
            this.initializeLocalPlayerData();
            this.updateLobbyUI();
        } else {
            console.error("LobbyManager: NetworkManager not available during initialization.");
            // Even without network, allow local player data initialization for single-player testing or offline mode.
            this.initializeLocalPlayerData();
        }
    }

    getPlayerId() {
        return this.localPlayerId || (this.networkManager ? this.networkManager.getPlayerId() : null);
    }

    // Called by GameCore when transitioning to lobby
    requestFullLobbyStateSync() {
        const localPlayerData = this.initializeLocalPlayerData();
        if (this.networkManager && localPlayerData) {
            this.networkManager.sendLobbyFullSyncRequest(localPlayerData);
        }
        // Also immediately update local UI with current known players
        this.updateLobbyUI();
    }

    handleFullLobbySyncRequest(data) { // Expects the full message object { type: ..., playerData: ... }
        const requestingPlayerData = data.playerData;
        // Another player is requesting a full sync, or has sent their initial state.
        if (!requestingPlayerData || !requestingPlayerData.id) return;


        if (requestingPlayerData.id !== this.localPlayerId) {
            this.lobbyPlayers[requestingPlayerData.id] = {
                ...this.lobbyPlayers[requestingPlayerData.id], // Keep existing votes if any
                ...requestingPlayerData
            };
        }

        // Send our current state back to them (or to all if that's how sendLobbyPlayerUpdate works)
        const localPlayerData = this.initializeLocalPlayerData();
        if (this.networkManager && localPlayerData) {
            this.networkManager.sendLobbyPlayerUpdate(localPlayerData);
        }
        this.updateLobbyUI();
        this.checkAllPlayersReady();
    }

    initializeLocalPlayerData() {
        if (!this.localPlayerId && this.networkManager) { // Attempt to get localPlayerId if not set
            this.localPlayerId = this.networkManager.getPlayerId();
        }

        if (this.localPlayerId && !this.lobbyPlayers[this.localPlayerId]) {
            const username = this.networkManager
                ? (this.networkManager.getUsername(this.localPlayerId) || 'Player ' + this.localPlayerId.substring(0,4))
                : ('LocalPlayer'); // Fallback username if NM not available

            this.lobbyPlayers[this.localPlayerId] = {
                id: this.localPlayerId,
                username: username,
                avatar: 'default', // Default avatar
                teamColor: TEAM_IDS.ALPHA, // Default team (maps to 'blue' in UIManager for now)
                playerClass: PLAYER_CLASSES.ASSAULT, // Default class
                isReady: false
            };
        }
        return this.lobbyPlayers[this.localPlayerId];
    }

    handleAvatarSelection(avatar) {
        const localPlayer = this.initializeLocalPlayerData();
        if (!localPlayer) return;
        localPlayer.avatar = avatar;
        this.updatePlayerLobbyStatus();
    }

    handleTeamColorSelection(color) { // color is 'blue' or 'red' from UI for now
        const localPlayer = this.initializeLocalPlayerData();
        if (!localPlayer) return;
        // Map UI color string to TEAM_ID if necessary, or ensure LobbyManager/UIManager use consistent values.
        // For now, assuming UIManager provides a value that Player.js/GameCore.js can map or use.
        // Player.js setClass will use TEAM_IDS.ALPHA/BETA based on this string.
        localPlayer.teamColor = color;
        this.updatePlayerLobbyStatus();
    }

    handleClassSelection(playerClass) { // playerClass should be one of PLAYER_CLASSES
        const localPlayer = this.initializeLocalPlayerData();
        if (!localPlayer) return;
        if (Object.values(PLAYER_CLASSES).includes(playerClass)) {
            localPlayer.playerClass = playerClass;
        } else {
            console.warn(`Invalid playerClass selected: ${playerClass}. Defaulting to ASSAULT.`);
            localPlayer.playerClass = PLAYER_CLASSES.ASSAULT;
        }
        this.updatePlayerLobbyStatus();
    }

    handleReadyButtonClick() {
        const localPlayer = this.initializeLocalPlayerData();
        if (!localPlayer) return;
        localPlayer.isReady = !localPlayer.isReady;
        this.updatePlayerLobbyStatus();
    }

    updatePlayerLobbyStatus() {
        const localPlayerData = this.initializeLocalPlayerData();
        if (!localPlayerData) {
            console.error("Cannot update player lobby status - local player data not available.");
            return;
        }
        if (this.networkManager) {
            this.networkManager.sendLobbyPlayerUpdate(localPlayerData);
        } else {
            // Handle offline scenario: UI might still need update
            console.log("NetworkManager not available, local lobby status updated (offline).");
        }

        // Update own UI immediately
        this.updateLobbyUI();
        this.checkAllPlayersReady(); // Check readiness even in offline mode (for starting a local game perhaps)
    }

    // Called by NetworkManager when a 'lobby_player_update' message is received
    handleLobbyPlayerUpdate(data) { // Expects the full message object { type: ..., playerData: ... }
        const playerData = data.playerData;
        if (!playerData || !playerData.id) return;

        // Ensure username is part of the update or fetched if missing
        if (!playerData.username && this.networkManager) {
            playerData.username = this.networkManager.getUsername(playerData.id) || 'Player ' + playerData.id.substring(0,4);
        }

        this.lobbyPlayers[playerData.id] = {
            ...this.lobbyPlayers[playerData.id], // Preserve existing data like votes
            ...playerData
        };

        // If the update is for the local player (e.g., echo from server or host confirmation),
        // ensure local state doesn't get overwritten if it's more current for some fields.
        // However, 'isReady' state from server/host should be authoritative if that's the model.
        // For now, simple overwrite is fine.

        this.updateLobbyUI();
        this.checkAllPlayersReady();
    }

    // Called by NetworkManager for chat messages
    handleLobbyChatMessage({ playerId, message }) {
        if (!this.uiManager) return;
        const playerName = (this.lobbyPlayers[playerId] && this.lobbyPlayers[playerId].username) ||
                           (this.networkManager ? this.networkManager.getUsername(playerId) : null) ||
                           'Player ' + playerId.substring(0,4);
        this.uiManager.addChatMessage(playerName, message);
    }

    updateLobbyUI() {
        if (this.uiManager) {
            const playersArray = Object.values(this.lobbyPlayers);
            this.uiManager.updateLobbyPlayerList(playersArray);
            this.uiManager.updateChaosVoteList(
                playersArray,
                this.localPlayerId,
                this.chaosVotes,
                this.chaosInfluencer,
                this.localPlayerVotedForChaos
            );
        }
    }

    // Method to remove a player from the lobby (e.g., on disconnect)
    removePlayer(playerId) {
        if (this.lobbyPlayers[playerId]) {
            delete this.lobbyPlayers[playerId];
            // Remove their votes if any
            if (this.chaosVotes[playerId]) {
                // This case is if the disconnected player was voted FOR.
                // We might need to re-evaluate influencer if they were it.
                // For now, just remove their vote count.
                delete this.chaosVotes[playerId];
            }
            // Check if the disconnected player was the one who voted
            for (const votedForId in this.chaosVotes) {
                // This requires votes to be stored as {votedFor: [voter1, voter2]}
                // Simpler: if a player disconnects, their vote is implicitly removed.
                // The current `this.chaosVotes` structure {playerId: voteCount} doesn't store who voted for whom.
                // Let's assume for now that `determineChaosInfluencer` re-calculates from active players.
            }

            this.updateLobbyUI();
            this.determineChaosInfluencer(); // Re-evaluate after a player leaves
            this.checkAllPlayersReady(); // Game shouldn't start if a player leaves and conditions are no longer met
        }
    }

    checkAllPlayersReady() {
        if (!this.networkManager || Object.keys(this.lobbyPlayers).length === 0) {
            // console.log("CheckAllPlayersReady: No players or NM not ready.");
            return;
        }

        // Consider only players currently connected via NetworkManager's peer list
        const connectedPlayerIds = this.networkManager.getConnectedPeersIds ? this.networkManager.getConnectedPeersIds() : Object.keys(this.lobbyPlayers);

        if (connectedPlayerIds.length === 0) {
             // console.log("CheckAllPlayersReady: No connected players.");
            return;
        }

        // Minimum 1 player to start (for testing), ideally more for a real game.
        const MIN_PLAYERS_TO_START = 1;
        if (connectedPlayerIds.length < MIN_PLAYERS_TO_START) {
            // console.log(`CheckAllPlayersReady: Not enough players. Need ${MIN_PLAYERS_TO_START}, have ${connectedPlayerIds.length}`);
            return;
        }

        let allReady = true;
        for (const playerId of connectedPlayerIds) {
            const player = this.lobbyPlayers[playerId];
            if (!player || !player.isReady) {
                allReady = false;
                break;
            }
        }

        if (allReady) {
            // Before starting, ensure Chaos Influencer is determined if not already.
            if (!this.chaosInfluencer) {
                this.determineChaosInfluencer(true); // Pass true to force determination if possible
            }
            console.log("All players ready! Starting game...");
            if (this.gameCore && typeof this.gameCore.startGameFromLobby === 'function') {
                this.gameCore.startGameFromLobby();
            } else {
                console.error("LobbyManager: gameCore.startGameFromLobby is not a function or gameCore is not set.");
            }
        } else {
            // console.log("CheckAllPlayersReady: Not all players are ready.");
        }
    }

    // Chaos Influencer Voting Logic
    castChaosVote(votedPlayerId) {
        if (!this.localPlayerId || this.localPlayerVotedForChaos) {
            this.uiManager.showNotification("You have already voted or cannot vote.");
            return;
        }
        if (votedPlayerId === this.localPlayerId) {
            this.uiManager.showNotification("You cannot vote for yourself.");
            return;
        }

        this.localPlayerVotedForChaos = votedPlayerId; // Mark that local player has voted

        // Send vote to network
        if (this.networkManager) {
            this.networkManager.sendChaosVote(this.localPlayerId, votedPlayerId);
        }

        // Optimistically update local UI for vote button disabling
        this.updateLobbyUI();
        this.uiManager.showNotification(`You voted for ${this.lobbyPlayers[votedPlayerId]?.username || votedPlayerId}`);

        // Host/Authoritative client should handle actual vote counting and determination
    }

    handleChaosVoteUpdateMsg(voteData) { // { voterId, votedForId, allVotes }
        // This message should ideally come from an authoritative source (host)
        // containing the complete and validated vote counts.
        if (voteData.allVotes) {
            this.chaosVotes = voteData.allVotes;
        }
        // If a specific vote is sent:
        // if (voteData.voterId && voteData.votedForId) {
        //    this.chaosVotes[voteData.votedForId] = (this.chaosVotes[voteData.votedForId] || 0) + 1;
        // }

        // If this client is authoritative, it might redetermine. Otherwise, it waits for determined message.
        // For now, let's assume an authoritative message updates chaosVotes directly.
        this.updateLobbyUI();
        // Potentially, the authoritative client calls determineChaosInfluencer and broadcasts the result
    }

    handleChaosInfluencerDeterminedMsg(data) { // { influencerId }
        this.chaosInfluencer = data.influencerId;
        if (this.uiManager && this.chaosInfluencer) {
            const influencerName = this.lobbyPlayers[this.chaosInfluencer]?.username || this.chaosInfluencer;
            this.uiManager.showNotification(`Chaos Influencer is: ${influencerName}!`);
        }
        this.updateLobbyUI();
    }

    determineChaosInfluencer(forceDetermination = false) {
        // This should ideally be run by a host or authoritative client.
        // For a decentralized setup, it's more complex (e.g., highest ID player makes determination if votes are tied).
        // Let's assume for now this client *might* be the one to do it if forced.

        if (this.chaosInfluencer && !forceDetermination) return; // Already determined

        let maxVotes = 0;
        let potentialInfluencers = [];

        for (const playerId in this.chaosVotes) {
            if (this.lobbyPlayers[playerId]) { // Only consider active players
                const numVotes = this.chaosVotes[playerId];
                if (numVotes > maxVotes) {
                    maxVotes = numVotes;
                    potentialInfluencers = [playerId];
                } else if (numVotes === maxVotes) {
                    potentialInfluencers.push(playerId);
                }
            }
        }

        let newInfluencer = null;
        if (potentialInfluencers.length > 0) {
            if (potentialInfluencers.length === 1) {
                newInfluencer = potentialInfluencers[0];
            } else {
                // Tie-breaking: pick one randomly or by lowest/highest ID
                newInfluencer = potentialInfluencers.sort()[0]; // Lowest ID wins ties
            }
        } else if (Object.keys(this.lobbyPlayers).length > 0 && forceDetermination) {
            // No votes, but forced: pick a random active player (or by ID)
            const activePlayers = Object.keys(this.lobbyPlayers).sort();
            if (activePlayers.length > 0) {
                 newInfluencer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
            }
        }


        if (newInfluencer && newInfluencer !== this.chaosInfluencer) {
            this.chaosInfluencer = newInfluencer;
            console.log("Chaos Influencer determined:", this.chaosInfluencer);
            // Authoritative client would send this determination to others
            if (this.networkManager) { // && this.networkManager.isHost() or some authority check
                 this.networkManager.sendChaosInfluencerDetermined(this.chaosInfluencer);
            }
        }
        this.updateLobbyUI();
    }
}
