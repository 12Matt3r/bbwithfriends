export class UIManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        // DOM elements for lobby
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.lobbyPlayerList = document.getElementById('lobby-player-list');
        this.avatarSelect = document.getElementById('avatar-select');
        this.teamColorSelect = document.getElementById('team-color-select');
        this.readyButton = document.getElementById('ready-button');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInputField = document.getElementById('chat-input-field');
        this.sendChatButton = document.getElementById('send-chat-button');
        // Chaos Vote elements
        this.chaosVoteList = document.getElementById('chaos-vote-list');
        this.chaosInfluencerDisplay = document.getElementById('chaos-influencer-display');
        this.chaosInfluencerName = document.getElementById('chaos-influencer-name');

        // Corruption and Kill Feed
        this.corruptionDisplay = document.getElementById('corruption-level'); // Target the element showing the percentage
        this.killFeedContainer = document.getElementById('kill-feed');


        this.setupEventListeners();
        this.setupWeaponSelection();
    }
    
    setupEventListeners() {
        // Main Menu
        document.getElementById('join-game').addEventListener('click', () => {
            // This will likely transition to the lobby first, then start game
            // For now, let's assume it shows the lobby
            this.hideMainMenu();
            this.showLobbyScreen();
            // this.gameCore.startGame(); // Original line, might be handled by LobbyManager later
        });
        
        document.getElementById('controls-btn').addEventListener('click', () => {
            this.showControls();
        });
        
        document.getElementById('play-again').addEventListener('click', () => {
            this.gameCore.restartGame();
        });

        // Lobby Screen listeners
        if (this.avatarSelect) {
            this.avatarSelect.addEventListener('change', (e) => {
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.handleAvatarSelection(e.target.value);
                }
            });
        }

        if (this.teamColorSelect) {
            this.teamColorSelect.addEventListener('change', (e) => {
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.handleTeamColorSelection(e.target.value);
                }
            });
        }

        if (this.readyButton) {
            this.readyButton.addEventListener('click', () => {
                if (this.gameCore.lobbyManager) {
                    this.gameCore.lobbyManager.handleReadyButtonClick();
                    // Toggle visual state of the ready button
                    this.readyButton.classList.toggle('ready');
                    this.readyButton.textContent = this.readyButton.classList.contains('ready') ? 'Unready' : 'Ready';
                }
            });
        }

        if (this.sendChatButton) {
            this.sendChatButton.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }

        if (this.chatInputField) {
            this.chatInputField.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        // Chaos Vote listener
        if (this.chaosVoteList) {
            this.chaosVoteList.addEventListener('click', (e) => {
                if (e.target && e.target.classList.contains('vote-button')) {
                    const votedPlayerId = e.target.dataset.playerId;
                    if (votedPlayerId && this.gameCore.lobbyManager) {
                        this.gameCore.lobbyManager.castChaosVote(votedPlayerId);
                        // Optionally disable the button or all vote buttons for this user here
                        // e.g., e.target.disabled = true;
                        // or this.disableAllVoteButtons();
                    }
                }
            });
        }

        // Class Selection listeners
        const classButtons = document.querySelectorAll('.class-select-button');
        classButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                if (this.gameCore.lobbyManager) {
                    const selectedClass = event.target.dataset.class;
                    classButtons.forEach(btn => btn.classList.remove('selected'));
                    event.target.classList.add('selected');
                    this.gameCore.lobbyManager.handleClassSelection(selectedClass);
                }
            });
        });
    }

    disableAllVoteButtons() {
        if (!this.chaosVoteList) return;
        const buttons = this.chaosVoteList.querySelectorAll('.vote-button');
        buttons.forEach(button => button.disabled = true);
    }

    sendChatMessage() {
        const message = this.chatInputField.value.trim();
        if (message && this.gameCore.networkManager) {
            // Assuming NetworkManager will have a method to send chat messages
            this.gameCore.networkManager.sendLobbyChatMessage(message);
            this.chatInputField.value = '';
        }
        // For local display until network part is fully up:
        // this.addChatMessage('You', message);
    }

    addChatMessage(playerName, message, isSystemMessage = false) {
        if (!this.chatMessages) return;
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message');
        if (isSystemMessage) {
            messageElement.classList.add('system-message');
            messageElement.innerHTML = `<em>${message}</em>`;
        } else {
            messageElement.innerHTML = `<span class="player-name">${playerName}:</span> ${this.escapeHTML(message)}`;
        }
        this.chatMessages.appendChild(messageElement);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight; // Scroll to bottom
    }

    // Helper to prevent XSS from chat messages
    escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
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

    showLobbyScreen() {
        if (this.lobbyScreen) {
            this.lobbyScreen.classList.remove('hidden');
            // Potentially refresh player list or other lobby elements here
            if(this.gameCore.lobbyManager) {
                // Example: Fetch initial lobby state if needed
                // this.gameCore.lobbyManager.requestLobbyState();
            }
        }
        this.hideMainMenu(); // Ensure main menu is hidden
        this.hideGameUI(); // Ensure game UI is hidden
    }

    hideLobbyScreen() {
        if (this.lobbyScreen) {
            this.lobbyScreen.classList.add('hidden');
        }
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
    
    updateCorruptionDisplay() { // Parameter 'level' is not used, uses gameCore.gameState
        const corruptionLevelValue = Math.floor(this.gameCore.gameState.corruptionLevel);
        if (this.corruptionDisplay) { // This is #corruption-level
            this.corruptionDisplay.textContent = `${corruptionLevelValue}%`;
        }
        
        const corruptionFill = document.querySelector('.corruption-fill'); // This is for the main menu bar
        if (corruptionFill) {
            corruptionFill.style.width = `${corruptionLevelValue}%`;
        }
        // If a separate in-game UI bar for corruption needs update, add here.
    }

    // Modified addKillFeedEntry from previous version to match current plan
    addKillFeedEntry(killerName, victimName, weaponUsed) {
        if (!this.killFeedContainer) return;

        const messageEl = document.createElement('div');
        messageEl.classList.add('kill-feed-message');

        let message = `${killerName} eliminated ${victimName}`;
        if (weaponUsed && weaponUsed !== 'Unknown') {
            message += ` (with ${weaponUsed})`;
        }
        messageEl.textContent = message;

        // Prepend to have new messages at the top if flex-direction: column (or bottom if column-reverse)
        this.killFeedContainer.insertBefore(messageEl, this.killFeedContainer.firstChild);

        const MAX_KILL_FEED_MESSAGES = 5;
        if (this.killFeedContainer.children.length > MAX_KILL_FEED_MESSAGES) {
            this.killFeedContainer.removeChild(this.killFeedContainer.lastChild);
        }

        setTimeout(() => {
            messageEl.classList.add('fade-out');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.remove();
                }
            }, 500); // CSS transition time
        }, 5000); // Message visible time
    }
    
    showFragmentIndicator() {
        document.getElementById('fragment-indicator').classList.remove('hidden');
    }
    
    hideFragmentIndicator() {
        document.getElementById('fragment-indicator').classList.add('hidden');
    }
    
    updatePlayerList() { // This is for the IN-GAME player list
        const content = document.getElementById('player-list-content');
        if (!content) return;
        content.innerHTML = '';
        
        // This part needs actual player data from NetworkManager or GameState
        // For now, let's assume it works with gameCore.networkManager.room.peers
        if (this.gameCore.networkManager && this.gameCore.networkManager.room && this.gameCore.networkManager.room.peers) {
            Object.entries(this.gameCore.networkManager.room.peers).forEach(([id, peer]) => {
                const entry = document.createElement('div');
                entry.className = 'player-entry';

                const presence = this.gameCore.networkManager.room.presence[id] || {};
                const team = presence.team || 'unknown'; // Default team if not specified

                entry.innerHTML = `
                    <span class="player-name player-team-${team}">${peer.username || 'Player'}</span>
                    <span class="player-health">${presence.health || 100}</span>
                `;

                content.appendChild(entry);
            });
        }
    }

    updateLobbyPlayerList(playersData) { // Renamed arg from players to playersData for consistency
        if (!this.lobbyPlayerList) return;
        this.lobbyPlayerList.innerHTML = ''; // Clear existing list

        if (!playersData || playersData.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'Waiting for players...';
            emptyItem.style.opacity = '0.7';
            this.lobbyPlayerList.appendChild(emptyItem);
            return;
        }

        playersData.forEach(player => {
            const playerItem = document.createElement('li');
            playerItem.style.display = 'flex';
            playerItem.style.justifyContent = 'space-between';
            playerItem.style.alignItems = 'center';
            playerItem.style.padding = '0.4rem 0.2rem';
            playerItem.style.borderBottom = '1px solid rgba(0, 170, 255, 0.2)';

            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.username || player.id;
            nameSpan.style.flexGrow = '1';

            const classSpan = document.createElement('span');
            classSpan.textContent = `(${player.playerClass || 'N/A'})`; // Display player class
            classSpan.style.margin = '0 0.5rem';
            classSpan.style.fontSize = '0.8em';
            classSpan.style.fontStyle = 'italic';
            classSpan.style.opacity = '0.7';


            const avatarSpan = document.createElement('span');
            avatarSpan.textContent = `(${player.avatar || '???'})`;
            avatarSpan.style.margin = '0 0.5rem';
            avatarSpan.style.fontSize = '0.8em';
            avatarSpan.style.opacity = '0.8';

            const teamColorSpan = document.createElement('span');
            teamColorSpan.textContent = `[${player.teamColor || 'N/A'}]`;
            teamColorSpan.style.color = player.teamColor || 'var(--primary-color)';
            teamColorSpan.style.fontWeight = 'bold';
            teamColorSpan.style.margin = '0 0.5rem';
            teamColorSpan.style.fontSize = '0.8em';

            const readySpan = document.createElement('span');
            readySpan.textContent = player.isReady ? '✅ Ready' : '⏳ Not Ready';
            readySpan.style.color = player.isReady ? 'lime' : 'orange';
            readySpan.style.fontWeight = player.isReady ? 'bold' : 'normal';
            readySpan.style.minWidth = '100px';
            readySpan.style.textAlign = 'right';

            playerItem.appendChild(nameSpan);
            playerItem.appendChild(classSpan); // Added class display
            playerItem.appendChild(avatarSpan);
            playerItem.appendChild(teamColorSpan);
            playerItem.appendChild(readySpan);
            
            if (this.gameCore.lobbyManager && player.id === this.gameCore.lobbyManager.getPlayerId()) {
                playerItem.style.background = 'rgba(0, 170, 255, 0.1)';
            }

            this.lobbyPlayerList.appendChild(playerItem);
        });
    }

    updateChaosVoteList(playersData, localPlayerId, votes, chaosInfluencerId, localPlayerVotedFor) {
        if (!this.chaosVoteList) return;
        this.chaosVoteList.innerHTML = '';

        if (!playersData || playersData.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = 'No players to vote for.';
            this.chaosVoteList.appendChild(emptyItem);
            this.updateChaosInfluencerDisplay(null, playersData); // Clear display
            return;
        }

        playersData.forEach(player => { // Assumes playersData is an array
            const voteItem = document.createElement('li');
            // Styles for voteItem are in CSS, but can add inline if needed

            const nameSpan = document.createElement('span');
            nameSpan.textContent = player.username || player.id;
            if (player.id === chaosInfluencerId) {
                nameSpan.textContent += " 👑"; // Crown for influencer
                nameSpan.style.color = 'var(--secondary-color)';
                nameSpan.style.fontWeight = 'bold';
            }
            nameSpan.style.flexGrow = '1';

            const voteCountSpan = document.createElement('span');
            voteCountSpan.className = 'vote-count';
            voteCountSpan.textContent = `(${(votes && votes[player.id]) || 0} votes)`;

            voteItem.appendChild(nameSpan);
            voteItem.appendChild(voteCountSpan);

            if (player.id !== localPlayerId) {
                const voteButton = document.createElement('button');
                voteButton.className = 'vote-button';
                voteButton.dataset.playerId = player.id;
                voteButton.textContent = 'Vote';
                if (localPlayerVotedFor) { // If local player has already voted for anyone
                    voteButton.disabled = true;
                }
                voteItem.appendChild(voteButton);
            } else {
                // Placeholder for alignment or local player indicator
                const placeholder = document.createElement('span');
                placeholder.style.minWidth = '60px'; // Approx width of vote button
                voteItem.appendChild(placeholder);
            }
            this.chaosVoteList.appendChild(voteItem);
        });
        this.updateChaosInfluencerDisplay(chaosInfluencerId, playersData);
    }

    updateChaosInfluencerDisplay(chaosInfluencerId, playersData) {
        if (!this.chaosInfluencerDisplay || !this.chaosInfluencerName) return;

        if (chaosInfluencerId) {
            const influencer = playersData.find(p => p.id === chaosInfluencerId);
            if (influencer) {
                this.chaosInfluencerName.textContent = influencer.username || influencer.id;
                this.chaosInfluencerName.style.color = 'var(--secondary-color)';
                this.chaosInfluencerDisplay.classList.remove('hidden');
            } else {
                this.chaosInfluencerName.textContent = 'Undetermined';
                this.chaosInfluencerDisplay.classList.add('hidden');
            }
        } else {
            this.chaosInfluencerName.textContent = 'None yet';
            // Keep it visible or hide based on preference, for now, show "None yet"
            this.chaosInfluencerDisplay.classList.remove('hidden');
        }
    }
    
    // Old addKillFeedEntry(text) is replaced by the new one above.

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

    showNotification(message) {
        const existingNotification = document.getElementById('game-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notificationElement = document.createElement('div');
        notificationElement.id = 'game-notification';
        notificationElement.textContent = message;
        document.body.appendChild(notificationElement); // Append to body to ensure it's on top

        setTimeout(() => {
            if (notificationElement.parentNode) {
                notificationElement.remove();
            }
        }, 3000); // Display for 3 seconds
    }
}