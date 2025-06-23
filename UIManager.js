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
        this.corruptionDisplay = document.getElementById('corruption-level'); // This is the element for the text "0%"
        this.killFeedContainer = document.getElementById('kill-feed-container'); // Corrected ID

        // Console Elements
        this.consoleContainer = document.getElementById('console'); // Using existing ID
        this.consoleLog = document.getElementById('console-output');   // Using existing ID
        this.consoleInput = document.getElementById('console-input');   // Using existing ID
        this.isConsoleOpen = false;

        // Map Reveal Elements & State
        this.mapRevealOverlay = document.getElementById('map-reveal-overlay');
        this.mapRevealPlayerIconsContainer = document.getElementById('map-reveal-player-icons');
        this.mapRevealTimerDisplay = document.getElementById('map-reveal-timer');
        this.mapRevealActive = false;
        this.mapRevealInterval = null;
        this.mapRevealEndTime = 0;
        // Define map bounds (minX, maxX, minZ, maxZ) for your game world.
        // EXAMPLE VALUES - ADJUST TO YOUR ACTUAL MAP DIMENSIONS!
        this.mapWorldBounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };

        // Confessional Booth Elements & State
        this.confessionalPrompt = document.getElementById('confessional-prompt');
        this.confessionalInputOverlay = document.getElementById('confessional-input-overlay');
        this.confessionalTextInput = document.getElementById('confessional-text-input');
        this.submitConfessionalButton = document.getElementById('submit-confessional-button');
        this.cancelConfessionalButton = document.getElementById('cancel-confessional-button');
        this.currentBoothIdForConfessional = null; // To store which booth triggered the input
        this.isConfessionalInputActive = false; // To track if the input overlay is shown

        // Match Summary Screen Elements
        this.matchSummaryScreen = document.getElementById('match-summary-screen');
        this.summaryLongestHolder = document.getElementById('summary-longest-holder');
        this.summaryMostCommands = document.getElementById('summary-most-commands');
        this.summaryConfessionalList = document.getElementById('summary-confessional-list');
        this.summaryTimelineLog = document.getElementById('summary-timeline-log');
        this.copyTimelineButton = document.getElementById('copy-timeline-button');
        this.summaryScreenshotContainer = document.getElementById('summary-screenshot-container');
        this.summaryScreenshotImg = document.getElementById('summary-screenshot-img');
        this.downloadScreenshotLink = document.getElementById('download-screenshot-link');
        this.closeSummaryButton = document.getElementById('close-summary-button');


        this.setupEventListeners();
        this.setupWeaponSelection();
        this.setupConsoleInputListener();
        this.setupConfessionalEventListeners();
        this.setupMatchSummaryEventListeners();
    }
    
    setupEventListeners() {
        // Main Menu
        document.getElementById('join-game').addEventListener('click', () => {
            // Transition to lobby is handled by GameCore
            this.gameCore.transitionToLobby();
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

    setupConfessionalEventListeners() {
        const handleSubmit = (event) => {
            event.preventDefault(); // Prevent potential double event / default actions
            const quoteText = this.confessionalTextInput.value.trim();
            if (quoteText && this.currentBoothIdForConfessional) {
                if (this.gameCore && typeof this.gameCore.recordConfessional === 'function') {
                    this.gameCore.recordConfessional(quoteText, this.currentBoothIdForConfessional);
                }
            }
            this.hideConfessionalInput();
        };

        if (this.submitConfessionalButton) {
            this.submitConfessionalButton.addEventListener('click', handleSubmit);
            this.submitConfessionalButton.addEventListener('touchend', handleSubmit);
        }

        const handleCancel = (event) => {
            event.preventDefault();
            this.hideConfessionalInput();
        };

        if (this.cancelConfessionalButton) {
            this.cancelConfessionalButton.addEventListener('click', handleCancel);
            this.cancelConfessionalButton.addEventListener('touchend', handleCancel);
        }

        // Optional: Allow Escape to also cancel the confessional input
        if (this.confessionalTextInput) {
            this.confessionalTextInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.isConfessionalInputActive) { // Check if input is active
                    this.hideConfessionalInput();
                }
            });
        }
    }

    showConfessionalPrompt(boothId) {
        if (this.confessionalPrompt) {
            this.confessionalPrompt.style.display = 'block';
            this.currentBoothIdForConfessional = boothId; // Store the booth ID
        }
    }

    hideConfessionalPrompt() {
        if (this.confessionalPrompt) {
            this.confessionalPrompt.style.display = 'none';
            // Don't nullify currentBoothIdForConfessional here,
            // InputManager might need it briefly after prompt is hidden and before input is shown.
        }
    }

    isConfessionalInputVisible() { // Renamed from isConfessionalInputActive for clarity of function
        return this.isConfessionalInputActive;
    }

    showConfessionalInput() {
        if (this.confessionalInputOverlay && this.confessionalTextInput) {
            this.hideConfessionalPrompt(); // Hide prompt when input overlay is shown
            this.confessionalInputOverlay.style.display = 'flex';
            this.isConfessionalInputActive = true;
            this.confessionalTextInput.value = '';
            this.confessionalTextInput.focus();
            console.log('Attempted to focus confessional input. Active element:', document.activeElement);
            // Optionally, add a setTimeout for focus on mobile if direct focus fails:
            // setTimeout(() => {
            //     this.confessionalTextInput.focus();
            //     console.log('Attempted to focus confessional input (delayed). Active element:', document.activeElement);
            // }, 100);
            if (this.gameCore.inputManager) {
                this.gameCore.inputManager.setFocus(false); // Disable game input
            }
            if (this.gameCore.enablePointerLock) this.gameCore.enablePointerLock(false);
        }
    }

    hideConfessionalInput() {
        console.log('Hiding confessional input.');
        if (this.confessionalInputOverlay) {
            this.confessionalInputOverlay.style.display = 'none';
            this.isConfessionalInputActive = false;
            if (this.gameCore.inputManager) {
                this.gameCore.inputManager.setFocus(true); // Re-enable game input
            }
            // Re-acquire pointer lock only if game is active and game is started
            if (this.gameCore.enablePointerLock && this.gameCore.gameState && this.gameCore.gameState.isGameStarted) {
                this.gameCore.enablePointerLock(true);
            }
            // If player is still in a booth zone, Player.js logic will call showConfessionalPrompt again.
            // No need to explicitly re-show it here, to avoid race conditions.
            this.currentBoothIdForConfessional = null; // Clear stored booth ID once input is done
        }
    }

    setupConsoleInputListener() {
        if (this.consoleInput) {
            this.consoleInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && this.isConsoleOpen) {
                    event.preventDefault();
                    const commandText = this.consoleInput.value.trim();
                    if (commandText) {
                        this.addConsoleLogMessage(commandText, 'user'); // Log user's typed command
                        if (this.gameCore.consoleManager) {
                            this.gameCore.consoleManager.processCommand(commandText);
                        }
                    }
                    this.consoleInput.value = ''; // Clear input
                } else if (event.key === 'Escape' && this.isConsoleOpen) {
                    event.preventDefault();
                    this.toggleConsole();
                }
            });
        }
    }

    toggleConsole() {
        this.isConsoleOpen = !this.isConsoleOpen;
        if (this.consoleContainer) {
            this.consoleContainer.classList.toggle('hidden', !this.isConsoleOpen);
        }

        if (this.isConsoleOpen) {
            if (this.consoleInput) this.consoleInput.focus();
            if (this.gameCore.inputManager) this.gameCore.inputManager.setFocus(false); // Game loses focus
            if (this.gameCore.enablePointerLock) this.gameCore.enablePointerLock(false); // Release pointer lock
        } else {
            if (this.consoleInput) this.consoleInput.blur();
            if (this.gameCore.inputManager) this.gameCore.inputManager.setFocus(true);  // Game gains focus
            // Re-acquire pointer lock only if game is active and was previously locked
            if (this.gameCore.enablePointerLock && this.gameCore.gameState && this.gameCore.gameState.isGameStarted) {
                 this.gameCore.enablePointerLock(true);
            }
        }
    }

    isConsoleVisible() {
        return this.isConsoleOpen;
    }

    addConsoleLogMessage(message, type = 'info') { // type can be 'info', 'error', 'response', 'user'
        if (!this.consoleLog) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = type;

        // Add a prompt only if it's not a user-typed message already logged
        const prompt = (type !== 'user') ? '> ' : '';
        messageDiv.textContent = `${prompt}${message}`;

        this.consoleLog.appendChild(messageDiv);
        this.consoleLog.scrollTop = this.consoleLog.scrollHeight; // Auto-scroll to bottom
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

import { PLAYER_CLASSES, WEAPON_TYPES, TEAM_IDS, SOUND_KEYS } from './Constants.js'; // Assuming TEAM_IDS might be useful for team color mapping

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
        this.corruptionDisplay = document.getElementById('corruption-level'); // This is the element for the text "0%"
        this.killFeedContainer = document.getElementById('kill-feed-container'); // Corrected ID

        // Console Elements
        this.consoleContainer = document.getElementById('console'); // Using existing ID
        this.consoleLog = document.getElementById('console-output');   // Using existing ID
        this.consoleInput = document.getElementById('console-input');   // Using existing ID
        this.isConsoleOpen = false;

        // Map Reveal Elements & State
        this.mapRevealOverlay = document.getElementById('map-reveal-overlay');
        this.mapRevealPlayerIconsContainer = document.getElementById('map-reveal-player-icons');
        this.mapRevealTimerDisplay = document.getElementById('map-reveal-timer');
        this.mapRevealActive = false;
        this.mapRevealInterval = null;
        this.mapRevealEndTime = 0;
        // Define map bounds (minX, maxX, minZ, maxZ) for your game world.
        // EXAMPLE VALUES - ADJUST TO YOUR ACTUAL MAP DIMENSIONS!
        this.mapWorldBounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };

        // Confessional Booth Elements & State
        this.confessionalPrompt = document.getElementById('confessional-prompt');
        this.confessionalInputOverlay = document.getElementById('confessional-input-overlay');
        this.confessionalTextInput = document.getElementById('confessional-text-input');
        this.submitConfessionalButton = document.getElementById('submit-confessional-button');
        this.cancelConfessionalButton = document.getElementById('cancel-confessional-button');
        this.currentBoothIdForConfessional = null; // To store which booth triggered the input
        this.isConfessionalInputActive = false; // To track if the input overlay is shown

        // Match Summary Screen Elements
        this.matchSummaryScreen = document.getElementById('match-summary-screen');
        this.summaryLongestHolder = document.getElementById('summary-longest-holder');
        this.summaryMostCommands = document.getElementById('summary-most-commands');
        this.summaryConfessionalList = document.getElementById('summary-confessional-list');
        this.summaryTimelineLog = document.getElementById('summary-timeline-log');
        this.copyTimelineButton = document.getElementById('copy-timeline-button');
        this.summaryScreenshotContainer = document.getElementById('summary-screenshot-container');
        this.summaryScreenshotImg = document.getElementById('summary-screenshot-img');
        this.downloadScreenshotLink = document.getElementById('download-screenshot-link');
        this.closeSummaryButton = document.getElementById('close-summary-button');


        this.setupEventListeners();
        this.setupWeaponSelection();
        this.setupConsoleInputListener();
        this.setupConfessionalEventListeners();
        this.setupMatchSummaryEventListeners();
    }

    setupEventListeners() {
        // Main Menu
        document.getElementById('join-game').addEventListener('click', () => {
            // Transition to lobby is handled by GameCore
            this.gameCore.transitionToLobby();
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
                    const selectedClass = event.target.dataset.class; // This should be a PLAYER_CLASSES value
                    classButtons.forEach(btn => btn.classList.remove('selected'));
                    event.target.classList.add('selected');
                    this.gameCore.lobbyManager.handleClassSelection(selectedClass);
                }
            });
        });
    }

    setupConfessionalEventListeners() {
        const handleSubmit = (event) => {
            event.preventDefault(); // Prevent potential double event / default actions
            const quoteText = this.confessionalTextInput.value.trim();
            if (quoteText && this.currentBoothIdForConfessional) {
                if (this.gameCore && typeof this.gameCore.recordConfessional === 'function') {
                    this.gameCore.recordConfessional(quoteText, this.currentBoothIdForConfessional);
                }
            }
            this.hideConfessionalInput();
        };

        if (this.submitConfessionalButton) {
            this.submitConfessionalButton.addEventListener('click', handleSubmit);
            this.submitConfessionalButton.addEventListener('touchend', handleSubmit);
        }

        const handleCancel = (event) => {
            event.preventDefault();
            this.hideConfessionalInput();
        };

        if (this.cancelConfessionalButton) {
            this.cancelConfessionalButton.addEventListener('click', handleCancel);
            this.cancelConfessionalButton.addEventListener('touchend', handleCancel);
        }

        // Optional: Allow Escape to also cancel the confessional input
        if (this.confessionalTextInput) {
            this.confessionalTextInput.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.isConfessionalInputActive) { // Check if input is active
                    this.hideConfessionalInput();
                }
            });
        }
    }

    showConfessionalPrompt(boothId) {
        if (this.confessionalPrompt) {
            this.confessionalPrompt.style.display = 'block';
            this.currentBoothIdForConfessional = boothId; // Store the booth ID
        }
    }

    hideConfessionalPrompt() {
        if (this.confessionalPrompt) {
            this.confessionalPrompt.style.display = 'none';
            // Don't nullify currentBoothIdForConfessional here,
            // InputManager might need it briefly after prompt is hidden and before input is shown.
        }
    }

    isConfessionalInputVisible() { // Renamed from isConfessionalInputActive for clarity of function
        return this.isConfessionalInputActive;
    }

    showConfessionalInput() {
        if (this.confessionalInputOverlay && this.confessionalTextInput) {
            this.hideConfessionalPrompt(); // Hide prompt when input overlay is shown
            this.confessionalInputOverlay.style.display = 'flex';
            this.isConfessionalInputActive = true;
            this.confessionalTextInput.value = '';
            this.confessionalTextInput.focus();
            console.log('Attempted to focus confessional input. Active element:', document.activeElement);
            // Optionally, add a setTimeout for focus on mobile if direct focus fails:
            // setTimeout(() => {
            //     this.confessionalTextInput.focus();
            //     console.log('Attempted to focus confessional input (delayed). Active element:', document.activeElement);
            // }, 100);
            if (this.gameCore.inputManager) {
                this.gameCore.inputManager.setFocus(false); // Disable game input
            }
            if (this.gameCore.enablePointerLock) this.gameCore.enablePointerLock(false);
        }
    }

    hideConfessionalInput() {
        console.log('Hiding confessional input.');
        if (this.confessionalInputOverlay) {
            this.confessionalInputOverlay.style.display = 'none';
            this.isConfessionalInputActive = false;
            if (this.gameCore.inputManager) {
                this.gameCore.inputManager.setFocus(true); // Re-enable game input
            }
            // Re-acquire pointer lock only if game is active and game is started
            if (this.gameCore.enablePointerLock && this.gameCore.gameState && this.gameCore.gameState.isGameStarted) {
                this.gameCore.enablePointerLock(true);
            }
            // If player is still in a booth zone, Player.js logic will call showConfessionalPrompt again.
            // No need to explicitly re-show it here, to avoid race conditions.
            this.currentBoothIdForConfessional = null; // Clear stored booth ID once input is done
        }
    }

    setupConsoleInputListener() {
        if (this.consoleInput) {
            this.consoleInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && this.isConsoleOpen) {
                    event.preventDefault();
                    const commandText = this.consoleInput.value.trim();
                    if (commandText) {
                        this.addConsoleLogMessage(commandText, 'user'); // Log user's typed command
                        if (this.gameCore.consoleManager) {
                            this.gameCore.consoleManager.processCommand(commandText);
                        }
                    }
                    this.consoleInput.value = ''; // Clear input
                } else if (event.key === 'Escape' && this.isConsoleOpen) {
                    event.preventDefault();
                    this.toggleConsole();
                }
            });
        }
    }

    toggleConsole() {
        this.isConsoleOpen = !this.isConsoleOpen;
        if (this.consoleContainer) {
            this.consoleContainer.classList.toggle('hidden', !this.isConsoleOpen);
        }

        if (this.isConsoleOpen) {
            if (this.consoleInput) this.consoleInput.focus();
            if (this.gameCore.inputManager) this.gameCore.inputManager.setFocus(false); // Game loses focus
            if (this.gameCore.enablePointerLock) this.gameCore.enablePointerLock(false); // Release pointer lock
        } else {
            if (this.consoleInput) this.consoleInput.blur();
            if (this.gameCore.inputManager) this.gameCore.inputManager.setFocus(true);  // Game gains focus
            // Re-acquire pointer lock only if game is active and was previously locked
            if (this.gameCore.enablePointerLock && this.gameCore.gameState && this.gameCore.gameState.isGameStarted) {
                 this.gameCore.enablePointerLock(true);
            }
        }
    }

    isConsoleVisible() {
        return this.isConsoleOpen;
    }

    addConsoleLogMessage(message, type = 'info') { // type can be 'info', 'error', 'response', 'user', 'audience', 'special_effect'
        if (!this.consoleLog) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = type;

        const prompt = (type !== 'user') ? '> ' : '';
        messageDiv.textContent = `${prompt}${message}`;

        this.consoleLog.appendChild(messageDiv);
        this.consoleLog.scrollTop = this.consoleLog.scrollHeight;
    }

    disableAllVoteButtons() {
        if (!this.chaosVoteList) return;
        const buttons = this.chaosVoteList.querySelectorAll('.vote-button');
        buttons.forEach(button => button.disabled = true);
    }

    sendChatMessage() {
        const message = this.chatInputField.value.trim();
        if (message && this.gameCore.networkManager) {
            this.gameCore.networkManager.sendLobbyChatMessage(message);
            this.chatInputField.value = '';
        }
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
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

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
                <button class="weapon-btn active" data-weapon="${PLAYER_CLASSES.ASSAULT}">ASSAULT</button>
                <button class="weapon-btn" data-weapon="${PLAYER_CLASSES.SCOUT}">SCOUT</button>
                <button class="weapon-btn" data-weapon="${PLAYER_CLASSES.HEAVY}">HEAVY</button>
            </div>
        `;
        
        document.getElementById('main-menu').appendChild(weaponSelector);
        
        // Add weapon selection event listeners
        document.querySelectorAll('.weapon-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.weapon-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                // Player.setWeaponType expects a WEAPON_TYPES value,
                // but Player.setClass (called from lobby) takes PLAYER_CLASSES.
                // If this menu directly sets weapon type without class change, ensure consistency.
                // For now, assuming data-weapon aligns with what Player.js expects for direct type setting,
                // or that Player.js setWeaponType can handle PLAYER_CLASSES strings.
                // The Player.js's setClass method already sets weaponType based on PLAYER_CLASSES.
                // This particular setWeaponType call might be for a scenario outside of class selection (e.g. in-game weapon pickup)
                // or if the main menu setting is meant to be independent of full class stats.
                // Given current structure, this call to setWeaponType with PLAYER_CLASSES string
                // will be handled by Player.js's setClass if that's what setWeaponType internally calls,
                // or by a direct weaponType mapping if Player.setWeaponType is different.
                // Let's assume player.setWeaponType will correctly map from PLAYER_CLASSES if needed,
                // or that WEAPON_TYPES and PLAYER_CLASSES values are identical for this context.
                // Player.js was updated so setWeaponType expects WEAPON_TYPES.
                // Player.getWeaponForClass(playerClass) returns a WEAPON_TYPES.
                // So, if `e.target.dataset.weapon` is a PLAYER_CLASSES string, we need to convert it.
                const playerClass = e.target.dataset.weapon;
                const weaponType = this.gameCore.player.getWeaponForClass(playerClass); // Get corresponding WEAPON_TYPE
                this.gameCore.player.setWeaponType(weaponType);
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
    
    updateCorruptionDisplay() {
        const corruptionLevelValue = Math.round(this.gameCore.gameState.corruptionLevel); // Use Math.round for cleaner display
        if (this.corruptionDisplay) { // This is #corruption-level
            this.corruptionDisplay.textContent = `${corruptionLevelValue}%`;
        }
        
        // This is for the main menu corruption bar, separate from in-game HUD
        const mainMenuCorruptionFill = document.querySelector('#main-menu .corruption-fill');
        if (mainMenuCorruptionFill) {
            mainMenuCorruptionFill.style.width = `${corruptionLevelValue}%`;
        }
        // If there's an in-game HUD bar for corruption (not just text), update it here.
    }

    addKillFeedEntry(killerName, victimName, weaponUsed) {
        if (!this.killFeedContainer) {
            console.warn("killFeedContainer not found in UIManager");
            return;
        }

        const messageEl = document.createElement('div');
        messageEl.classList.add('kill-feed-message');

        // Sanitize inputs to prevent HTML injection if names ever come from user input directly
        const saneKiller = this.escapeHTML(killerName || "Unknown");
        const saneVictim = this.escapeHTML(victimName || "Unknown");
        const saneWeapon = this.escapeHTML(weaponUsed || "Claws"); // Default to "Claws" or similar

        messageEl.innerHTML = `${saneKiller} <span style="color:var(--enemy-color);">[${saneWeapon}]</span> ${saneVictim}`;

        // Add to top, and let flex-direction: column handle order.
        this.killFeedContainer.appendChild(messageEl);

        const MAX_KILL_FEED_MESSAGES = this.MAX_KILL_FEED_MESSAGES || 5;
        // If using flex-direction: column-reverse, new items are added at end but appear at top.
        // If using flex-direction: column, new items are added at end and appear at bottom.
        // For messages to appear at top and push old ones down (then overflow hidden),
        // we should use appendChild and then if > MAX, removeChild(firstChild).
        // The CSS uses column-reverse, so appendChild works as "prepend" visually.

        if (this.killFeedContainer.children.length > MAX_KILL_FEED_MESSAGES) {
            // If column-reverse, firstChild is visually the bottom one (oldest if new are appended)
            // If column (standard), firstChild is visually the top one.
            // With column-reverse, new items via appendChild go to the "bottom" which is visually the "top".
            // So to remove the oldest (visually bottom), we remove this.killFeedContainer.firstChild
            this.killFeedContainer.removeChild(this.killFeedContainer.firstChild);
        }

        setTimeout(() => {
            messageEl.classList.add('fade-out');
            setTimeout(() => {
                if (messageEl.parentNode === this.killFeedContainer) { // Check parent before removing
                     this.killFeedContainer.removeChild(messageEl);
                }
            }, 500); // Match CSS transition time (0.5s)
        }, 7000); // Message visible for 7 seconds
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
    
    updateWeaponDisplay(weaponType) { // weaponType is expected to be a WEAPON_TYPES value
        const weaponDisplayNames = {
            [WEAPON_TYPES.ASSAULT]: 'H20PEW ASSAULT',
            [WEAPON_TYPES.SCOUT]: 'H20PEW SCOUT',
            [WEAPON_TYPES.HEAVY]: 'H20PEW HEAVY',
        };
        
        document.getElementById('weapon-name').textContent = weaponDisplayNames[weaponType] || 'H20PEW BLASTER';
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

    // --- Map Reveal Methods ---
    _worldToMapPercent(worldPos, bounds) {
        const xPercent = ((worldPos.x - bounds.minX) / (bounds.maxX - bounds.minX)) * 100;
        const zPercent = ((worldPos.z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * 100; // Assuming Z is the other horizontal axis
        return { x: Math.max(0, Math.min(100, xPercent)), z: Math.max(0, Math.min(100, zPercent)) };
    }

    showMapReveal(durationSeconds) {
        if (this.mapRevealActive || !this.mapRevealOverlay || !this.mapRevealPlayerIconsContainer || !this.mapRevealTimerDisplay) {
            return;
        }
        this.mapRevealActive = true;
        this.mapRevealOverlay.style.display = 'block';
        this.mapRevealEndTime = Date.now() + durationSeconds * 1000;

        if (this.mapRevealInterval) {
            clearInterval(this.mapRevealInterval);
        }
        this.mapRevealInterval = setInterval(() => { this.updateMapRevealPlayerIcons(); }, 200); // Update icons 5 times/sec
        this.updateMapRevealPlayerIcons(); // Initial update

        if (this.gameCore.audioManager) {
            this.gameCore.audioManager.playSound(SOUND_KEYS.REVEAL_MAP_START);
        }
    }

    updateMapRevealPlayerIcons() {
        if (!this.mapRevealActive || !this.gameCore || !this.mapRevealPlayerIconsContainer || !this.mapRevealTimerDisplay) {
            this.hideMapReveal(); // Ensure cleanup if something is wrong
            return;
        }

        const timeLeft = Math.max(0, Math.ceil((this.mapRevealEndTime - Date.now()) / 1000));
        this.mapRevealTimerDisplay.textContent = `${timeLeft}s`;

        if (timeLeft <= 0) {
            this.hideMapReveal();
            return;
        }

        this.mapRevealPlayerIconsContainer.innerHTML = ''; // Clear old icons

        // Local Player
        if (this.gameCore.player) {
            const localPos = this.gameCore.player.position;
            const localMapPos = this._worldToMapPercent(localPos, this.mapWorldBounds);
            const localIcon = document.createElement('div');
            localIcon.className = 'player-map-icon local-player-map-icon';
            localIcon.style.left = localMapPos.x + '%';
            localIcon.style.top = localMapPos.z + '%';
            localIcon.title = this.gameCore.player.username || 'You';
            this.mapRevealPlayerIconsContainer.appendChild(localIcon);
        }

        // Remote Players
        if (this.gameCore.otherPlayers && this.gameCore.networkManager) {
            const localPlayerTeam = this.gameCore.player ? this.gameCore.player.team : null;

            this.gameCore.otherPlayers.forEach((remotePlayer, playerId) => {
                // remotePlayer.mesh.position is the source of truth for remote player visuals
                if (remotePlayer.mesh && remotePlayer.mesh.visible) {
                    const remotePos = remotePlayer.mesh.position;
                    const remoteMapPos = this._worldToMapPercent(remotePos, this.mapWorldBounds);
                    const remoteIcon = document.createElement('div');

                    // Determine if teammate or enemy based on presence data
                    const remotePlayerData = this.gameCore.networkManager.room?.presence[playerId];
                    let iconClass = 'player-map-icon enemy-map-icon'; // Default to enemy
                    if (remotePlayerData && localPlayerTeam && remotePlayerData.team === localPlayerTeam) {
                        iconClass = 'player-map-icon teammate-map-icon';
                    }

                    remoteIcon.className = iconClass;
                    remoteIcon.style.left = remoteMapPos.x + '%';
                    remoteIcon.style.top = remoteMapPos.z + '%';
                    remoteIcon.title = (remotePlayerData?.username) || `Player ${playerId.substring(0,4)}`;
                    this.mapRevealPlayerIconsContainer.appendChild(remoteIcon);
                }
            });
        }
    }

    hideMapReveal() {
        if (!this.mapRevealActive && this.mapRevealOverlay && this.mapRevealOverlay.style.display === 'none') return; // Already hidden or never shown

        this.mapRevealActive = false;
        if (this.mapRevealOverlay) {
            this.mapRevealOverlay.style.display = 'none';
        }
        if (this.mapRevealInterval) {
            clearInterval(this.mapRevealInterval);
            this.mapRevealInterval = null;
        }
        if (this.mapRevealPlayerIconsContainer) {
            this.mapRevealPlayerIconsContainer.innerHTML = '';
        }
        if (this.gameCore.audioManager) {
            this.gameCore.audioManager.playSound(SOUND_KEYS.REVEAL_MAP_END);
        }
    }

    setMeltPhaseVisuals(isActive) {
        const hudElement = document.getElementById('hud');
        const crosshairElement = document.getElementById('crosshair');
        // Score display elements
        const teamScoreElement = document.getElementById('team-score');
        const enemyScoreElement = document.getElementById('enemy-team-score');
        const corruptionDisplayElement = this.corruptionDisplay; // Already a class property
        const gameUiElement = document.getElementById('game-ui');


        if (isActive) {
            if (hudElement) hudElement.style.display = 'none';
            if (crosshairElement) crosshairElement.style.display = 'none';
            // Hiding individual score elements - consider a parent container for HUD for easier toggle
            if (teamScoreElement && teamScoreElement.parentElement && teamScoreElement.parentElement.classList.contains('team-info')) { // Hide parent if it's specific enough
                 // teamScoreElement.parentElement.style.display = 'none'; // This might hide team name too
            } else if (teamScoreElement) {
                 teamScoreElement.style.display = 'none';
            }
            if (enemyScoreElement && enemyScoreElement.parentElement && enemyScoreElement.parentElement.classList.contains('enemy-team-info')) {
                // enemyScoreElement.parentElement.style.display = 'none';
            } else if (enemyScoreElement) {
                enemyScoreElement.style.display = 'none';
            }
             if (corruptionDisplayElement && corruptionDisplayElement.parentElement && corruptionDisplayElement.parentElement.classList.contains('corruption-display')) {
                corruptionDisplayElement.parentElement.style.display = 'none';
            } else if (corruptionDisplayElement) {
                 corruptionDisplayElement.style.display = 'none';
            }

            // Hide other specific UI elements
            const fragmentIndicatorElement = document.getElementById('fragment-indicator');
            if (fragmentIndicatorElement) fragmentIndicatorElement.style.display = 'none';

            const interactionPromptElement = document.getElementById('interaction-prompt');
            if (interactionPromptElement) interactionPromptElement.style.display = 'none';

            const playerListElement = document.getElementById('player-list');
            if (playerListElement) playerListElement.style.display = 'none';

            if (this.isConsoleOpen) {
                this.toggleConsole(); // Close console if open
            }
            if (this.mapRevealActive) {
                this.hideMapReveal(); // Hide map if it's active
            }
            if (this.isConfessionalInputVisible()) {
                this.hideConfessionalInput(); // Hide confessional input if active
            }
            if (this.confessionalPrompt && this.confessionalPrompt.style.display === 'block') {
                this.hideConfessionalPrompt();
            }

            document.body.style.filter = 'invert(100%) hue-rotate(180deg) saturate(2)';
            if (gameUiElement) gameUiElement.classList.add('melt-phase-active-background'); // For potential CSS background animations

        } else {
            // This part is less likely to be used if melt phase is game-ending and game resets
            if (hudElement) hudElement.style.display = 'block'; // Or 'flex' depending on original display type
            if (crosshairElement) crosshairElement.style.display = 'block';

            if (teamScoreElement && teamScoreElement.parentElement && teamScoreElement.parentElement.classList.contains('team-info')) {
                // teamScoreElement.parentElement.style.display = 'block'; // Or original display type
            } else if (teamScoreElement) {
                teamScoreElement.style.display = 'block';
            }
            if (enemyScoreElement && enemyScoreElement.parentElement && enemyScoreElement.parentElement.classList.contains('enemy-team-info')) {
                // enemyScoreElement.parentElement.style.display = 'block';
            } else if (enemyScoreElement) {
                enemyScoreElement.style.display = 'block';
            }
            if (corruptionDisplayElement && corruptionDisplayElement.parentElement && corruptionDisplayElement.parentElement.classList.contains('corruption-display')) {
               corruptionDisplayElement.parentElement.style.display = 'block'; // Or original display type
            } else if (corruptionDisplayElement) {
                 corruptionDisplayElement.style.display = 'block';
            }


            const playerListElement = document.getElementById('player-list');
            if (playerListElement) playerListElement.style.display = 'block';


            document.body.style.filter = 'none';
            if (gameUiElement) gameUiElement.classList.remove('melt-phase-active-background');
        }
    }

    // --- Match Summary Screen Methods ---
    setupMatchSummaryEventListeners() {
        if (this.closeSummaryButton) {
            this.closeSummaryButton.addEventListener('click', () => this.hideMatchSummaryScreen());
        }
        if (this.copyTimelineButton && this.summaryTimelineLog) {
            this.copyTimelineButton.addEventListener('click', () => {
                if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                    navigator.clipboard.writeText(this.summaryTimelineLog.value)
                        .then(() => {
                            if (this.gameCore && this.gameCore.uiManager && typeof this.gameCore.uiManager.addConsoleLogMessage === 'function') {
                                this.gameCore.uiManager.addConsoleLogMessage("Timeline copied to clipboard!", "info");
                            } else if (typeof this.addConsoleLogMessage === 'function') { // Fallback if gameCore path is weird
                                this.addConsoleLogMessage("Timeline copied to clipboard!", "info");
                            } else {
                                console.log("Timeline copied to clipboard!"); // Absolute fallback
                            }
                        })
                        .catch(err => {
                            console.error('Failed to copy timeline: ', err);
                            if (this.gameCore && this.gameCore.uiManager && typeof this.gameCore.uiManager.addConsoleLogMessage === 'function') {
                                this.gameCore.uiManager.addConsoleLogMessage("Failed to copy timeline.", "error");
                            } else if (typeof this.addConsoleLogMessage === 'function') {
                                this.addConsoleLogMessage("Failed to copy timeline.", "error");
                            }
                        });
                } else {
                     // Fallback for older browsers or non-secure contexts
                    this.summaryTimelineLog.select();
                    document.execCommand('copy');
                     if (this.gameCore && this.gameCore.uiManager && typeof this.gameCore.uiManager.addConsoleLogMessage === 'function') {
                        this.gameCore.uiManager.addConsoleLogMessage("Timeline copied (fallback method).", "info");
                    } else if (typeof this.addConsoleLogMessage === 'function') {
                        this.addConsoleLogMessage("Timeline copied (fallback method).", "info");
                    }
                }
            });
        }
    }

    showMatchSummaryScreen(matchStats, confessionalLogs) {
        if (!this.matchSummaryScreen) return;

        this.hideGameUI(); // Hide main game UI elements if they are part of a container that isn't auto-hidden
        this.hideLobbyScreen(); // Ensure lobby is hidden
        this.hideMainMenu(); // Ensure main menu is hidden
        if(this.isConsoleOpen) this.toggleConsole(); // Close console
        if(this.mapRevealActive) this.hideMapReveal(); // Close map reveal
        if(this.isConfessionalInputVisible()) this.hideConfessionalInput(); // Close confessional input

        this.matchSummaryScreen.style.display = 'block';
        if(this.gameCore.inputManager) this.gameCore.inputManager.setFocus(false);
        if(this.gameCore.enablePointerLock) this.gameCore.enablePointerLock(false);

        // Populate Stats
        if (this.summaryLongestHolder && matchStats.longestHolder) {
            this.summaryLongestHolder.textContent = matchStats.longestHolder.username
                ? `${matchStats.longestHolder.username} (${(matchStats.longestHolder.time).toFixed(1)}s)`
                : 'N/A';
        }
        if (this.summaryMostCommands && matchStats.mostCommandsPlayer) {
            this.summaryMostCommands.textContent = matchStats.mostCommandsPlayer.username
                ? `${matchStats.mostCommandsPlayer.username} (${matchStats.mostCommandsPlayer.count} commands)`
                : 'N/A';
        }

        // Populate Confessionals
        if (this.summaryConfessionalList && confessionalLogs) {
            this.summaryConfessionalList.innerHTML = ''; // Clear old
            // Show up to 3 random or recent - let's show the last 3 for simplicity
            const numQuotesToShow = Math.min(confessionalLogs.length, 3);
            const startIndex = Math.max(0, confessionalLogs.length - numQuotesToShow);
            for (let i = startIndex; i < confessionalLogs.length; i++) {
                const log = confessionalLogs[i];
                if(log && log.quote && log.playerName) {
                    const li = document.createElement('li');
                    li.innerHTML = `<em>"${this.escapeHTML(log.quote)}"</em> - ${this.escapeHTML(log.playerName)}`;
                    this.summaryConfessionalList.appendChild(li);
                }
            }
            if(numQuotesToShow === 0) {
                 const li = document.createElement('li');
                 li.textContent = "No confessionals recorded during this match.";
                 this.summaryConfessionalList.appendChild(li);
            }
        }

        // Populate Timeline
        if (this.summaryTimelineLog && matchStats.timeline) {
            const timelineText = matchStats.timeline
                .map(event => `[${(event.time).toFixed(1)}s] [${event.type}] ${this.escapeHTML(event.message)}`)
                .join('\n');
            this.summaryTimelineLog.value = timelineText;
            this.summaryTimelineLog.scrollTop = this.summaryTimelineLog.scrollHeight; // Scroll to bottom
        }

        // Handle Screenshot
        if (this.summaryScreenshotContainer && this.summaryScreenshotImg && this.downloadScreenshotLink && this.gameCore) {
            const screenshotDataUrl = (typeof this.gameCore.getEndGameScreenshotDataUrl === 'function')
                ? this.gameCore.getEndGameScreenshotDataUrl() : null;
            if (screenshotDataUrl) {
                this.summaryScreenshotImg.src = screenshotDataUrl;
                this.downloadScreenshotLink.href = screenshotDataUrl;
                this.summaryScreenshotContainer.style.display = 'block';
            } else {
                this.summaryScreenshotContainer.style.display = 'none';
            }
        }
    }

    hideMatchSummaryScreen() {
        if (this.matchSummaryScreen) {
            this.matchSummaryScreen.style.display = 'none';
        }
        // Decide what to show next, e.g., main menu
        this.showMainMenu();
        // Game focus and pointer lock should be handled by the screen/state we transition to.
        // For example, if going to main menu, no pointer lock. If restarting game, it will be re-acquired.
    }
}