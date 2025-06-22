export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
    }
    
    async initialize() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio context initialization failed:', e);
        }
    }
    
    playSound(soundType) {
        console.log(`Playing sound: ${soundType}`);
        
        // Visual feedback for sounds with enhanced variety
        if (soundType === 'shoot') {
            this.addScreenFlash('#00ffff', 50);
        } else if (soundType === 'silenced_shot') {
            this.addScreenFlash('#004444', 30);
        } else if (soundType === 'collect') {
            this.addScreenFlash('#ffff00', 200);
        } else if (soundType === 'deliver') {
            this.addScreenFlash('#00ff00', 300);
        } else if (soundType === 'teleport') {
            this.addScreenFlash('#ff00ff', 150);
        } else if (soundType === 'buff_acquired') {
            this.addScreenFlash('#00ff88', 250);
        } else if (soundType === 'distant_shot') {
            // Subtle flash for distant shots
            this.addScreenFlash('#002244', 25);
        } else if (soundType === 'fragment_ping') {
            // Add a specific visual or console log for fragment ping
            console.log("Fragment Ping sound triggered!");
            this.addScreenFlash('rgba(0,150,255,0.2)', 500); // A light blue, quick flash
        } else if (soundType === 'random_explosion') {
            console.log("Random explosion sound triggered!");
            // Potentially a different flash for environmental explosion vs direct hit
            this.addScreenFlash('rgba(255,120,0,0.3)', 400); // Orange flash
        } else if (soundType === 'hallucination_spawn') {
            console.log("Hallucination spawn sound triggered!");
            this.addScreenFlash('rgba(120,0,120,0.2)', 700); // Purpleish flash
        }
    }
    
    addScreenFlash(color, duration) {
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: ${color};
            opacity: 0.3;
            pointer-events: none;
            z-index: 1000;
        `;
        
        document.body.appendChild(flash);
        
        setTimeout(() => {
            if (flash.parentNode) {
                flash.parentNode.removeChild(flash);
            }
        }, duration);
    }
}