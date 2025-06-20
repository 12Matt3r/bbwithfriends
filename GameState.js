export class GameState {
    constructor() {
        this.isGameStarted = false;
        this.isConsoleOpen = false;
        this.corruptionLevel = 0;
        this.scoreAlpha = 0;
        this.scoreBeta = 0;
        this.gameTime = 0;
        /* @tweakable score needed to win the game */
        this.winScore = 50;
    }
    
    reset() {
        this.isGameStarted = false;
        this.corruptionLevel = 0;
        this.scoreAlpha = 0;
        this.scoreBeta = 0;
        this.gameTime = 0;
    }
    
    addScore(team, points) {
        if (team === 'alpha') {
            this.scoreAlpha += points;
        } else {
            this.scoreBeta += points;
        }
    }
    
    checkWinCondition() {
        if (this.scoreAlpha >= this.winScore) {
            return 'alpha';
        } else if (this.scoreBeta >= this.winScore) {
            return 'beta';
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