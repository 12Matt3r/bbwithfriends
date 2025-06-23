import { TEAM_IDS, GAME_PHASES } from './Constants.js'; // Added GAME_PHASES for future use

export class GameState {
    constructor() {
        this.isGameStarted = false;
        this.isConsoleOpen = false;
        this.corruptionLevel = 0;
        this.scoreAlpha = 0;
        this.scoreBeta = 0;
        this.alphaScoreAccumulator = 0; // For time-based scoring
        this.betaScoreAccumulator = 0;  // For time-based scoring
        this.chaosInfluencerId = null;  // ID of the current Chaos Influencer
        this.isOverheatModeActive = false; // Added for Overheat Mode
        this.nextOverheatExplosionTime = 0; // For GameCore to manage timing
        this.nextHallucinationTime = 0;   // For GameCore to manage timing
        this.gameTime = 0;
        this.isMeltPhaseActive = false; // Added for Melt Phase
        this.confessionalLogs = []; // Added for Confessional Booths
        this.streamerData = {
            chaosInfluencerName: 'N/A',
            corruptionLevel: 0,
            recentEvents: []
        };
        this.matchStats = {
            timeline: [],
            fragmentHoldTimes: {}, // { playerId: { username: "name", totalTimeHoldingFragment: 0 } }
            commandUsage: {},      // { playerId: { username: "name", count: 0, commands: {cmdName: count} } }
            longestHolder: { playerId: null, username: null, time: 0 },
            mostCommandsPlayer: { playerId: null, username: null, count: 0 }
        };
        /* @tweakable score needed to win the game */
        this.winScore = 50;
    }
    
    reset() {
        this.isGameStarted = false;
        this.corruptionLevel = 0;
        this.scoreAlpha = 0;
        this.scoreBeta = 0;
        this.alphaScoreAccumulator = 0;
        this.betaScoreAccumulator = 0;
        // this.chaosInfluencerId = null; // Should persist or be reset based on game flow, typically reset with lobby
        this.isOverheatModeActive = false; // Reset Overheat Mode
        this.nextOverheatExplosionTime = 0;
        this.nextHallucinationTime = 0;
        this.gameTime = 0;
        this.isMeltPhaseActive = false; // Reset Melt Phase
        this.confessionalLogs = []; // Reset Confessional Logs
        this.streamerData = {
            chaosInfluencerName: 'N/A',
            corruptionLevel: 0,
            recentEvents: []
        };
        this.matchStats = {
            timeline: [],
            fragmentHoldTimes: {},
            commandUsage: {},
            longestHolder: { playerId: null, username: null, time: 0 },
            mostCommandsPlayer: { playerId: null, username: null, count: 0 }
        };
    }
    
    // addScore is kept as direct score addition is still used for some events,
    // but time-based scoring will use accumulators.
    addScore(team, points) {
        if (team === TEAM_IDS.ALPHA) {
            this.scoreAlpha += points;
        } else if (team === TEAM_IDS.BETA) { // Added else if for clarity
            this.scoreBeta += points;
        }
    }
    
    checkWinCondition() {
        if (this.scoreAlpha >= this.winScore) {
            return TEAM_IDS.ALPHA;
        } else if (this.scoreBeta >= this.winScore) {
            return TEAM_IDS.BETA;
        }
        return null;
    }
    
    addCorruption(amount) {
        /* @tweakable maximum corruption level before effects become severe */
        const maxCorruption = 100;
        this.corruptionLevel = Math.min(maxCorruption, this.corruptionLevel + amount);
        return this.corruptionLevel;
    }
    
    updateTime(deltaTime) {
        this.gameTime += deltaTime;
    }
}