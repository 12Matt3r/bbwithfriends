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
            crouch: false
        };
        
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
            if (this.gameCore.gameState.isGameStarted && document.pointerLockElement) {
                this.handleMouseMove(event);
            }
        });
        
        document.addEventListener('mousedown', (event) => {
            if (this.gameCore.gameState.isGameStarted) {
                if (event.button === 0) { // Left click
                    this.gameCore.handleShoot();
                } else if (event.button === 2) { // Right click
                    this.gameCore.handleReload();
                }
            }
        });
        
        // Prevent right-click context menu
        document.addEventListener('contextmenu', (event) => {
            if (this.gameCore.gameState.isGameStarted) {
                event.preventDefault();
            }
        });
        
        document.addEventListener('click', () => {
            if (this.gameCore.gameState.isGameStarted && !document.pointerLockElement) {
                this.requestPointerLock();
            }
        });
        
        window.addEventListener('resize', () => {
            this.gameCore.handleResize();
        });
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
        if (this.gameCore.gameState.isConsoleOpen && event.key !== '`' && event.key !== '~') {
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
                    // Right Shift = Sprint
                    this.controls.sprint = true;
                } else {
                    // Left Shift = Crouch
                    this.controls.crouch = true;
                }
                break;
            case 'r':
                event.preventDefault();
                this.gameCore.handleReload();
                break;
            case 'f':
                event.preventDefault();
                this.gameCore.handleInteraction();
                break;
            case '`':
            case '~':
                event.preventDefault();
                this.gameCore.consoleManager.toggle();
                break;
            case 'escape':
                if (this.gameCore.gameState.isConsoleOpen) {
                    this.gameCore.consoleManager.toggle();
                } else if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
                break;
        }
    }
    
    handleKeyUp(event) {
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
                    // Right Shift released = stop sprint (only if not double-tap sprinting)
                    if (!this.isDoubleTapSprinting) {
                        this.controls.sprint = false;
                    }
                } else {
                    // Left Shift released = stop crouch
                    this.controls.crouch = false;
                }
                break;
        }
    }
    
    handleMouseMove(event) {
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