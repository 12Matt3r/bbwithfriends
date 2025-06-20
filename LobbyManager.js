export class LobbyManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.selectedAvatar = 'spongebob'; // Default avatar
        this.selectedTeamColor = 'blue'; // Default team color
        this.selectedClass = 'assault'; // Default class
        this.isReady = false;
        this.lobbyPlayers = {}; // To store state of all players in lobby
        this.networkManager = null;
        this.uiManager = null;

        // Chaos Vote Properties
        this.chaosVotes = {}; // {'playerId1': 2, 'playerId2': 1}
        this.localPlayerVotedFor = null; // ID of the player the local user has voted for
        this.chaosInfluencer = null; // ID of the determined Chaos Influencer
    }

    initialize() {
        // Store references to other managers
        this.networkManager = this.gameCore.networkManager;
        this.uiManager = this.gameCore.uiManager;

        // Initialize chaos votes for any players already known (e.g. self)
        // This will be more robustly populated as players join via handlePlayerUpdate
        Object.keys(this.lobbyPlayers).forEach(playerId => {
            if (!this.chaosVotes[playerId]) {
                this.chaosVotes[playerId] = 0;
            }
        });

        // Initial status update for the local player when entering lobby
        this.updatePlayerLobbyStatus(); // This will also trigger UI update for vote list

        // Example: if UIManager is responsible for listening to UI events and calling these handlers:
        // this.uiManager.onAvatarSelected = this.handleAvatarSelection.bind(this);
        // this.uiManager.onTeamColorSelected = this.handleTeamColorSelection.bind(this);
        // this.uiManager.onReadyButtonClicked = this.handleReadyButtonClick.bind(this);

        // Note: Network subscriptions for lobby updates are handled by NetworkManager
        // which calls `handlePlayerUpdate` in this class.
        // Set default class for local player on init if not already set by UI
        const localPlayerId = this.getPlayerId();
        if (localPlayerId && this.lobbyPlayers[localPlayerId]) {
            this.lobbyPlayers[localPlayerId].playerClass = this.selectedClass;
        } else if (localPlayerId) {
             this.lobbyPlayers[localPlayerId] = { id: localPlayerId, playerClass: this.selectedClass, username: localPlayerId /*temp*/ };
        }

    }

    getPlayerId() {
        return this.networkManager && this.networkManager.room ? this.networkManager.room.clientId : 'localPlayer';
    }

    handleAvatarSelection(avatar) {
        this.selectedAvatar = avatar;
        this.updatePlayerLobbyStatus();
    }

    handleTeamColorSelection(color) {
        this.selectedTeamColor = color;
        this.updatePlayerLobbyStatus();
    }

    handleReadyButtonClick() {
        this.isReady = !this.isReady;
        this.updatePlayerLobbyStatus();
    }

    handleClassSelection(className) {
        this.selectedClass = className;
        // Potentially update local player object's class immediately for UI responsiveness
        const localPlayerId = this.getPlayerId();
        if (localPlayerId && this.lobbyPlayers[localPlayerId]) {
            this.lobbyPlayers[localPlayerId].playerClass = this.selectedClass;
        }
        this.updatePlayerLobbyStatus();
    }

    updatePlayerLobbyStatus() {
        const playerId = this.getPlayerId();
        if (!playerId) return;

        if (this.chaosVotes[playerId] === undefined) {
            this.chaosVotes[playerId] = 0;
        }

        const playerData = {
            id: playerId,
            username: (this.networkManager && this.networkManager.room && this.networkManager.room.presence[playerId]?.username) || playerId,
            avatar: this.selectedAvatar,
            teamColor: this.selectedTeamColor,
            playerClass: this.selectedClass, // Include selected class
            isReady: this.isReady,
        };

        // Update local representation immediately (ensure all fields including new ones are covered)
        if (!this.lobbyPlayers[playerId]) this.lobbyPlayers[playerId] = {};
        Object.assign(this.lobbyPlayers[playerId], playerData);


        // Send update to other players
        if (this.networkManager) {
            this.networkManager.sendLobbyPlayerUpdate(playerData);
        }

        // Update the UI for all players (player list and vote list)
        // Ensure local player's class selection is reflected immediately even before network echo
        if (this.uiManager) {
            const playersArray = Object.values(this.lobbyPlayers);
            this.uiManager.updateLobbyPlayerList(playersArray);
            this.uiManager.updateChaosVoteList(playersArray, playerId, this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
        }

        // Check if all players are ready (potential game start logic)
        this.checkAllPlayersReady();
    }

    handlePlayerUpdate(playerData) {
        // Called by NetworkManager when a lobby_player_update is received
        if (!playerData || !playerData.id) {
            console.warn('Received invalid player update data:', playerData);
            return;
        }

        const isNewPlayer = !this.lobbyPlayers[playerData.id];
        if (!this.lobbyPlayers[playerData.id]) { // If player is entirely new
            this.lobbyPlayers[playerData.id] = {};
        }

        // Merge received data, ensuring playerClass is included
        this.lobbyPlayers[playerData.id] = {
            ...this.lobbyPlayers[playerData.id],
            ...playerData
        };
        if (playerData.playerClass) {
            this.lobbyPlayers[playerData.id].playerClass = playerData.playerClass;
        }


        if (isNewPlayer && this.chaosVotes[playerData.id] === undefined) {
            this.chaosVotes[playerData.id] = 0;
        }

        // Update UI
        if (this.uiManager) {
            const playersArray = Object.values(this.lobbyPlayers);
            this.uiManager.updateLobbyPlayerList(playersArray);
            this.uiManager.updateChaosVoteList(playersArray, this.getPlayerId(), this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
        }

        // Check if this update caused all players to be ready
        this.checkAllPlayersReady();
    }

    checkAllPlayersReady() {
        if (!this.networkManager || !this.networkManager.room) return false;

        const connectedPlayerIds = Object.keys(this.networkManager.room.peers || {});
        if (connectedPlayerIds.length === 0 && Object.keys(this.lobbyPlayers).length === 1) { // Only local player
             // For single player/testing, ready button might directly start the game.
             // if (this.isReady) this.gameCore.startGameFromLobby(); // Example
            return this.isReady; // Or handle single player start differently
        }

        if (connectedPlayerIds.length === 0) return false; // No connected peers

        const allReady = connectedPlayerIds.every(id => this.lobbyPlayers[id] && this.lobbyPlayers[id].isReady);

        if (allReady && connectedPlayerIds.length > 0) { // Ensure there are actual players
            // Potentially add a small delay or a master client check before starting
            console.log("All players are ready! Starting game...");
            this.gameCore.startGameFromLobby(); // Notify GameCore to start
            return true;
        }
        return false;
    }

    // Method to be called by UIManager if lobby data needs to be resent (e.g. on opening lobby screen)
    requestFullLobbyStateSync() {
        this.updatePlayerLobbyStatus(); // Resend local player status
        // This will also trigger uiManager.updateChaosVoteList via updatePlayerLobbyStatus
    }

    // Chaos Vote Methods
    castChaosVote(votedPlayerId) {
        if (this.localPlayerVotedFor) {
            // Simple model: one vote per player. No changing votes for now.
            console.log("You have already voted.");
            if (this.uiManager) this.uiManager.addChatMessage(null, "You've already cast your vote for Chaos Influencer.", true);
            return;
        }

        if (!this.lobbyPlayers[votedPlayerId]) {
            console.warn(`Attempted to vote for non-existent player: ${votedPlayerId}`);
            return;
        }

        this.localPlayerVotedFor = votedPlayerId; // Mark that local player has voted
        this.chaosVotes[votedPlayerId] = (this.chaosVotes[votedPlayerId] || 0) + 1;

        if (this.networkManager) {
            // Corrected: sendChaosVote in NetworkManager takes only one argument as per its new definition
            this.networkManager.sendChaosVote(votedPlayerId);
        }

        if (this.uiManager) {
            // Disable all vote buttons after voting.
            this.uiManager.disableAllVoteButtons();
            this.uiManager.updateChaosVoteList(Object.values(this.lobbyPlayers), this.getPlayerId(), this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
        }

        this.checkVotingComplete();
    }

    handleChaosVote(voterPlayerId, votedPlayerId) {
        // Called by NetworkManager when a chaos_vote_cast message is received
        if (!this.chaosVotes.hasOwnProperty(votedPlayerId)) {
             // This might happen if a player just joined and their data hasn't fully propagated
            this.chaosVotes[votedPlayerId] = 0;
        }
        this.chaosVotes[votedPlayerId]++;

        // Note: We don't set localPlayerVotedFor here, only in castChaosVote for the local user.
        // We also don't disable buttons here, UIManager does that on local vote.

        if (this.uiManager) {
            this.uiManager.updateChaosVoteList(Object.values(this.lobbyPlayers), this.getPlayerId(), this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
        }

        this.checkVotingComplete();
    }

    checkVotingComplete() {
        // Condition: all currently connected players have cast a vote.
        // This needs a reliable list of "votable" players.
        // For simplicity, let's assume all players in lobbyPlayers are expected to vote.
        // Or, more simply for now: if total votes == number of players.

        const connectedPlayerCount = Object.keys(this.lobbyPlayers).length;
        if (connectedPlayerCount === 0) return; // No players, no voting.

        let totalVotesCast = 0;
        for (const playerId in this.chaosVotes) {
            totalVotesCast += this.chaosVotes[playerId];
            // This isn't quite right if players can receive multiple votes.
            // A better check: has each player *cast* a vote?
            // This requires knowing who has voted, e.g. by checking `localPlayerVotedFor` on each client's LobbyManager,
            // or by the server/master client tracking it.
            // For now, let's use a simpler heuristic: if a certain number of votes are in.
            // Or, a more direct (but still client-side estimated) approach:
            // if (Object.values(this.lobbyPlayers).every(p => p.hasVoted)) { ... } (requires 'hasVoted' flag)
        }

        // Simplistic: if total votes matches player count (assumes one vote per person, and everyone votes)
        // This is a placeholder; robust voting completion needs more thought, e.g., a timer or explicit "voting phase ended" signal.
        // Let's say voting is "complete" enough to determine a leader when all present players have had a chance to vote.
        // For now, we'll just determine the current leader each time a vote comes in.
        // A true "voting complete" might be when all players are READY, then a vote timer starts.

        this.determineChaosInfluencer(); // Determine (possibly interim) influencer after each vote.
    }

    determineChaosInfluencer() {
        if (Object.keys(this.chaosVotes).length === 0) {
            this.chaosInfluencer = null;
            return;
        }

        let maxVotes = -1;
        let potentialInfluencers = [];

        for (const playerId in this.chaosVotes) {
            if (this.chaosVotes[playerId] > maxVotes) {
                maxVotes = this.chaosVotes[playerId];
                potentialInfluencers = [playerId];
            } else if (this.chaosVotes[playerId] === maxVotes) {
                potentialInfluencers.push(playerId);
            }
        }

        if (potentialInfluencers.length > 0) {
            // Handle ties: for now, pick the first one if tied. Could be random.
            const newInfluencer = potentialInfluencers[0];
            if (this.chaosInfluencer !== newInfluencer) {
                // this.chaosInfluencer = newInfluencer; // This is now handled by setChaosInfluencer or locally if no network update
                // console.log(`Chaos Influencer is now: ${this.lobbyPlayers[this.chaosInfluencer]?.username || this.chaosInfluencer}`);

                // If this client is determining the influencer (e.g., master client or single player mode)
                // then it should announce it. Otherwise, it waits for network message.
                // For now, let's assume this client can announce if it detects a change.
                // This logic might be better if only one client (master) sends this message.
                if (this.networkManager && this.chaosInfluencer !== newInfluencer) {
                     this.networkManager.sendChaosInfluencerDetermined(newInfluencer);
                }
                // Set it locally for now. If a network message comes, setChaosInfluencer will align it.
                this.setChaosInfluencer(newInfluencer);
            }
        } else if (this.chaosInfluencer !== null) { // No one has votes, or all votes are zero
             if (this.networkManager) {
                this.networkManager.sendChaosInfluencerDetermined(null);
             }
             this.setChaosInfluencer(null);
        }

        // UI update is handled by setChaosInfluencer or at the end of handleChaosVote/castChaosVote
    }

    setChaosInfluencer(influencerId) {
        if (this.chaosInfluencer !== influencerId) {
            this.chaosInfluencer = influencerId;
            const influencerName = this.chaosInfluencer ? (this.lobbyPlayers[this.chaosInfluencer]?.username || this.chaosInfluencer) : "None";
            console.log(`Chaos Influencer set: ${influencerName}`);

            if (this.uiManager) {
                const playersArray = Object.values(this.lobbyPlayers);
                this.uiManager.updateChaosVoteList(playersArray, this.getPlayerId(), this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
                // updateChaosInfluencerDisplay is called within updateChaosVoteList

                if (this.getPlayerId() === this.chaosInfluencer && this.chaosInfluencer !== null) {
                    this.uiManager.showNotification("You are the new Chaos Influencer!");
                } else if (this.chaosInfluencer !== null) {
                     this.uiManager.showNotification(`${influencerName} is now the Chaos Influencer!`);
                } else {
                     this.uiManager.showNotification(`Chaos Influencer role is now vacant.`);
                }
            }
        }
    }

    // Call this when a player disconnects to clean up their votes
    handlePlayerDisconnect(disconnectedPlayerId) {
        const wasInfluencer = (this.chaosInfluencer === disconnectedPlayerId);

        if (this.localPlayerVotedFor === disconnectedPlayerId) {
            this.localPlayerVotedFor = null;
            // UI will need to re-enable vote buttons if UIManager handles that.
            // For now, updateChaosVoteList will show buttons enabled again.
        }

        // Remove the player from lobbyPlayers. Votes for them in `this.chaosVotes` can remain,
        // but they won't be displayed or win if not in `lobbyPlayers`.
        delete this.lobbyPlayers[disconnectedPlayerId];
        // Optionally, remove their entry from this.chaosVotes as well:
        // delete this.chaosVotes[disconnectedPlayerId];

        if (wasInfluencer) {
            this.chaosInfluencer = null; // Influencer is gone
            this.determineChaosInfluencer(); // Re-evaluate, potentially announcing a new one or null
        } else {
            // If the disconnected player wasn't the influencer, the current influencer might still be valid.
            // However, the voting landscape changed, so a re-evaluation might be good.
            this.determineChaosInfluencer();
        }


        // General UI update
        if (this.uiManager) {
            const playersArray = Object.values(this.lobbyPlayers);
            this.uiManager.updateLobbyPlayerList(playersArray);
            // Pass localPlayerVotedFor so UIManager knows if local player can vote again
            this.uiManager.updateChaosVoteList(playersArray, this.getPlayerId(), this.chaosVotes, this.chaosInfluencer, this.localPlayerVotedFor);
        }
    }
}
