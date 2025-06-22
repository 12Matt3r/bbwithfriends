// StreamerDataManager.js
export class StreamerDataManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.MAX_RECENT_EVENTS = 5; // Max number of recent events to store

        // Expose streamerData globally for hypothetical overlay access
        // Ensure gameState.streamerData is initialized before this point
        if (this.gameCore && this.gameCore.gameState && this.gameCore.gameState.streamerData) {
            window.streamerData = this.gameCore.gameState.streamerData;
        } else {
            console.error("StreamerDataManager: gameState.streamerData not initialized when trying to expose to window.");
            // As a fallback, initialize it here if not present, though it should be in GameState
            if (this.gameCore && this.gameCore.gameState) {
                 this.gameCore.gameState.streamerData = {
                    chaosInfluencerName: 'N/A',
                    corruptionLevel: 0,
                    recentEvents: []
                };
                window.streamerData = this.gameCore.gameState.streamerData;
            } else {
                // If gameCore or gameState is missing, this is a more critical issue
                window.streamerData = { chaosInfluencerName: 'N/A', corruptionLevel: 0, recentEvents: [], error: "GameCore or GameState not available" };
            }
        }
    }

    update() {
        if (!this.gameCore || !this.gameCore.gameState || !this.gameCore.gameState.streamerData) {
            // console.warn("StreamerDataManager.update: GameCore or GameState not fully available.");
            return;
        }

        // Update Chaos Influencer Name
        const ciId = this.gameCore.gameState.chaosInfluencerId;
        if (ciId && this.gameCore.networkManager && this.gameCore.networkManager.room && this.gameCore.networkManager.room.presence && this.gameCore.networkManager.room.presence[ciId]) {
            this.gameCore.gameState.streamerData.chaosInfluencerName = this.gameCore.networkManager.room.presence[ciId].username || 'Unknown Influencer';
        } else if (ciId) {
            // If ciId exists but presence data doesn't (e.g. player disconnected), try getUsername as fallback
            this.gameCore.gameState.streamerData.chaosInfluencerName = (this.gameCore.networkManager && typeof this.gameCore.networkManager.getUsername === 'function' ? this.gameCore.networkManager.getUsername(ciId) : null) || `ID: ${ciId.substring(0,6)}`;
        }
        else {
            this.gameCore.gameState.streamerData.chaosInfluencerName = 'N/A';
        }

        // Update Corruption Level
        this.gameCore.gameState.streamerData.corruptionLevel = Math.round(this.gameCore.gameState.corruptionLevel);

        // The recentEvents array is updated by addStreamerEvent directly.
        // No need to explicitly update window.streamerData if it's a direct reference to gameState.streamerData
    }

    addStreamerEvent(message) {
        if (!this.gameCore || !this.gameCore.gameState || !this.gameCore.gameState.streamerData) {
            console.warn("StreamerDataManager.addStreamerEvent: GameCore or GameState not fully available.");
            return;
        }

        const events = this.gameCore.gameState.streamerData.recentEvents;
        const newEvent = { message: message, timestamp: Date.now(), id: Date.now() + Math.random().toString(16).slice(2) }; // Add unique ID for potential key in UI

        events.push(newEvent);
        if (events.length > this.MAX_RECENT_EVENTS) {
            events.shift(); // Remove the oldest event
        }
        // console.log(`Streamer Event Added: ${message}`); // Log for dev visibility

        // Since window.streamerData directly references this.gameCore.gameState.streamerData,
        // changes to recentEvents are automatically reflected.
    }
}
