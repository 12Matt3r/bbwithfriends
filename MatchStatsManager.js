// MatchStatsManager.js
export class MatchStatsManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        // Direct reference to gameState.matchStats for convenience.
        // Assumes gameState.matchStats is already initialized by GameState constructor.
        if (this.gameCore && this.gameCore.gameState && this.gameCore.gameState.matchStats) {
            this.matchStats = this.gameCore.gameState.matchStats;
        } else {
            console.error("MatchStatsManager: gameState.matchStats not available! Initializing locally, but this is not ideal.");
            // Fallback initialization if GameState didn't do it, though GameState should be source of truth.
            this.matchStats = {
                timeline: [],
                fragmentHoldTimes: {},
                commandUsage: {},
                longestHolder: { playerId: null, username: null, time: 0 },
                mostCommandsPlayer: { playerId: null, username: null, count: 0 }
            };
            // If gameCore and gameState exist, try to assign this fallback to it.
            if (this.gameCore && this.gameCore.gameState) {
                this.gameCore.gameState.matchStats = this.matchStats;
            }
        }
    }

    addTimelineEvent(message, type = 'info') {
        if (!this.matchStats) return;
        const gameTime = this.gameCore && this.gameCore.gameState ? this.gameCore.gameState.gameTime : (Date.now() / 1000); // Fallback to system time if gameTime not available

        this.matchStats.timeline.push({ time: parseFloat(gameTime.toFixed(1)), message, type });
        // Optional: Limit timeline length
        // const MAX_TIMELINE_EVENTS = 100;
        // if (this.matchStats.timeline.length > MAX_TIMELINE_EVENTS) {
        //     this.matchStats.timeline.shift();
        // }
    }

    recordCommandUse(playerId, commandName) {
        if (!this.matchStats || !playerId || !commandName) return;

        const username = this.gameCore.getPlayerName ? this.gameCore.getPlayerName(playerId) : playerId;

        if (!this.matchStats.commandUsage[playerId]) {
            this.matchStats.commandUsage[playerId] = { username: username, count: 0, commands: {} };
        }
        // Ensure username is up-to-date if it was 'Unknown' initially
        if (this.matchStats.commandUsage[playerId].username !== username && username !== playerId) {
             this.matchStats.commandUsage[playerId].username = username;
        }

        this.matchStats.commandUsage[playerId].count++;
        this.matchStats.commandUsage[playerId].commands[commandName] = (this.matchStats.commandUsage[playerId].commands[commandName] || 0) + 1;
    }

    // Called at game end to gather all player stats
    compilePlayerStats() {
        if (!this.matchStats || !this.gameCore || !this.gameCore.player) return;

        // For local player
        if (typeof this.gameCore.player.getMatchStats === 'function') {
            const localStats = this.gameCore.player.getMatchStats();
            if (localStats && localStats.playerId) {
                 // Ensure username is current
                localStats.username = this.gameCore.getPlayerName ? this.gameCore.getPlayerName(localStats.playerId) : localStats.playerId;
                this.matchStats.fragmentHoldTimes[localStats.playerId] = localStats;
            }
        }

        // For remote players:
        // This part currently relies on the assumption that remote players' stats (especially totalTimeHoldingFragment)
        // would be sent over the network and populated into some structure accessible here.
        // Since that mechanism isn't built in this subtask, this loop might not find much.
        // For now, any data already in `this.gameCore.otherPlayers` (if we were to store stats there) could be processed.
        // However, `totalTimeHoldingFragment` is calculated locally by each Player object.
        // So, this is a placeholder for future network integration of stats.
        if (this.gameCore.otherPlayers) {
            this.gameCore.otherPlayers.forEach((playerData, playerId) => {
                if (!this.matchStats.fragmentHoldTimes[playerId]) { // If not already added (e.g. local player)
                    // We don't have their `totalTimeHoldingFragment` directly from `playerData`
                    // This would need to be sent via network, e.g., at game end or periodically.
                    // For now, we'll just create a placeholder if they don't exist.
                     const username = this.gameCore.getPlayerName ? this.gameCore.getPlayerName(playerId) : playerId;
                    this.matchStats.fragmentHoldTimes[playerId] = {
                        playerId: playerId,
                        username: username,
                        totalTimeHoldingFragment: 0 // Placeholder, real data would come from network
                    };
                } else if (this.matchStats.fragmentHoldTimes[playerId].username !== (this.gameCore.getPlayerName ? this.gameCore.getPlayerName(playerId) : playerId)) {
                    // Update username if it changed (e.g. from default to actual)
                    this.matchStats.fragmentHoldTimes[playerId].username = this.gameCore.getPlayerName ? this.gameCore.getPlayerName(playerId) : playerId;
                }
            });
        }
    }

    calculateSummaryStats() {
        if (!this.matchStats) return;

        // Longest Holder
        let longestTime = 0;
        let longestHolderId = null;
        for (const playerId in this.matchStats.fragmentHoldTimes) {
            const stat = this.matchStats.fragmentHoldTimes[playerId];
            if (stat.totalTimeHoldingFragment > longestTime) {
                longestTime = stat.totalTimeHoldingFragment;
                longestHolderId = playerId;
            }
        }
        if (longestHolderId) {
            const username = this.matchStats.fragmentHoldTimes[longestHolderId]?.username || (this.gameCore.getPlayerName ? this.gameCore.getPlayerName(longestHolderId) : longestHolderId);
            this.matchStats.longestHolder = { playerId: longestHolderId, username: username, time: parseFloat(longestTime.toFixed(1)) };
        } else {
             this.matchStats.longestHolder = { playerId: null, username: null, time: 0 };
        }


        // Most Commands Player
        let maxCommands = 0;
        let mostCommandsPlayerId = null;
        for (const playerId in this.matchStats.commandUsage) {
            const usage = this.matchStats.commandUsage[playerId];
            if (usage.count > maxCommands) {
                maxCommands = usage.count;
                mostCommandsPlayerId = playerId;
            }
        }
        if (mostCommandsPlayerId) {
             const username = this.matchStats.commandUsage[mostCommandsPlayerId]?.username || (this.gameCore.getPlayerName ? this.gameCore.getPlayerName(mostCommandsPlayerId) : mostCommandsPlayerId);
            this.matchStats.mostCommandsPlayer = { playerId: mostCommandsPlayerId, username: username, count: maxCommands };
        } else {
            this.matchStats.mostCommandsPlayer = { playerId: null, username: null, count: 0 };
        }
    }
}
