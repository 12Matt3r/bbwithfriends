export class UIManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.setupEventListeners();
        this.setupWeaponSelection();
    }
    
    setupEventListeners() {
        document.getElementById('join-game').addEventListener('click', () => {
            this.gameCore.startGame();
        });
        
        document.getElementById('controls-btn').addEventListener('click', () => {
            this.showControls();
        });
        
        document.getElementById('play-again').addEventListener('click', () => {
            this.gameCore.restartGame();
        });
    }
    
    setupWeaponSelection() {
        // Add weapon selection UI to main menu
        const weaponSelector = document.createElement('div');
        weaponSelector.className = 'weapon-selector';
        weaponSelector.innerHTML = `
            <div class="weapon-title">SELECT LOADOUT</div>
            <div class="weapon-options">
                <button class="weapon-btn active" data-weapon="assault">ASSAULT</button>
                <button class="weapon-btn" data-weapon="scout">SCOUT</button>
                <button class="weapon-btn" data-weapon="heavy">HEAVY</button>
            </div>
        `;
        
        document.getElementById('main-menu').appendChild(weaponSelector);
        
        // Add weapon selection event listeners
        document.querySelectorAll('.weapon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.gameCore.player.setWeaponType(e.target.dataset.weapon);
            });
        });
    }
    
    showLoadingScreen() {
        document.getElementById('loading-screen').classList.remove('hidden');
    }
    
    hideLoadingScreen() {
        document.getElementById('loading-screen').classList.add('hidden');
    }
    
    showMainMenu() {
        document.getElementById('main-menu').classList.remove('hidden');
        this.updateCorruptionDisplay();
    }
    
    hideMainMenu() {
        document.getElementById('main-menu').classList.add('hidden');
    }
    
    showGameUI() {
        document.getElementById('game-ui').classList.remove('hidden');
    }
    
    hideGameUI() {
        document.getElementById('game-ui').classList.add('hidden');
    }
    
    showTreasureMapInteraction(interactionType) {
        const indicator = document.getElementById('interaction-indicator');
        
        if (interactionType === 'treasure_map_pickup') {
            indicator.innerHTML = '<div class="interaction-text">Press [F] to READ treasure map</div>';
            indicator.classList.remove('hidden');
        } else if (interactionType === 'hidden_doorway') {
            indicator.innerHTML = '<div class="interaction-text">Press [F] to enter hidden doorway</div>';
            indicator.classList.remove('hidden');
        }
    }
    
    hideTreasureMapInteraction() {
        document.getElementById('interaction-indicator').classList.add('hidden');
    }
    
    showTreasureMapAcquired() {
        const indicator = document.getElementById('treasure-map-status');
        indicator.innerHTML = '<div class="treasure-status">TREASURE MAP ACQUIRED - Find the hidden doorway!</div>';
        indicator.classList.remove('hidden');
    }
    
    hideTreasureMapStatus() {
        document.getElementById('treasure-map-status').classList.add('hidden');
    }
    
    activateRemembranceEffect(triggerTeam) {
        // Replace large pink overlay with small notification popup
        this.showSmallNotification(
            `REMEMBRANCE ACTIVATED`,
            `Team ${triggerTeam.toUpperCase()} revealed all player positions!`,
            /* @tweakable remembrance notification duration in milliseconds */
            5000
        );
        
        // Add visual effect to player list
        document.getElementById('player-list').classList.add('remembrance-active');
        setTimeout(() => {
            document.getElementById('player-list').classList.remove('remembrance-active');
        }, 10000);
    }
    
    showSmallNotification(title, message, duration = 3000) {
        const notification = document.createElement('div');
        /* @tweakable small notification positioning and styling */
        notification.className = 'small-notification';
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;
        
        document.getElementById('game-ui').appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }
    
    showGameOver(winningTeam, playerTeam, corruptionLevel) {
        const gameOverScreen = document.getElementById('game-over');
        const details = document.getElementById('game-over-details');
        
        let message;
        if (winningTeam === playerTeam) {
            message = `VICTORY ACHIEVED<br>Your team successfully extracted the memory fragments!<br>Corruption Level: ${corruptionLevel}%`;
        } else {
            message = `MEMORY LOST<br>The enemy team has captured your fragments.<br>Corruption Level: ${corruptionLevel}%`;
        }
        
        details.innerHTML = message;
        gameOverScreen.classList.remove('hidden');
        
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    }
    
    updateScoreDisplay() {
        const alphaScore = Math.floor(this.gameCore.gameState.scoreAlpha);
        const betaScore = Math.floor(this.gameCore.gameState.scoreBeta);
        
        document.getElementById('team-score').textContent = `FRAGMENTS: ${alphaScore}`;
        document.getElementById('enemy-team-score').textContent = `FRAGMENTS: ${betaScore}`;
        
        // Enhanced visual feedback for score changes
        /* @tweakable score display pulsing intensity */
        const pulseIntensity = 1.2;
        const scoreElements = [
            document.getElementById('team-score'),
            document.getElementById('enemy-team-score')
        ];
        
        scoreElements.forEach(element => {
            if (element && (alphaScore > this.lastAlphaScore || betaScore > this.lastBetaScore)) {
                element.style.transform = `scale(${pulseIntensity})`;
                element.style.textShadow = '0 0 20px currentColor';
                
                setTimeout(() => {
                    element.style.transform = 'scale(1)';
                    element.style.textShadow = '0 0 10px currentColor';
                }, 200);
            }
        });
        
        this.lastAlphaScore = alphaScore;
        this.lastBetaScore = betaScore;
    }
    
    updateHealthDisplay() {
        const healthFill = document.getElementById('health-fill');
        const healthText = document.getElementById('health-text');
        
        const healthPercent = (this.gameCore.player.health / this.gameCore.player.maxHealth) * 100;
        healthFill.style.width = `${healthPercent}%`;
        healthText.textContent = Math.ceil(this.gameCore.player.health);
        
        if (healthPercent > 60) {
            healthFill.style.background = 'linear-gradient(90deg, #00ff00, #88ff00)';
        } else if (healthPercent > 30) {
            healthFill.style.background = 'linear-gradient(90deg, #ffff00, #ff8800)';
        } else {
            healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4400)';
        }
    }
    
    updateAmmoDisplay() {
        document.getElementById('ammo-count').textContent = `${this.gameCore.player.ammo}/${this.gameCore.player.maxAmmo}`;
    }
    
    updateCorruptionDisplay() {
        const corruptionLevel = document.getElementById('corruption-level');
        const corruptionFill = document.querySelector('.corruption-fill');
        
        if (corruptionLevel) {
            corruptionLevel.textContent = `${Math.floor(this.gameCore.gameState.corruptionLevel)}%`;
        }
        
        if (corruptionFill) {
            corruptionFill.style.width = `${this.gameCore.gameState.corruptionLevel}%`;
        }
    }
    
    showFragmentIndicator() {
        document.getElementById('fragment-indicator').classList.remove('hidden');
    }
    
    hideFragmentIndicator() {
        document.getElementById('fragment-indicator').classList.add('hidden');
    }
    
    updatePlayerList() {
        const content = document.getElementById('player-list-content');
        content.innerHTML = '';
        
        Object.entries(this.gameCore.networkManager.room.peers).forEach(([id, peer]) => {
            const entry = document.createElement('div');
            entry.className = 'player-entry';
            
            const presence = this.gameCore.networkManager.room.presence[id] || {};
            const team = presence.team || 'unknown';
            
            entry.innerHTML = `
                <span class="player-name player-team-${team}">${peer.username}</span>
                <span class="player-health">${presence.health || 100}</span>
            `;
            
            content.appendChild(entry);
        });
    }
    
    addKillFeedEntry(text) {
        const killFeed = document.getElementById('kill-feed');
        const entry = document.createElement('div');
        entry.className = 'kill-entry';
        entry.textContent = text;
        
        killFeed.appendChild(entry);
        
        setTimeout(() => {
            if (entry.parentNode) {
                entry.parentNode.removeChild(entry);
            }
        }, 5000);
        
        while (killFeed.children.length > 5) {
            killFeed.removeChild(killFeed.firstChild);
        }
    }
    
    showControls() {
        alert(`CONTROLS:
        
MOVEMENT:
WASD - Swim
SHIFT (Right) - Sprint Swimming
Double-tap W - Sprint (toggle)
SHIFT (Left) - Crouch/Hide
SPACE - Jump/Float
MOUSE - Look around

COMBAT:
LEFT CLICK - Fire Jellyfish Blaster
RIGHT CLICK - Reload
R - Reload

CONSOLE:
~ (Tilda) - Open/Close Sandy's Computer

SANDY'S COMPUTER COMMANDS:
/distort.enemy() - Confuse enemy jellyfish
/distort.environment() - Warp Bikini Bottom
/reconstruct.path() - Reveal Krabby Patty locations
/jam.signal() - Jam underwater communications
/corrupt.system() - Increase corruption

OBJECTIVE:
Collect the Krabby Patty Secret at the center and bring it to your base!
+3 points/sec at your pineapple base
+1 point/sec at enemy base
First team to 50 points wins!

WARNING: Using Sandy's computer increases corruption levels in Bikini Bottom.`);
    }
    
    showVolatileFragmentWarning() {
        const warning = document.createElement('div');
        warning.className = 'volatile-warning';
        warning.innerHTML = `
            <div class="warning-text">FRAGMENT GOING CRITICAL!</div>
            <div class="warning-subtitle">Return to base immediately or it will explode!</div>
        `;
        
        document.getElementById('game-ui').appendChild(warning);
        
        /* @tweakable volatile fragment warning display duration */
        const warningDuration = 4000;
        setTimeout(() => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, warningDuration);
        
        // Add pulsing effect to the warning
        let pulseCount = 0;
        const pulseInterval = setInterval(() => {
            if (warning.parentNode && pulseCount < 8) {
                warning.style.transform = pulseCount % 2 === 0 ? 'scale(1.1)' : 'scale(1)';
                pulseCount++;
            } else {
                clearInterval(pulseInterval);
            }
        }, 250);
    }
    
    showLockdownMode() {
        const lockdown = document.getElementById('lockdown-indicator');
        if (lockdown) return; // Already showing
        
        const indicator = document.createElement('div');
        indicator.id = 'lockdown-indicator';
        indicator.className = 'lockdown-mode';
        indicator.innerHTML = `
            <div class="lockdown-text">LOCKDOWN MODE ACTIVE</div>
            <div class="lockdown-subtitle">All players can see your location!</div>
        `;
        
        document.getElementById('game-ui').appendChild(indicator);
    }
    
    showChaosEvent(eventText) {
        const chaos = document.createElement('div');
        chaos.className = 'chaos-event';
        chaos.innerHTML = `
            <div class="chaos-text">${eventText}</div>
        `;
        
        document.getElementById('game-ui').appendChild(chaos);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (chaos.parentNode) {
                chaos.parentNode.removeChild(chaos);
            }
        }, 5000);
    }
    
    hideChaosEvent() {
        const chaos = document.querySelector('.chaos-event');
        if (chaos && chaos.parentNode) {
            chaos.parentNode.removeChild(chaos);
        }
    }
    
    showBuffIndicator(buffType, duration) {
        const indicator = document.createElement('div');
        indicator.className = `buff-indicator buff-${buffType}`;
        indicator.innerHTML = `
            <div class="buff-name">${buffType.replace('_', ' ').toUpperCase()}</div>
            <div class="buff-timer">${duration}s</div>
        `;
        
        document.getElementById('game-ui').appendChild(indicator);
        
        // Update timer
        const startTime = Date.now();
        const updateTimer = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const remaining = Math.max(0, duration - elapsed);
            
            const timerElement = indicator.querySelector('.buff-timer');
            if (timerElement) {
                timerElement.textContent = `${Math.ceil(remaining)}s`;
            }
            
            if (remaining > 0) {
                requestAnimationFrame(updateTimer);
            } else {
                this.removeBuffIndicator(buffType);
            }
        };
        updateTimer();
    }
    
    removeBuffIndicator(buffType) {
        const indicator = document.querySelector(`.buff-${buffType}`);
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }
    
    showInteractionPrompt(text) {
        const prompt = document.getElementById('interaction-prompt');
        if (prompt) {
            prompt.textContent = text;
            return;
        }
        
        const newPrompt = document.createElement('div');
        newPrompt.id = 'interaction-prompt';
        newPrompt.className = 'interaction-prompt';
        newPrompt.textContent = text;
        
        document.getElementById('game-ui').appendChild(newPrompt);
    }
    
    hideInteractionPrompt() {
        const prompt = document.getElementById('interaction-prompt');
        if (prompt && prompt.parentNode) {
            prompt.parentNode.removeChild(prompt);
        }
    }
    
    updateWeaponDisplay(weaponType) {
        /* @tweakable universal H20pew weapon display names for all classes */
        const weaponNames = {
            assault: 'H20PEW ASSAULT',
            scout: 'H20PEW SCOUT', 
            heavy: 'H20PEW HEAVY'
        };
        
        document.getElementById('weapon-name').textContent = weaponNames[weaponType] || 'H20PEW BLASTER';
    }
    
    lastAlphaScore = 0;
    lastBetaScore = 0;
}