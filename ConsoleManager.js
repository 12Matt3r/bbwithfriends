export class ConsoleManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const consoleInput = document.getElementById('console-input');
        consoleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.executeCommand(consoleInput.value);
                consoleInput.value = '';
            }
        });
    }
    
    toggle() {
        this.gameCore.gameState.isConsoleOpen = !this.gameCore.gameState.isConsoleOpen;
        const console = document.getElementById('console');
        
        if (this.gameCore.gameState.isConsoleOpen) {
            console.classList.remove('hidden');
            document.getElementById('console-input').focus();
            if (document.exitPointerLock) {
                document.exitPointerLock();
            }
        } else {
            console.classList.add('hidden');
            if (this.gameCore.gameState.isGameStarted) {
                this.gameCore.requestPointerLock();
            }
        }
    }
    
    executeCommand(command) {
        const output = document.getElementById('console-output');
        
        // Add command to output
        const commandLine = document.createElement('div');
        commandLine.textContent = `> ${command}`;
        commandLine.style.color = '#00ff00';
        commandLine.style.fontWeight = 'bold';
        output.appendChild(commandLine);
        
        // Parse and execute command
        const result = this.parseCommand(command);
        
        // Add result to output
        const resultLine = document.createElement('div');
        resultLine.textContent = result;
        resultLine.style.color = result.startsWith('ERROR') ? '#ff0000' : '#00ffff';
        output.appendChild(resultLine);
        
        // Scroll to bottom
        output.scrollTop = output.scrollHeight;
        
        // Add corruption for console usage
        this.gameCore.addCorruption(5);
    }
    
    parseCommand(command) {
        const parts = command.toLowerCase().trim().split('.');
        
        if (parts.length < 2) {
            return 'ERROR: Invalid command format. Use /action.target()';
        }
        
        const action = parts[0].replace('/', '');
        const target = parts[1].replace('()', '');
        
        switch (action) {
            case 'distort':
                return this.distortCommand(target);
            case 'reconstruct':
                return this.reconstructCommand(target);
            case 'jam':
                return this.jamCommand(target);
            case 'corrupt':
                return this.corruptCommand(target);
            default:
                return `ERROR: Unknown command '${action}'`;
        }
    }
    
    distortCommand(target) {
        if (target === 'enemy') {
            this.gameCore.networkManager.send({
                type: 'distort_effect',
                source: this.gameCore.networkManager.room.clientId,
                target: 'enemies',
                duration: 5000
            });
            return 'DISTORTING ENEMY NEURAL PATTERNS...';
        } else if (target === 'environment') {
            this.distortEnvironment();
            return 'REALITY MATRIX DESTABILIZED...';
        }
        return `ERROR: Invalid distort target '${target}'`;
    }
    
    reconstructCommand(target) {
        if (target === 'path') {
            this.reconstructPath();
            return 'NEURAL PATHWAYS RECONSTRUCTED...';
        }
        return `ERROR: Invalid reconstruct target '${target}'`;
    }
    
    jamCommand(target) {
        if (target === 'signal') {
            this.gameCore.networkManager.send({
                type: 'signal_jam',
                source: this.gameCore.networkManager.room.clientId,
                duration: 3000
            });
            return 'COMMUNICATION SIGNALS JAMMED...';
        }
        return `ERROR: Invalid jam target '${target}'`;
    }
    
    corruptCommand(target) {
        this.gameCore.addCorruption(10);
        return 'CORRUPTION LEVELS INCREASED...';
    }
    
    distortEnvironment() {
        document.getElementById('game-ui').classList.add('corrupted');
        
        setTimeout(() => {
            document.getElementById('game-ui').classList.remove('corrupted');
        }, 3000);
    }
    
    reconstructPath() {
        this.gameCore.fragmentManager.fragments.forEach(fragment => {
            fragment.material.emissiveIntensity = 1;
            fragment.scale.setScalar(1.5);
        });
        
        setTimeout(() => {
            this.gameCore.fragmentManager.fragments.forEach(fragment => {
                fragment.material.emissiveIntensity = 0.2;
                fragment.scale.setScalar(1);
            });
        }, 5000);
    }
}