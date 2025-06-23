export class InputManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.controls = {
            moveForward: false,
            moveBackward: false,
            moveLeft: false,
            moveRight: false,
            jump: false,
            sprint: false,
            crouch: false,
            shoot: false, // Added for mousedown/up tracking for console interaction
            reload: false // Added for mousedown/up tracking
        };
        this.consoleActive = false;
        this.keys = {}; // To track held-down keys for "just pressed" logic

        // "Just pressed" flags
        this.keyRPressedThisFrame = false;
        this.keyFPressedThisFrame = false; // For Interact (using F key)
        this.keyShiftLeftPressedThisFrame = false; // For Crouch toggle
        
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Double-tap detection for W key
        this.lastWTapTime = 0;
        this.doubleTapWindow = 300; // 300ms window for double-tap
        this.isDoubleTapSprinting = false;
        
        this.setupEventListeners();
        
        if (this.isMobile) {
            this.setupMobileControls();
        }
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        document.addEventListener('mousemove', (event) => {
            if (this.gameCore.gameState.isGameStarted && document.pointerLockElement && !this.consoleActive) { // Added !this.consoleActive
                this.handleMouseMove(event);
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (this.consoleActive || this.gameCore.uiManager.isConfessionalInputVisible()) return;
            if (this.gameCore.gameState.isGameStarted) {
                if (event.button === 0) { // Left click
                    this.controls.shoot = true;
                    this.gameCore.handleShoot();
                } else if (event.button === 2) { // Right click
                    this.controls.reload = true;
                    this.gameCore.handleReload();
                }
            }
        });

        document.addEventListener('mouseup', (event) => {
            if (this.consoleActive || this.gameCore.uiManager.isConfessionalInputVisible()) return;
            if (this.gameCore.gameState.isGameStarted) {
                if (event.button === 0) { // Left click
                    this.controls.shoot = false;
                } else if (event.button === 2) { // Right click
                    this.controls.reload = false;
                }
            }
        });
        
        // Prevent right-click context menu
        document.addEventListener('contextmenu', (event) => {
            if (this.consoleActive || this.gameCore.uiManager.isConfessionalInputVisible()) return;
            if (this.gameCore.gameState.isGameStarted) {
                event.preventDefault();
            }
        });
        
        document.addEventListener('click', () => {
            if (this.consoleActive || this.gameCore.uiManager.isConfessionalInputVisible()) return;
            if (this.gameCore.gameState.isGameStarted && !document.pointerLockElement) {
                this.requestPointerLock();
            }
        });
        
        window.addEventListener('resize', () => {
            this.gameCore.handleResize();
        });
    }

    setFocus(isGameFocused) {
        console.log('InputManager focus set to gameFocused:', isGameFocused);
        this.consoleActive = !isGameFocused; // This flag is used by UIManager.toggleConsole & UIManager.showConfessionalInput
                                         // to signal InputManager that game controls should be ignored.
                                         // UIManager calls setFocus(false) when its own inputs (console, confessional) take over.
        if (!isGameFocused) { // If game is NOT focused (i.e., consoleActive is true, or confessional input is active)
            // Clear movement states when console or other UI overlay opens to prevent continuous movement
            this.controls.moveForward = false;
            this.controls.moveBackward = false;
            this.controls.moveLeft = false;
            this.controls.moveRight = false;
            this.controls.sprint = false;
            this.controls.jump = false;
            this.controls.crouch = false;
            this.isDoubleTapSprinting = false;
        }
    }
    
    requestPointerLock() {
        const canvas = document.getElementById('game-canvas');
        if (canvas.requestPointerLock) {
            canvas.requestPointerLock();
        } else if (canvas.mozRequestPointerLock) {
            canvas.mozRequestPointerLock();
        } else if (canvas.webkitRequestPointerLock) {
            canvas.webkitRequestPointerLock();
        }
    }
    
    setupMobileControls() {
        document.getElementById('mobile-controls').classList.remove('hidden');
        
        document.getElementById('shoot-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.gameCore.handleShoot();
        });
        
        document.getElementById('jump-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.controls.jump = true;
        });
        
        document.getElementById('console-btn').addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.gameCore.consoleManager.toggle();
        });
    }
    
    handleKeyDown(event) {
        // Allow tilde and Escape to be processed by UIManager if console is active for toggling/closing
        if (this.consoleActive && event.key !== '~' && event.key !== '`' && event.key !== 'Escape') {
            // If console is active, UIManager's input field handler will take care of other keys.
            // We don't want to process them for game actions here.
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case 'w':
                // Handle double-tap detection for sprint
                const currentTime = Date.now();
                if (currentTime - this.lastWTapTime < this.doubleTapWindow) {
                    // Double-tap detected - start sprinting
                    this.isDoubleTapSprinting = true;
                    this.controls.sprint = true;
                }
                this.lastWTapTime = currentTime;
                
                this.controls.moveForward = true;
                break;
            case 's':
                this.controls.moveBackward = true;
                break;
            case 'a':
                this.controls.moveLeft = true;
                break;
            case 'd':
                this.controls.moveRight = true;
                break;
            case ' ':
                event.preventDefault();
                this.controls.jump = true;
                break;
            case 'shift':
                event.preventDefault();
                if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                    this.controls.sprint = true;
                } else if (event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                    if (!this.keys['ShiftLeft']) this.keyShiftLeftPressedThisFrame = true;
                    this.keys['ShiftLeft'] = true;
                    this.controls.crouch = true;
                }
                break;
            case 'r':
                event.preventDefault();
                if (!this.keys['KeyR']) this.keyRPressedThisFrame = true;
                this.keys['KeyR'] = true;
                // Direct call to gameCore.handleReload() removed.
                break;
            case 'f': // Changed 'e' to 'f' for general interaction as per typical game controls
                event.preventDefault();
                if (!this.keys['KeyF']) this.keyFPressedThisFrame = true; // Use keyFPressedThisFrame
                this.keys['KeyF'] = true;
                // Direct call to gameCore.handleInteraction() removed.
                break;
            case 'e': // This 'e' might be a separate action or confessional specific
                event.preventDefault();
                // If 'e' is still for confessional UI activation, that direct call can remain
                // as it's a UI interaction, not a player game action state.
                if (!this.consoleActive &&
                    this.gameCore.player && this.gameCore.player.currentBoothId &&
                    this.gameCore.uiManager && !this.gameCore.uiManager.isConfessionalInputVisible())
                {
                    this.gameCore.uiManager.showConfessionalInput();
                }
                break;
            case 'v': // New case for 'V' key for toggling speaking state
                if (!this.consoleActive && this.gameCore.player) {
                    event.preventDefault();
                    this.gameCore.player.toggleSpeaking();
                }
                break;
            case '`':
            case '~':
                event.preventDefault();
                this.gameCore.uiManager.toggleConsole(); // Changed to uiManager
                // this.consoleActive is set by UIManager via setFocus
                break;
            case 'escape':
                // UIManager now handles Escape for console toggle.
                // This InputManager part is for exiting pointer lock if console is not active.
                if (!this.consoleActive && document.pointerLockElement) {
                    document.exitPointerLock();
                }
                break;
        }
    }
    
    handleKeyUp(event) {
        if (this.consoleActive) return; // Ignore key up for game controls if console is active

        switch (event.key.toLowerCase()) {
            case 'w':
                this.controls.moveForward = false;
                // Stop double-tap sprint when W is released
                if (this.isDoubleTapSprinting) {
                    this.isDoubleTapSprinting = false;
                    this.controls.sprint = false;
                }
                break;
            case 's':
                this.controls.moveBackward = false;
                break;
            case 'a':
                this.controls.moveLeft = false;
                break;
            case 'd':
                this.controls.moveRight = false;
                break;
            case ' ':
                this.controls.jump = false;
                break;
            case 'shift':
                if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT) {
                    if (!this.isDoubleTapSprinting) {
                        this.controls.sprint = false;
                    }
                } else if (event.location === KeyboardEvent.DOM_KEY_LOCATION_LEFT) {
                    this.keys['ShiftLeft'] = false;
                    this.controls.crouch = false;
                }
                break;
            case 'r':
                this.keys['KeyR'] = false;
                break;
            case 'f':
                this.keys['KeyF'] = false;
                break;
        }
    }

    exportAndResetJustPressedActions() {
        const actions = {
            interactJustPressed: this.keyFPressedThisFrame, // Changed from keyE... to keyF...
            reloadJustPressed: this.keyRPressedThisFrame,
            crouchToggleJustPressed: this.keyShiftLeftPressedThisFrame,
        };
        // Reset for next frame
        this.keyFPressedThisFrame = false;
        this.keyRPressedThisFrame = false;
        this.keyShiftLeftPressedThisFrame = false;
        return actions;
    }
    
    handleMouseMove(event) {
        if (this.consoleActive) return; // Check if console is active

        /* @tweakable mouse sensitivity for looking around */
        const sensitivity = 0.002;
        
        this.gameCore.player.rotation.y -= event.movementX * sensitivity;
        this.gameCore.player.rotation.x -= event.movementY * sensitivity;
        
        // Clamp vertical rotation
        this.gameCore.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.gameCore.player.rotation.x));
        
        // Apply rotation directly to camera
        this.gameCore.camera.rotation.order = 'YXZ';
        this.gameCore.camera.rotation.y = this.gameCore.player.rotation.y;
        this.gameCore.camera.rotation.x = this.gameCore.player.rotation.x;
    }
}