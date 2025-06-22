export class ConsoleManager {
    constructor(gameCore) {
        this.gameCore = gameCore;
        // Event listeners are now primarily handled by UIManager for the console input
    }

    processCommand(inputText) {
        if (!inputText) return;

        const [command, ...args] = inputText.toLowerCase().split(' ');
        
        // Define known commands (client-side validation before sending)
        // More commands can be added here as they are implemented.
        const knownCommands = [
            '/summon_echo',
            '/swap_positions',
            '/glitch_gravity',
            '/reveal_map',
            // Example test commands:
            '/test_error',
            '/test_local'
        ];

        if (knownCommands.includes(command)) {
            if (command === '/test_local') {
                // Handle test_local directly without sending over network
                this.gameCore.uiManager.addConsoleLogMessage(`Locally processing: ${command} with args: ${args.join(', ')}`, 'info');
                // Example local action:
                this.executeNetworkedCommand(command, args, this.gameCore.networkManager ? this.gameCore.networkManager.getPlayerId() : 'local');
            } else {
                // For most commands, send to network to be executed by all (or by server logic)
                if (this.gameCore.networkManager) {
                    this.gameCore.networkManager.sendConsoleCommand(command, args);
                    this.gameCore.uiManager.addConsoleLogMessage(`Sent command: ${command}`, 'info');
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage(`Error: NetworkManager not available. Cannot send command: ${command}`, 'error');
                }
            }
        } else if (command === '/test_error') { // Kept for direct testing of error display
             this.gameCore.uiManager.addConsoleLogMessage(`Simulating error for: ${command}`, 'error');
        }
        else {
            this.gameCore.uiManager.addConsoleLogMessage(`Error: Unknown command "${command}"`, 'error');
        }
    }

    executeNetworkedCommand(commandName, args, instigatorPlayerId) {
        const username = (this.gameCore.networkManager && this.gameCore.networkManager.getUsername(instigatorPlayerId)) || instigatorPlayerId || 'Unknown';
        this.gameCore.uiManager.addConsoleLogMessage(`Received command: ${commandName} from ${username}`, 'response');

        switch (commandName) {
            case '/summon_echo':
                if (this.gameCore.effectsManager && typeof this.gameCore.effectsManager.triggerSummonEchoEffect === 'function') {
                    this.gameCore.effectsManager.triggerSummonEchoEffect();
                } else {
                    console.error("effectsManager or triggerSummonEchoEffect not found");
                }
                this.gameCore.uiManager.addConsoleLogMessage("Echoes shimmer around...", "response");

                // This command also increases global corruption
                if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                    const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                    this.gameCore.updateGlobalCorruption(corruptionAmount);
                    this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}%`, 'info');
                } else {
                     console.error("updateGlobalCorruption function not found on gameCore");
                }
                if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorPlayerId, commandName);
                break;
            case '/test_local': // Example of a command that might have local effects even if "networked"
                 this.gameCore.uiManager.addConsoleLogMessage(`Executing test_local command with args: ${args.join(', ')} initiated by ${username}`, 'response');
                if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} (local test) used by ${username}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorPlayerId, commandName);
                break;

            case '/swap_positions':
                this.gameCore.uiManager.addConsoleLogMessage("Player positions are shifting...", "response");
                if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                    const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                    this.gameCore.updateGlobalCorruption(corruptionAmount);
                    this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}% due to position swap attempt.`, 'info');
                } else {
                    console.error("updateGlobalCorruption function not found on gameCore");
                }

                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    if (!this.gameCore.networkManager || !this.gameCore.networkManager.getConnectedPeersIds) {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: NetworkManager not available for peer list.", "error");
                        break;
                    }
                    const playerIds = this.gameCore.networkManager.getConnectedPeersIds(true); // true to include local client

                    if (playerIds.length < 2) {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: Not enough players connected.", "error");
                        break;
                    }

                    let p1Index = Math.floor(Math.random() * playerIds.length);
                    let p2Index = Math.floor(Math.random() * playerIds.length);
                    while (p2Index === p1Index) {
                        p2Index = Math.floor(Math.random() * playerIds.length);
                    }
                    const playerA_id = playerIds[p1Index];
                    const playerB_id = playerIds[p2Index];

                    if (this.gameCore.networkManager.sendSwapPlayersCommand) {
                        this.gameCore.networkManager.sendSwapPlayersCommand(playerA_id, playerB_id);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated swap between ${playerA_id} and ${playerB_id}.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Swap failed: sendSwapPlayersCommand not available on NetworkManager.", "error");
                    }
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to execute swap.", "info");
                }
                if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorPlayerId, commandName);
                break;

            case '/glitch_gravity':
                this.gameCore.uiManager.addConsoleLogMessage("Gravity feels... strange.", "response");
                if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                    const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                    this.gameCore.updateGlobalCorruption(corruptionAmount);
                    this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}% due to gravity glitch.`, 'info');
                } else {
                    console.error("updateGlobalCorruption function not found on gameCore");
                }

                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const randomYGravity = (Math.random() > 0.5 ? -1 : 1) * (Math.random() * 10 + 5); // -15 to -5 or 5 to 15
                    const glitchDuration = Math.floor(Math.random() * 11) + 10; // 10-20 seconds

                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendGlitchGravityCommand) {
                        this.gameCore.networkManager.sendGlitchGravityCommand({ y: randomYGravity }, glitchDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated gravity glitch: Y-gravity ${randomYGravity} for ${glitchDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Gravity glitch failed: sendGlitchGravityCommand not available on NetworkManager.", "error");
                    }
                } else {
                    this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to set new gravity.", "info");
                }
                if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorPlayerId, commandName);
                break;

            case '/reveal_map':
                this.gameCore.uiManager.addConsoleLogMessage("The veil of ignorance lifts... temporarily.", "response");
                if (this.gameCore.updateGlobalCorruption && typeof this.gameCore.updateGlobalCorruption === 'function') {
                    const corruptionAmount = Math.floor(Math.random() * 16) + 5; // +5-20%
                    this.gameCore.updateGlobalCorruption(corruptionAmount);
                    this.gameCore.uiManager.addConsoleLogMessage(`System corruption increased by ${corruptionAmount}% due to map reveal.`, 'info');
                } else {
                    console.error("updateGlobalCorruption function not found on gameCore");
                }

                if (this.gameCore.isAuthoritativeClient && this.gameCore.isAuthoritativeClient()) {
                    const revealDuration = 10; // 10 seconds
                    if (this.gameCore.networkManager && this.gameCore.networkManager.sendRevealMapCommand) {
                        this.gameCore.networkManager.sendRevealMapCommand(revealDuration);
                        this.gameCore.uiManager.addConsoleLogMessage(`Authoritative client initiated map reveal for ${revealDuration}s.`, 'info');
                    } else {
                        this.gameCore.uiManager.addConsoleLogMessage("Map reveal failed: sendRevealMapCommand not available on NetworkManager.", "error");
                    }
                } else {
                     this.gameCore.uiManager.addConsoleLogMessage("Waiting for authoritative client to trigger map reveal.", "info");
                }
                if (this.gameCore.streamerDataManager) this.gameCore.streamerDataManager.addStreamerEvent(`Command: ${commandName} used by ${username}!`);
                if (this.gameCore.matchStatsManager) this.gameCore.matchStatsManager.recordCommandUse(instigatorPlayerId, commandName);
                break;

            default:
                this.gameCore.uiManager.addConsoleLogMessage(`Cannot execute unknown networked command: ${commandName}`, "error");
                break;
        }
    }
}
